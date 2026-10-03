// ============================================================================
// chainPolygon — Polygon PoS anchoring + integrity verification for Blockward
// verified credentials. DUAL-NETWORK (Amoy testnet + Polygon mainnet) via one
// canonical resolver. No code path ever falls back from mainnet to the test
// key, or vice-versa.
//
// WHAT GOES ON-CHAIN (UNCHANGED): the BW-HASH-V1 content commitment (SHA-256),
// the public Blockward Credential ID and the hash format version — nothing
// else. No names, emails, images or documents ever touch the chain.
//
// ANCHOR MODE (UNCHANGED): calldata — a 0-value self-transaction from the
// Blockward backend wallet whose input data permanently records the
// commitment. (Amoy additionally supports BlockwardRegistry contract mode when
// BLOCKWARD_CONTRACT_ADDRESS is set; mainnet is calldata-only.)
//
// NETWORK-PINNED VERIFICATION (§1): a credential is ALWAYS verified against
// the network it was anchored on, resolved from its persisted
// blockchain.chain_id / blockchain.network — NEVER from the application's
// current issuance selector. Switching issuance to mainnet can never break
// historical Amoy verification.
//
// POLYGON SELECTOR (§4): `POLYGON_NETWORK` ('polygon_amoy' | 'polygon_mainnet')
// is the dedicated Polygon issuance selector — deliberately separate from the
// legacy `NETWORK` variable that still drives the historical Sepolia registry
// pipeline (chainAnchor.ts). `NETWORK` and `BLOCKCHAIN_ENV` are NOT read here.
// An unsupported explicit value fails CLOSED (unsupported_network) — this
// module never silently reinterprets an unknown value as another chain. While
// POLYGON_NETWORK is unset, the documented current-stage default
// `polygon_amoy` is used so the running app is not broken before the operator
// adds the secret.
//
// REQUIRED SECRETS:
//   AMOY:    ISSUER_PRIVATE_KEY (+ optional POLYGON_RPC_URL, BLOCKWARD_CONTRACT_ADDRESS)
//   MAINNET: POLYGON_MAINNET_ISSUER_PRIVATE_KEY, POLYGON_MAINNET_ANCHOR_ADDRESS,
//            POLYGON_MAINNET_RPC_URL  (all three REQUIRED — missing any ⇒ fail closed)
//   SELECTOR: POLYGON_NETWORK (polygon_amoy | polygon_mainnet). Unset ⇒ polygon_amoy default.
// ============================================================================
import { createPublicClient, createWalletClient, http, stringToHex, parseAbi, defineChain } from 'npm:viem@2.7.0';
import { privateKeyToAccount } from 'npm:viem@2.7.0/accounts';
import { computeCredentialHash, CREDENTIAL_HASH_VERSION } from './credentialHash.ts';

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

const CONTRACT_ABI = parseAbi([
  'function anchor(bytes32 credentialHash, string bwId)',
  'function anchors(bytes32 credentialHash) view returns (bool)',
  'event Anchored(bytes32 indexed credentialHash, string bwId, address indexed recorder, uint256 timestamp)',
]);

const CLAIM_STALE_MS = 10 * 60 * 1000;
const CONFIRM_TTL_MS = 10 * 60 * 1000;
const FAIL_TTL_MS = 2 * 60 * 1000;

export type TargetNetwork = 'polygon_amoy' | 'polygon_mainnet';

export type PolygonTargetResolution =
  | { target: TargetNetwork }
  | { unsupported: true; value: string };

// ── Polygon issuance selector (§4) ──────────────────────────────────────────
// Reads POLYGON_NETWORK (a dedicated Polygon selector, separate from the
// legacy NETWORK that drives the Sepolia registry pipeline in chainAnchor).
//
// Fail-closed: an unsupported EXPLICIT value yields { unsupported } — the
// caller refuses to anchor and never silently selects another chain. When
// POLYGON_NETWORK is unset, the documented current-stage default
// `polygon_amoy` is used so the running app is not broken before the operator
// adds the secret. Set POLYGON_NETWORK explicitly to remove the default.
export function resolvePolygonTarget(): PolygonTargetResolution {
  const raw = String(Deno.env.get('POLYGON_NETWORK') || '').trim().toLowerCase();
  if (raw === '') return { target: 'polygon_amoy' };
  if (raw === 'polygon_amoy' || raw === 'amoy') return { target: 'polygon_amoy' };
  if (raw === 'polygon_mainnet' || raw === 'polygon' || raw === 'mainnet') return { target: 'polygon_mainnet' };
  return { unsupported: true, value: raw };
}

