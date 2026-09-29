// ============================================================================
// chainPolygon — Polygon PoS anchoring + integrity verification for Blockward
// verified credentials.
//
// WHAT GOES ON-CHAIN: the BW-HASH-V1 content commitment (SHA-256), the public
// Blockward Credential ID and the hash format version — nothing else. No
// names, emails, images or documents ever touch the chain.
//
// TWO ANCHOR MODES:
//   contract — when BLOCKWARD_CONTRACT_ADDRESS is configured, the commitment
//              is recorded through the BlockwardRegistry contract
//              (anchor(bytes32 credentialHash, string bwId) + Anchored event).
//   calldata — otherwise the commitment is written as the data payload of a
//              0-value self-transaction from the Blockward backend wallet.
//              The payload lives permanently on-chain in the transaction's
//              input data and is verified by recomputing and comparing.
//
// NO NFTs. Achievements are blockchain-backed verified credentials, never
// tradable assets.
//
// REQUIRED SECRETS:
//   ISSUER_PRIVATE_KEY  — backend wallet that pays gas (users NEVER need a
//                         wallet, POL or any cryptocurrency)
//   NETWORK             — 'polygon_amoy' (testnet, default) | 'polygon' (mainnet)
//   POLYGON_RPC_URL     — optional RPC override; public Amoy RPC otherwise
//   BLOCKWARD_CONTRACT_ADDRESS — optional; enables contract anchor mode
// ============================================================================
import { createPublicClient, createWalletClient, http, stringToHex, toHex, parseAbi, defineChain } from 'npm:viem@2.7.0';
import { privateKeyToAccount } from 'npm:viem@2.7.0/accounts';

// Polygon PoS mainnet and Amoy testnet, defined explicitly (no reliance on
// the viem chains bundle).
const polygonAmoy = defineChain({
  id: 80002,
  name: 'Polygon Amoy',
  nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc-amoy.polygon.technology'] } },
  blockExplorers: { default: { name: 'PolygonScan', url: 'https://amoy.polygonscan.com' } },
  testnet: true,
});
const polygonMainnet = defineChain({
  id: 137,
  name: 'Polygon',
  nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
  rpcUrls: { default: { http: ['https://polygon-rpc.com'] } },
  blockExplorers: { default: { name: 'PolygonScan', url: 'https://polygonscan.com' } },
});
import { computeCredentialHash, CREDENTIAL_HASH_VERSION } from './credentialHash.ts';

const CONTRACT_ABI = parseAbi([
  'function anchor(bytes32 credentialHash, string bwId)',
  'function anchors(bytes32 credentialHash) view returns (bool)',
  'event Anchored(bytes32 indexed credentialHash, string bwId, address indexed recorder, uint256 timestamp)',
]);

const CLAIM_STALE_MS = 10 * 60 * 1000;
const CONFIRM_TTL_MS = 10 * 60 * 1000;
const FAIL_TTL_MS = 2 * 60 * 1000;

export function getPolygonConfig() {
  const network = Deno.env.get('NETWORK') || 'polygon_amoy';
  const isMainnet = String(network).startsWith('polygon');
  const chain = network === 'polygon' || network === 'polygon_mainnet' ? polygonMainnet : polygonAmoy;
  return {
    network: chain.id === polygonMainnet.id ? 'polygon' : 'polygon_amoy',
    chain,
    testnet: chain.id !== polygonMainnet.id,
    rpc: Deno.env.get('POLYGON_RPC_URL') || (chain.id === polygonMainnet.id ? 'https://polygon-bor-rpc.publicnode.com' : 'https://polygon-amoy-bor-rpc.publicnode.com'),
    contract: Deno.env.get('BLOCKWARD_CONTRACT_ADDRESS') || null,
    pk: Deno.env.get('ISSUER_PRIVATE_KEY') || null,
  };
}

// The on-chain commitment payload — public references and the content hash
// ONLY. This exact string is what integrity verification compares against.
function buildCommitmentPayload(bwId: string, hash: string): string {
  return JSON.stringify({ v: 1, t: 'blockward-anchor', id: bwId, hv: CREDENTIAL_HASH_VERSION, h: hash });
}

function commitmentFromPayload(input: string): string | null {
  try {
    const meta = JSON.parse(input);
    return meta?.t === 'blockward-anchor' && typeof meta?.h === 'string' ? meta.h : null;
  } catch {
    return null;
  }
}

// ═════════════════════ ANCHORING (idempotent, claim-locked) ═════════════════════
//

