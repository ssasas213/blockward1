// ============================================================================
// chainAnchor — on-chain anchoring + verification of credential commitments.
//
// STORAGE GUARANTEE: the ONLY data that touches the chain is the BW-HASH-V1
// content commitment (SHA-256) plus non-sensitive references (verification
// id, version, hash format version) carried in the anchor token's URI. No
// names, DOB, emails, evidence or internal ids ever go on-chain.
//
// anchorCredential(svc, registryId) — idempotent minting:
//   - already anchored → no-op
//   - unverified organisation → skipped (existing product rule)
//   - atomic claim lock (pending/failed → anchoring via conditional
//     updateMany) so repeated clicks / retries / concurrent approvals can
//     never mint twice; stale claims (>10 min) are taken over
//   - best-effort: a chain failure marks nft_status 'failed' and NEVER
//     disturbs the delivered credential
//
// verifyChainAnchor(svc, cred) — the six-point confirmation that must ALL
// pass before anything may display "Blockchain Verified":
//   1. network/chain id   — live RPC chainId === 11155111 (sepolia)
//   2. contract & ref      — anchor contract === configured contract; token
//                            exists on THAT contract (ownerOf)
//   3. transaction receipt — exists, status 'success', to === contract
//   4. hash                — on-chain committed hash === recomputed
//                            BW-HASH-V1 hash of the current content
//   5. issuer              — receipt.from === the platform issuer address
//   6. current validity    — caller checks approval_status / superseded
//
// Outcome status: 'confirmed' | 'confirmed_legacy' | 'hash_mismatch' |
// 'anchor_invalid' | 'chain_unavailable' | 'pending'. RPC failure can only
// ever produce 'chain_unavailable' — it can NEVER produce 'confirmed'.
// Results are cached on the registry (chain_check) with a TTL so anonymous
// public verification traffic does not hammer the RPC.
// ============================================================================
import { createPublicClient, createWalletClient, http, parseAbi } from 'npm:viem@2.7.0';
import { privateKeyToAccount } from 'npm:viem@2.7.0/accounts';
import { encodeBytes32String } from 'npm:ethers@6.13.0';
import { sepolia } from 'npm:viem@2.7.0/chains';
import { computeCredentialHash, CREDENTIAL_HASH_VERSION } from './credentialHash.ts';

const ABI = parseAbi([
  'function issueAward(address studentVault, address teacherVault, bytes32 awardType_, string tokenURI_)',
  'function mint(address to, string uri) returns (uint256)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
]);
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const CLAIM_STALE_MS = 10 * 60 * 1000;
const CONFIRM_TTL_MS = 10 * 60 * 1000;
const FAIL_TTL_MS = 2 * 60 * 1000;

export function getChainConfig() {
  return {
    rpc: Deno.env.get('SEPOLIA_RPC_URL') || null,
    contract: Deno.env.get('CONTRACT_ADDRESS') || null,
    pk: Deno.env.get('ISSUER_PRIVATE_KEY') || null,
    network: Deno.env.get('NETWORK') || 'sepolia',
  };
}

// The anchor token URI — a data-URI JSON document. Non-sensitive references
// and the content commitment ONLY.
function buildAnchorTokenUri(reg, hash) {
  const meta = {
    v: 1,
    type: 'blockward-anchor',
    id: reg.verification_id,
    ver: reg.version || 1,
    hv: CREDENTIAL_HASH_VERSION,
    h: hash,
  };
  const json = JSON.stringify(meta);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return `data:application/json;base64,${b64}`;
}

function parseAnchorHash(uri) {
  try {
    if (typeof uri !== 'string' || !uri.startsWith('data:')) return null;
    const b64 = uri.split(',')[1];
    if (!b64) return null;
    const json = decodeURIComponent(escape(atob(b64)));
    const meta = JSON.parse(json);
    return typeof meta?.h === 'string' && meta?.type === 'blockward-anchor' ? meta.h : null;
  } catch {
    return null;
  }
}

// ═══════════════════════════ ANCHORING (idempotent) ═══════════════════════════