// ── The ONE network configuration resolver (§2) ──────────────────────────────
// Returns per-network chain/rpc/signer metadata. signingKey/expectedSignerAddress
// are null when the corresponding secret is absent. Calldata verification uses
// the mainnet public anchor address, or derives Amoy's address from its existing
// issuer key. Verification never signs anything.
export function resolvePolygonConfig(target: TargetNetwork) {
  if (target === 'polygon_mainnet') {
    return {
      target,
      chain: polygonMainnet,
      chainId: 137,
      networkName: 'polygon',
      isTestnet: false,
      rpc: Deno.env.get('POLYGON_MAINNET_RPC_URL') || null,                 // NO fallback (§5)
      expectedSignerAddress: Deno.env.get('POLYGON_MAINNET_ANCHOR_ADDRESS') || null,
      signingKey: Deno.env.get('POLYGON_MAINNET_ISSUER_PRIVATE_KEY') || null,
      contract: null,                                                        // mainnet = calldata only (§8)
    };
  }
  return {
    target: 'polygon_amoy' as const,
    chain: polygonAmoy,
    chainId: 80002,
    networkName: 'polygon_amoy',
    isTestnet: true,
    rpc: Deno.env.get('POLYGON_RPC_URL') || 'https://polygon-amoy-bor-rpc.publicnode.com', // preserved fallback
    expectedSignerAddress: null,
    signingKey: Deno.env.get('ISSUER_PRIVATE_KEY') || null,
    contract: Deno.env.get('BLOCKWARD_CONTRACT_ADDRESS') || null,            // amoy contract mode (optional)
  };
}

// Resolve the verification network from the credential's PERSISTED anchor
// metadata — never from the live issuance env (§1). chain_id is authoritative;
// network string is the fallback; Amoy is the conservative default.
function resolveVerificationTarget(cred: any): TargetNetwork {
  const bc = cred?.blockchain || {};
  if (bc.chain_id === 137) return 'polygon_mainnet';
  if (bc.chain_id === 80002) return 'polygon_amoy';
  const net = String(bc.network || '').toLowerCase();
  if (net === 'polygon' || net === 'polygon_mainnet') return 'polygon_mainnet';
  return 'polygon_amoy'; // conservative — never reinterpret as mainnet
}

// The on-chain commitment payload — public references and the content hash
// ONLY. This exact string is what integrity verification compares against.
// UNCHANGED (§8).
function buildCommitmentPayload(bwId: string, hash: string): string {
  return JSON.stringify({ v: 1, t: 'blockward-anchor', id: bwId, hv: CREDENTIAL_HASH_VERSION, h: hash });
}