export async function anchorCredential(svc, credentialId: string) {
  const log = (step: string, extra: Record<string, unknown> = {}) =>
    console.log(JSON.stringify({ fn: 'chainPolygon', step, ...extra }));
  let cred: any = null;
  try {
    const cfg = getPolygonConfig();
    if (!cfg.pk) {
      log('skip', { reason: 'missing_issuer_key' });
      return { ok: false, skipped: true, reason: 'missing_issuer_key' };
    }

    const rows = await svc.entities.Credential.filter({ id: credentialId });
    cred = rows?.[0] || null;
    if (!cred) return { ok: false, error: 'credential_not_found' };

    // Idempotent — already anchored, never re-anchor.
    if (cred.anchor_status === 'confirmed' && cred.blockchain?.transaction_hash) {
      log('idempotent', { transaction_hash: cred.blockchain.transaction_hash });
      return { ok: true, idempotent: true, transaction_hash: cred.blockchain.transaction_hash };
    }

    // ── Concurrency lock: pending/failed → processing via conditional update ──
    const nowMs = Date.now();
    const claimAge = cred.anchor_claimed_at ? nowMs - new Date(cred.anchor_claimed_at).getTime() : Infinity;
    if (cred.anchor_status === 'processing' && claimAge < CLAIM_STALE_MS) {
      return { ok: false, busy: true, reason: 'anchor_in_progress' };
    }
    if (cred.anchor_status === 'processing') {
      await svc.entities.Credential.update(credentialId, {
        anchor_status: 'pending',
        anchor_claimed_by: null,
        anchor_claimed_at: null,
      }).catch(() => {});
    }
    const myClaim = crypto.randomUUID();
    await svc.entities.Credential.updateMany(
      { id: credentialId, anchor_status: { $in: ['pending', 'failed'] } },
      { $set: { anchor_status: 'processing', anchor_claimed_by: myClaim, anchor_claimed_at: new Date().toISOString() } }
    );
    const refetched = await svc.entities.Credential.filter({ id: credentialId });
    const claimed = refetched?.[0];
    if (!claimed || claimed.anchor_status !== 'processing' || claimed.anchor_claimed_by !== myClaim) {
      return { ok: false, busy: true, reason: 'anchor_in_progress' };
    }
    cred = claimed;

    const markFailed = async (reason: string, detail?: unknown) => {
      log('failed', { reason, detail: String(detail || '').slice(0, 200) });
      try {
        await svc.entities.Credential.update(credentialId, {
          anchor_status: 'failed',
          blockchain: { ...(cred.blockchain || {}), status: 'failed', error: String(reason).slice(0, 300) },
          anchor_claimed_by: null,
          anchor_claimed_at: null,
        });
      } catch { /* best-effort */ }
    };

    // ── The commitment: BW-HASH-V1 hash of the CURRENT credential content ──
    const hash = await computeCredentialHash({
      verification_id: cred.bw_id,
      version: cred.hash_version === 2 ? 2 : 1,
      achievement_title: cred.title,
      achievement_category: cred.category,
      achievement_description: cred.description || '',
      date_achieved: cred.date_achieved,
    });
    const payload = buildCommitmentPayload(cred.bw_id, hash);
    const account = privateKeyToAccount(cfg.pk);
    const pub = createPublicClient({ chain: cfg.chain, transport: http(cfg.rpc) });
    const wal = createWalletClient({ account, chain: cfg.chain, transport: http(cfg.rpc) });

    // Live network guard — the RPC must actually be the configured Polygon PoS chain.
    const chainId = await pub.getChainId().catch(() => null);
    if (chainId !== cfg.chain.id) {
      await markFailed('wrong_chain', `chainId ${chainId}`);
      return { ok: false, error: 'wrong_chain', chainId };
    }

    let txHash: string;
    if (cfg.contract) {
      // Contract anchor mode — BlockwardRegistry.anchor(bytes32, string)
      const sim = await pub.simulateContract({
        account, address: cfg.contract as `0x${string}`, abi: CONTRACT_ABI,
        functionName: 'anchor',
        args: [(`0x${hash.slice(0, 64)}`) as `0x${string}`, cred.bw_id],
      });
      txHash = await wal.writeContract(sim.request);
    } else {
      // Calldata anchor mode — a 0-value self-transaction whose input data
      // permanently records the commitment on Polygon PoS.
      txHash = await wal.sendTransaction({
        to: account.address,
        value: 0n,
        data: stringToHex(payload),
      });
    }
    log('sent', { txHash, mode: cfg.contract ? 'contract' : 'calldata' });

    const receipt = await pub.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status !== 'success') {
      await markFailed('tx_reverted', txHash);
      return { ok: false, error: 'tx_reverted', transaction_hash: txHash };
    }
    const blockTimestamp = receipt.blockTimestamp
      ? new Date(Number(receipt.blockTimestamp)).toISOString()
      : new Date().toISOString();
    log('anchored', { txHash, block: String(receipt.blockNumber) });

    const blockchain = {
      status: 'confirmed',
      network: cfg.network,
      chain_id: cfg.chain.id,
      anchor_mode: cfg.contract ? 'contract' : 'calldata',
      contract_address: cfg.contract || null,
      transaction_hash: receipt.transactionHash,
      block_number: Number(receipt.blockNumber || 0),
      block_timestamp: blockTimestamp,
      error: null,
    };
    await svc.entities.Credential.update(credentialId, {
      anchor_status: 'confirmed',
      blockchain,
      credential_hash: hash,
      hash_version: CREDENTIAL_HASH_VERSION,
      chain_check: null,
      anchor_claimed_by: null,
      anchor_claimed_at: null,
    });
    await svc.entities.Credential.update(credentialId, {
      event_log: (cred.event_log || []).concat([{
        event: 'blockchain_confirmed',
        actor: 'system',
        note: `Polygon PoS anchor confirmed (${cfg.network}, tx ${String(receipt.transactionHash).slice(0, 18)}…)`,
        timestamp: new Date().toISOString(),
      }]),
    }).catch(() => {});

    return { ok: true, transaction_hash: receipt.transactionHash, credential_hash: hash, network: cfg.network, testnet: cfg.testnet };
  } catch (e) {
    log('error', { err: String(e?.message || e).slice(0, 300) });
    if (cred) {
      try {
        await svc.entities.Credential.update(credentialId, {
          anchor_status: 'failed',
          blockchain: { ...(cred.blockchain || {}), status: 'failed', error: String(e?.message || e).slice(0, 300) },
          anchor_claimed_by: null,
          anchor_claimed_at: null,
        });
      } catch { /* best-effort */ }
    }
    return { ok: false, error: e?.message || String(e) };
  }
}