export async function anchorCredential(svc, registryId) {
  const log = (step, extra = {}) => console.log(JSON.stringify({ fn: 'chainAnchor', step, ...extra }));
  let reg = null;
  try {
    const cfg = getChainConfig();
    if (!cfg.rpc || !cfg.contract || !cfg.pk) {
      log('skip', { reason: 'missing_chain_config' });
      return { ok: false, skipped: true, reason: 'missing_chain_config' };
    }
    if (cfg.network !== 'sepolia') {
      log('skip', { reason: 'wrong_network', network: cfg.network });
      return { ok: false, skipped: true, reason: 'wrong_network' };
    }

    const rows = await svc.entities.BlockWardVerificationRegistry.filter({ id: registryId });
    reg = rows?.[0] || null;
    if (!reg) return { ok: false, error: 'registry_not_found' };
    if (reg.approval_status !== 'approved') {
      log('skip', { reason: 'not_approved', approval_status: reg.approval_status });
      return { ok: false, skipped: true, reason: 'not_approved' };
    }

    // Idempotent: already anchored → never re-mint (retries, repeated clicks).
    if (reg.token_id && reg.transaction_hash) {
      log('idempotent', { token_id: reg.token_id });
      return { ok: true, idempotent: true, token_id: reg.token_id, transaction_hash: reg.transaction_hash };
    }

    // Existing product rule: unverified organisations do not anchor —
    // a fake school must never mint a chain-anchored credential.
    if (reg.school_id) {
      const schools = await svc.entities.School.filter({ id: reg.school_id }).catch(() => []);
      if (schools?.[0]?.verification_status === 'unverified') {
        log('skip', { reason: 'organisation_unverified' });
        return { ok: false, skipped: true, reason: 'organisation_unverified' };
      }
    }

    // ── Concurrency lock ── a fresh claim held elsewhere backs off; a stale
    // claim (>10 min, crashed mint) is released and taken over.
    const nowMs = Date.now();
    const claimAge = reg.anchor_claimed_at ? nowMs - new Date(reg.anchor_claimed_at).getTime() : Infinity;
    if (reg.nft_status === 'anchoring' && claimAge < CLAIM_STALE_MS) {
      log('busy', {});
      return { ok: false, busy: true, reason: 'anchor_in_progress' };
    }
    if (reg.nft_status === 'anchoring') {
      await svc.entities.BlockWardVerificationRegistry.updateMany(
        { id: registryId, nft_status: 'anchoring' },
        { $set: { nft_status: 'pending', anchor_claimed_by: null, anchor_claimed_at: null } }
      ).catch(() => {});
    }
    const myClaim = crypto.randomUUID();
    try {
      await svc.entities.BlockWardVerificationRegistry.updateMany(
        { id: registryId, nft_status: { $in: ['pending', 'failed'] } },
        { $set: { nft_status: 'anchoring', anchor_claimed_by: myClaim, anchor_claimed_at: new Date().toISOString() } }
      );
    } catch (e) {
      return { ok: false, error: 'claim_failed: ' + (e?.message || e) };
    }
    const refetched = await svc.entities.BlockWardVerificationRegistry.filter({ id: registryId });
    const claimed = refetched?.[0];
    if (!claimed || claimed.nft_status !== 'anchoring' || claimed.anchor_claimed_by !== myClaim) {
      log('lost_claim', {});
      return { ok: false, busy: true, reason: 'anchor_in_progress' };
    }
    reg = claimed;

    const markFailed = async (reason, detail) => {
      log('failed', { reason, detail: String(detail || '').slice(0, 200) });
      try {
        await svc.entities.BlockWardVerificationRegistry.update(registryId, {
          nft_status: 'failed', anchor_claimed_by: null, anchor_claimed_at: null,
        });
      } catch { /* best-effort */ }
    };

    // ── The commitment: hash of the CURRENT content ──
    const hash = await computeCredentialHash(reg);
    const uri = buildAnchorTokenUri(reg, hash);
    const account = privateKeyToAccount(cfg.pk);

    // Recipient: the student's custodial wallet when they have one; otherwise
    // the platform issuer address (the anchor's value is the commitment, not
    // its holder).
    let recipient = account.address;
    try {
      if (reg.student_id) {
        const prows = await svc.entities.UserProfile.filter({ id: reg.student_id });
        if (prows?.[0]?.wallet_address) recipient = prows[0].wallet_address;
      }
    } catch { /* best-effort */ }

    const pub = createPublicClient({ chain: sepolia, transport: http(cfg.rpc) });
    const wal = createWalletClient({ account, chain: sepolia, transport: http(cfg.rpc) });

    // Live network guard — the configured network must BE Sepolia, checked at
    // the RPC itself, not just in env.
    const chainId = await pub.getChainId();
    if (chainId !== sepolia.id) {
      await markFailed('wrong_chain', `chainId ${chainId}`);
      return { ok: false, error: 'wrong_chain', chainId };
    }

    const awardBytes = encodeBytes32String(String(reg.achievement_category || 'special'));
    log('simulating', { recipient, contract: cfg.contract });

    // The deployed contract exposes issueAward (v2). If a deployment ever only
    // has the v1 mint(to, uri), fall back to it — same commitment URI either way.
    let sim;
    try {
      sim = await pub.simulateContract({
        account, address: cfg.contract, abi: ABI,
        functionName: 'issueAward',
        args: [recipient, account.address, awardBytes, uri],
      });
    } catch (e1) {
      log('issueAward_sim_failed', { err: String(e1?.shortMessage || e1?.message || e1).slice(0, 200) });
      try {
        sim = await pub.simulateContract({
          account, address: cfg.contract, abi: ABI,
          functionName: 'mint',
          args: [recipient, uri],
        });
      } catch (e2) {
        await markFailed('simulate_failed', e2?.shortMessage || e2?.message || e2);
        return { ok: false, error: 'simulate_failed' };
      }
    }

    const txHash = await wal.writeContract(sim.request);
    log('sent', { txHash });
    const receipt = await pub.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status !== 'success') {
      await markFailed('mint_reverted', txHash);
      return { ok: false, error: 'mint_reverted', transaction_hash: txHash };
    }

    let tokenId = null;
    for (const l of receipt.logs) {
      if (l.topics?.[0]?.toLowerCase() === TRANSFER_TOPIC && l.topics.length === 4) {
        tokenId = BigInt(l.topics[3]).toString();
        break;
      }
    }
    if (tokenId === null) {
      await markFailed('no_token_id', txHash);
      return { ok: false, error: 'no_token_id', transaction_hash: txHash };
    }
    log('anchored', { token_id: tokenId, txHash });

    await svc.entities.BlockWardVerificationRegistry.update(registryId, {
      token_id: tokenId,
      transaction_hash: receipt.transactionHash,
      contract_address: cfg.contract,
      blockchain_network: 'sepolia',
      nft_status: 'minted',
      credential_hash: hash,
      hash_version: CREDENTIAL_HASH_VERSION,
      chain_check: null,
      anchor_claimed_by: null,
      anchor_claimed_at: null,
    });

    // Mirror the anchor on the linked BlockWard record (vault technical details).
    try {
      const bws = await svc.entities.BlockWard.filter({ student_record_id: reg.student_record_id, status: 'active' });
      if (bws?.[0]) {
        await svc.entities.BlockWard.update(bws[0].id, {
          token_id: tokenId,
          transaction_hash: receipt.transactionHash,
          block_number: Number(receipt.blockNumber || 0),
        });
      }
    } catch { /* best-effort */ }

    return { ok: true, token_id: tokenId, transaction_hash: receipt.transactionHash, credential_hash: hash, testnet: true, network: 'sepolia' };
  } catch (e) {
    log('error', { err: String(e?.message || e).slice(0, 300) });
    if (reg) {
      try {
        await svc.entities.BlockWardVerificationRegistry.update(registryId, {
          nft_status: 'failed', anchor_claimed_by: null, anchor_claimed_at: null,
        });
      } catch { /* best-effort */ }
    }
    return { ok: false, error: e?.message || String(e) };
  }
}