function commitmentFromPayload(input: string, cred: any): string | null {
  try {
    const meta = JSON.parse(input);
    // v is the payload format version; hv is the credential hash format.
    // Production V1 has no separate credential revision field. If a payload
    // includes one, it must agree with the persisted credential revision.
    const hashVersion = cred.hash_version ?? CREDENTIAL_HASH_VERSION;
    if (meta?.v !== 1 || meta?.t !== 'blockward-anchor'
      || typeof cred.bw_id !== 'string' || !cred.bw_id
      || meta.id !== cred.bw_id
      || hashVersion !== CREDENTIAL_HASH_VERSION || meta.hv !== hashVersion
      || ('ver' in meta && meta.ver !== (cred.version ?? 1))
      || ('version' in meta && meta.version !== (cred.version ?? 1))
      || typeof meta.h !== 'string' || !/^[0-9a-f]{64}$/.test(meta.h)) return null;
    return meta.h;
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
    // Issuance network comes from the dedicated POLYGON_NETWORK selector (§4),
    // NOT from the legacy NETWORK variable. An unsupported explicit value
    // fails CLOSED — no silent fallback, no broadcast.
    const resolved = resolvePolygonTarget();
    if ('unsupported' in resolved) {
      log('unsupported_network', { value: resolved.value });
      return { ok: false, error: 'unsupported_network', value: resolved.value };
    }
    const target = resolved.target;
    const cfg = resolvePolygonConfig(target);

    // ── MAINNET FAIL-CLOSED (§5): all production config required BEFORE signing ──
    if (target === 'polygon_mainnet') {
      const missing: string[] = [];
      if (!cfg.rpc) missing.push('POLYGON_MAINNET_RPC_URL');
      if (!cfg.expectedSignerAddress) missing.push('POLYGON_MAINNET_ANCHOR_ADDRESS');
      if (!cfg.signingKey) missing.push('POLYGON_MAINNET_ISSUER_PRIVATE_KEY');
      if (missing.length) {
        log('mainnet_config_missing', { missing });
        // Never expose secret values; never broadcast.
        return { ok: false, error: 'mainnet_config_missing', missing };
      }
    } else if (!cfg.signingKey) {
      // Amoy missing key — preserved skip behaviour (no broadcast).
      log('skip', { reason: 'missing_issuer_key' });
      return { ok: false, skipped: true, reason: 'missing_issuer_key' };
    }

    const rows = await svc.entities.Credential.filter({ id: credentialId });
    cred = rows?.[0] || null;
    if (!cred) return { ok: false, error: 'credential_not_found' };

    // Idempotent — already anchored, never re-anchor (§14/§9).
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

    // ── The commitment: BW-HASH-V1 hash of the CURRENT credential content (UNCHANGED) ──
    const hash = await computeCredentialHash({
      verification_id: cred.bw_id,
      version: cred.hash_version === 2 ? 2 : 1,
      achievement_title: cred.title,
      achievement_category: cred.category,
      achievement_description: cred.description || '',
      date_achieved: cred.date_achieved,
    });
    const payload = buildCommitmentPayload(cred.bw_id, hash);
    const account = privateKeyToAccount(cfg.signingKey as `0x${string}`);

    // ── SIGNER ADDRESS GUARD (§6) — mainnet only, BEFORE any broadcast ──
    if (target === 'polygon_mainnet' && cfg.expectedSignerAddress) {
      if (account.address.toLowerCase() !== String(cfg.expectedSignerAddress).toLowerCase()) {
        log('signer_address_mismatch', {});
        await markFailed('signer_address_mismatch');
        return { ok: false, error: 'signer_address_mismatch' };
      }
    }

    const pub = createPublicClient({ chain: cfg.chain, transport: http(cfg.rpc as string) });
    const wal = createWalletClient({ account, chain: cfg.chain, transport: http(cfg.rpc as string) });

    // ── CHAIN-ID GUARD (§7) — live RPC must equal the configured target ──
    const chainId = await pub.getChainId().catch(() => null);
    if (chainId !== cfg.chainId) {
      await markFailed('wrong_chain', `chainId ${chainId} expected ${cfg.chainId}`);
      return { ok: false, error: 'wrong_chain', chainId, expected: cfg.chainId };
    }

    let txHash: string;
    if (cfg.contract) {
      // Amoy contract anchor mode — BlockwardRegistry.anchor(bytes32, string)
      const sim = await pub.simulateContract({
        account, address: cfg.contract as `0x${string}`, abi: CONTRACT_ABI,
        functionName: 'anchor',
        args: [(`0x${hash.slice(0, 64)}`) as `0x${string}`, cred.bw_id],
      });
      txHash = await wal.writeContract(sim.request);
    } else {
      // Calldata anchor mode (UNCHANGED §8) — a 0-value self-transaction
      // whose input data permanently records the commitment on Polygon PoS.
      txHash = await wal.sendTransaction({
        to: account.address,
        value: 0n,
        data: stringToHex(payload),
      });
    }
    log('sent', { txHash, mode: cfg.contract ? 'contract' : 'calldata', network: cfg.networkName });

    const receipt = await pub.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status !== 'success') {
      await markFailed('tx_reverted', txHash);
      return { ok: false, error: 'tx_reverted', transaction_hash: txHash };
    }
    const blockTimestamp = receipt.blockTimestamp
      ? new Date(Number(receipt.blockTimestamp)).toISOString()
      : new Date().toISOString();
    log('anchored', { txHash, block: String(receipt.blockNumber), network: cfg.networkName });

    const blockchain = {
      status: 'confirmed',
      network: cfg.networkName,          // 'polygon_amoy' | 'polygon' — pins verification
      chain_id: cfg.chainId,             // 80002 | 137 — pins verification (§1)
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
        note: `Polygon PoS anchor confirmed (${cfg.networkName}, tx ${String(receipt.transactionHash).slice(0, 18)}…)`,
        timestamp: new Date().toISOString(),
      }]),
    }).catch(() => {});

    return { ok: true, transaction_hash: receipt.transactionHash, credential_hash: hash, network: cfg.networkName, testnet: cfg.isTestnet };
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
//
// NETWORK-PINNED (§1): the verification network is resolved from the
// credential's persisted blockchain.chain_id/network, NOT from the live
// issuance env. An Amoy credential stays verifiable on Amoy forever, even
// after issuance switches to mainnet.