// ═════════════════════ INTEGRITY (recompute & compare) ═════════════════════

// Recomputes the BW-HASH-V1 hash from the credential's CURRENT content and
// compares it with the commitment recorded on-chain. A mismatch means the
// credential content was altered after verification — never display
// "Blockward Verified" on a mismatch.
export async function verifyCredentialAnchor(svc, cred: any) {
  const bc = cred.blockchain || {};
  const network = bc.network || 'polygon_amoy';
  const anchorState = cred.anchor_status || bc.status;

  if (anchorState !== 'confirmed' || !bc.transaction_hash) {
    return { status: anchorState === 'processing' ? 'pending' : (anchorState || 'pending'), network, testnet: true };
  }

  // TTL cache — confirmed/mismatch 10 min, everything else 2 min.
  const cached = cred.chain_check || null;
  if (cached && cached.checked_at) {
    const age = Date.now() - new Date(cached.checked_at).getTime();
    const ttl = ['confirmed', 'hash_mismatch'].includes(cached.status) ? CONFIRM_TTL_MS : FAIL_TTL_MS;
    if (age >= 0 && age < ttl) return cached;
  }

  const cfg = getPolygonConfig();
  const result: any = {
    status: 'chain_unavailable',
    network,
    testnet: network !== 'polygon',
    checked_at: new Date().toISOString(),
    transaction_hash: bc.transaction_hash,
    contract_address: bc.contract_address || null,
  };

  const recomputed = await computeCredentialHash({
    verification_id: cred.bw_id,
    version: cred.hash_version === 2 ? 2 : 1,
    achievement_title: cred.title,
    achievement_category: cred.category,
    achievement_description: cred.description || '',
    date_achieved: cred.date_achieved,
  });
  result.recomputed_hash = recomputed;

  try {
    const pub = createPublicClient({ chain: cfg.chain, transport: http(cfg.rpc) });

    if (bc.anchor_mode === 'contract' && bc.contract_address) {
      // Contract mode — the Anchored event must carry the recomputed hash.
      const logs = await pub.getContractEvents({
        address: bc.contract_address as `0x${string}`,
        abi: CONTRACT_ABI,
        eventName: 'Anchored',
        args: {},
      }).catch(() => []);
      const txLogs = logs.filter((l: any) => (l.transactionHash || '').toLowerCase() === String(bc.transaction_hash).toLowerCase());
      const committed = txLogs?.[0]?.args?.credentialHash ? String(txLogs[0].args.credentialHash).slice(2) : null;
      result.committed_hash = committed;
      result.status = committed && committed.toLowerCase() === recomputed.toLowerCase() ? 'confirmed' : (committed ? 'hash_mismatch' : 'anchor_invalid');
    } else {
      // Calldata mode — the transaction's input data must equal the exact
      // commitment payload recomputed from the CURRENT content.
      const tx = await pub.getTransaction({ hash: bc.transaction_hash as `0x${string}` });
      const input = typeof tx?.input === 'string' ? tx.input : String(tx?.input || '');
      const expected = stringToHex(buildCommitmentPayload(cred.bw_id, recomputed));
      const committedBytes = commitmentFromPayload(new TextDecoder().decode(hexToBytes(input)));
      result.committed_hash = committedBytes;
      if (!committedBytes) {
        result.status = 'anchor_invalid';
        result.reason = 'commitment_not_found_in_tx';
      } else if (committedBytes.toLowerCase() !== recomputed.toLowerCase()) {
        result.status = 'hash_mismatch';
      } else {
        result.status = 'confirmed';
      }
    }
  } catch {
    return { ...result, status: 'chain_unavailable', reason: 'rpc_error' };
  }

  // Cache on the credential (best-effort).
  if (svc && cred.id) {
    try {
      await svc.entities.Credential.update(cred.id, { chain_check: result });
    } catch { /* best-effort */ }
  }
  return result;
}

function hexToBytes(hex: string): Uint8Array {
  const h = String(hex || '').replace(/^0x/i, '');
  if (h === '') return new Uint8Array(0);
  const out = new Uint8Array(Math.floor(h.length / 2));
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}