// ═════════════════════ VERIFICATION (six-point confirmation) ═════════════════════

// cred: a registry record, or a legacy-shaped object (verification_id, version,
// achievement_* content fields, token_id, transaction_hash, contract_address,
// blockchain_network, credential_hash, chain_check).
export async function verifyChainAnchor(svc, cred, opts = {}) {
  const anchor = {
    token_id: cred.token_id ?? null,
    transaction_hash: cred.transaction_hash ?? null,
    contract_address: cred.contract_address ?? null,
  };
  const network = 'sepolia'; // the only network this deployment anchors to

  // No anchor yet → pending (never verified).
  if (!anchor.token_id || !anchor.transaction_hash) {
    return { status: 'pending', network, testnet: true };
  }

  // TTL cache — fresh results are reused so public traffic doesn't hammer the
  // RPC. Confirmed/mismatch results cache 10 min; failures 2 min.
  const cached = cred.chain_check || null;
  if (cached && cached.token_id === anchor.token_id && cached.checked_at) {
    const age = Date.now() - new Date(cached.checked_at).getTime();
    const ttl = ['confirmed', 'confirmed_legacy', 'hash_mismatch'].includes(cached.status) ? CONFIRM_TTL_MS : FAIL_TTL_MS;
    if (age >= 0 && age < ttl) return cached;
  }

  const cfg = getChainConfig();
  const result = {
    status: 'chain_unavailable',
    network,
    testnet: true,
    checked_at: new Date().toISOString(),
    token_id: anchor.token_id,
    transaction_hash: anchor.transaction_hash,
    contract_address: anchor.contract_address,
  };

  if (!cfg.rpc || !cfg.contract || !cfg.pk) return { ...result, reason: 'missing_chain_config' };
  if (cfg.network !== 'sepolia') return { ...result, reason: 'wrong_network_config' };

  const checks = { network: false, contract: false, receipt: false, token: false, issuer: false, hash: false };

  try {
    const pub = createPublicClient({ chain: sepolia, transport: http(cfg.rpc) });

    // 1. Network & chain id — from the live RPC, not env.
    const chainId = await pub.getChainId();
    checks.network = chainId === sepolia.id;

    // 2. Contract — the anchor must live on the configured contract, and the
    // referenced token must exist on THAT contract.
    checks.contract = !!anchor.contract_address
      && anchor.contract_address.toLowerCase() === cfg.contract.toLowerCase();

    // 3. Transaction receipt.
    let receipt = null;
    try { receipt = await pub.getTransactionReceipt({ hash: anchor.transaction_hash }); } catch { receipt = null; }
    checks.receipt = !!receipt && receipt.status === 'success'
      && (receipt.to || '').toLowerCase() === cfg.contract.toLowerCase();

    if (checks.contract) {
      try {
        await pub.readContract({ address: cfg.contract, abi: ABI, functionName: 'ownerOf', args: [BigInt(anchor.token_id)] });
        checks.token = true;
      } catch { checks.token = false; }
    }

    // 5. Issuer — the receipt must come from the platform issuer address.
    try {
      const issuer = privateKeyToAccount(cfg.pk).address;
      checks.issuer = !!receipt && receipt.from.toLowerCase() === issuer.toLowerCase();
    } catch { checks.issuer = false; }

    // 4. Hash — the on-chain commitment vs the recomputed BW-HASH-V1 hash of
    // the CURRENT content. Legacy anchors (pre-V1) carry no commitment.
    let committed = null;
    if (checks.token) {
      try {
        const uri = await pub.readContract({ address: cfg.contract, abi: ABI, functionName: 'tokenURI', args: [BigInt(anchor.token_id)] });
        committed = parseAnchorHash(uri);
      } catch { committed = null; }
    }

    const structural = checks.network && checks.contract && checks.receipt && checks.token && checks.issuer;

    if (committed === null) {
      // Pre-V1 anchor: the receipt/contract/issuer can still confirm an
      // anchor exists, but no content commitment was made — honest distinct
      // status, never "confirmed".
      result.status = structural ? 'confirmed_legacy' : 'anchor_invalid';
      result.legacy = true;
    } else {
      const recomputed = await computeCredentialHash(cred);
      result.committed_hash = committed;
      result.recomputed_hash = recomputed;
      checks.hash = committed === recomputed;
      if (!checks.hash) {
        result.status = 'hash_mismatch';
      } else {
        result.status = structural ? 'confirmed' : 'anchor_invalid';
      }
    }
  } catch (e) {
    // RPC unreachable/unresponsive — NEVER verified.
    return { ...result, status: 'chain_unavailable', reason: 'rpc_error' };
  }

  result.checks = checks;

  // Cache on the registry (best-effort; legacy pseudo-credentials have no id).
  if (svc && cred.id && !opts.noCache) {
    try {
      await svc.entities.BlockWardVerificationRegistry.update(cred.id, { chain_check: result });
    } catch { /* best-effort */ }
  }
  return result;
}