export async function verifyCredentialAnchor(svc, cred: any) {
  const bc = cred.blockchain || {};
  const anchorState = cred.anchor_status || bc.status;

  if (anchorState !== 'confirmed' || !bc.transaction_hash) {
    const pendingTarget = resolveVerificationTarget(cred);
    const pendingCfg = resolvePolygonConfig(pendingTarget);
    return { status: anchorState === 'processing' || anchorState === 'confirmed' ? 'pending' : (anchorState || 'pending'), network: pendingCfg.networkName, testnet: pendingCfg.isTestnet };
  }

  // TTL cache — confirmed/mismatch 10 min, everything else 2 min. Cache is
  // per-credential, and each credential is anchored on exactly one network,
  // so there is no cross-network contamination.
  const cached = cred.chain_check || null;
  // Calldata must pass fresh checks, including receipts and current content.
  // Never accept a cached confirmation produced by the old hash-only verifier.
  if (bc.anchor_mode === 'contract' && bc.contract_address && cached && cached.checked_at) {
    const age = Date.now() - new Date(cached.checked_at).getTime();
    const ttl = ['confirmed', 'hash_mismatch'].includes(cached.status) ? CONFIRM_TTL_MS : FAIL_TTL_MS;
    if (age >= 0 && age < ttl) return cached;
  }

  // ── NETWORK-PINNED resolution (the §1 fix) ──
  const target = resolveVerificationTarget(cred);
  const cfg = resolvePolygonConfig(target);

  const result: any = {
    status: 'chain_unavailable',
    network: cfg.networkName,
    testnet: cfg.isTestnet,
    chain_id: cfg.chainId,
    checked_at: new Date().toISOString(),
    transaction_hash: bc.transaction_hash,
    contract_address: bc.contract_address || null,
  };
  // Persist failures too: an old confirmation must not survive a fresh check
  // that rejects its sender, receipt, chain or configuration.
  const finish = async (checked: any) => {
    if (svc && cred.id) {
      try {
        await svc.entities.Credential.update(cred.id, { chain_check: checked });
      } catch { /* best-effort */ }
    }
    return checked;
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
    const pub = createPublicClient({ chain: cfg.chain, transport: http(cfg.rpc as string) });

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
      const invalid = (reason: string) => finish({ ...result, status: 'anchor_invalid', reason });
      // Do not reinterpret an explicitly unknown chain as the fallback network.
      if (bc.chain_id != null && bc.chain_id !== cfg.chainId) return invalid('unsupported_pinned_chain');
      if (!cfg.rpc) return finish({ ...result, reason: 'missing_rpc_config' });
      let expectedSigner: string;
      try {
        expectedSigner = target === 'polygon_mainnet'
          ? String(cfg.expectedSignerAddress || '')
          : privateKeyToAccount(cfg.signingKey as `0x${string}`).address;
      } catch {
        return finish({ ...result, reason: 'missing_or_invalid_anchor_config' });
      }
      if (!/^0x[0-9a-fA-F]{40}$/.test(expectedSigner)) {
        return finish({ ...result, reason: 'missing_or_invalid_anchor_config' });
      }
      const sameAddress = (value: unknown) => typeof value === 'string'
        && value.toLowerCase() === expectedSigner.toLowerCase();
      if (await pub.getChainId() !== cfg.chainId) return invalid('wrong_chain');

      const tx = await pub.getTransaction({ hash: bc.transaction_hash as `0x${string}` });
      if (!tx) return invalid('transaction_not_found');
      const receipt = await pub.getTransactionReceipt({ hash: bc.transaction_hash as `0x${string}` });
      if (!receipt || receipt.status !== 'success') return invalid('receipt_not_successful');
      const sameHash = (a: unknown, b: unknown) => typeof a === 'string' && typeof b === 'string'
        && /^0x[0-9a-fA-F]{64}$/.test(a) && a.toLowerCase() === b.toLowerCase();
      if (!sameHash(tx.hash, bc.transaction_hash) || !sameHash(receipt.transactionHash, bc.transaction_hash)
        || tx.blockNumber == null || receipt.blockNumber == null || tx.blockNumber !== receipt.blockNumber
        || !sameHash(tx.blockHash, receipt.blockHash)) return invalid('transaction_receipt_mismatch');
      if (tx.chainId != null && tx.chainId !== cfg.chainId) return invalid('wrong_transaction_chain');
      if (!sameAddress(tx.from) || !sameAddress(receipt.from)) return invalid('wrong_sender');
      if (!sameAddress(tx.to) || !sameAddress(receipt.to)) return invalid('wrong_recipient');
      if (tx.value !== 0n) return invalid('nonzero_anchor_value');

      let committedBytes: string | null = null;
      try {
        committedBytes = commitmentFromPayload(
          new TextDecoder('utf-8', { fatal: true }).decode(hexToBytes(tx.input)), cred);
      } catch { /* malformed hex/UTF-8 is never a commitment */ }
      result.committed_hash = committedBytes;
      if (!committedBytes) {
        result.status = 'anchor_invalid';
        result.reason = 'commitment_not_found_in_tx';
      } else if (committedBytes !== recomputed) {
        result.status = 'hash_mismatch';
      } else {
        result.status = 'confirmed';
      }
    }
  } catch {
    return finish({ ...result, status: 'chain_unavailable', reason: 'rpc_error' });
  }

  return finish(result);
}

function hexToBytes(hex: string): Uint8Array {
  if (typeof hex !== 'string' || !/^0x(?:[0-9a-fA-F]{2})+$/.test(hex)) throw new Error('Invalid calldata hex');
  const h = hex.slice(2);
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}
