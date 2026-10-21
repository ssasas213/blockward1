// ============================================================================
// amoyStaging — ISOLATED Polygon Amoy staging broadcaster.
//
// HARD ISOLATION from production:
//   • Reads ONLY AMOY_STAGING_* secrets. NEVER reads POLYGON_MAINNET_*,
//     ISSUER_PRIVATE_KEY, POLYGON_NETWORK, or MAINNET_BROADCAST_ENABLED.
//   • Hardcodes Polygon Amoy (chain ID 80002). There is NO env selector and
//     NO fallback to mainnet — this module cannot broadcast on mainnet even
//     if every production secret is set.
//   • The staging signer address is validated against AMOY_STAGING_ANCHOR_ADDRESS
//     before any broadcast — a mismatch fails closed.
//   • The live RPC chain ID must equal 80002 — a mismatch fails closed.
//   • The transaction is a 0-value self-tx (commitment-only calldata), exactly
//     as the production batch anchor.
//   • The 12s receipt timeout returns receipt_pending — the staging test
//     function reconciles immediately, never waiting for the 5-min worker.
//
// This module is imported ONLY by the amoyStagingTest backend function. No
// production code, workflow, or scheduled worker references it.
// ============================================================================
import { createPublicClient, createWalletClient, http, stringToHex, defineChain } from 'npm:viem@2.7.0';
import { privateKeyToAccount } from 'npm:viem@2.7.0/accounts';

// Hardcoded Amoy chain — the ONLY chain this module can reach.
const AMOY_CHAIN = defineChain({
  id: 80002,
  name: 'Polygon Amoy (staging)',
  nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc-amoy.polygon.technology'] } },
  blockExplorers: { default: { name: 'PolygonScan', url: 'https://amoy.polygonscan.com' } },
  testnet: true,
});

export const AMOY_STAGING_CHAIN_ID = 80002;

export interface AmoyStagingConfig {
  signingKey: string;
  signerAddress: string;
  rpc: string;
  chainId: number;
}

// Resolve the staging config from AMOY_STAGING_* secrets ONLY.
// Returns { ok: false, error } if any secret is missing — never falls back.
export function resolveAmoyStagingConfig(envFn: (n: string) => string | null | undefined = (n) => (typeof Deno !== 'undefined' ? Deno.env.get(n) : null)): { ok: true; config: AmoyStagingConfig } | { ok: false; error: string; missing: string[] } {
  const missing: string[] = [];
  const signingKey = envFn('AMOY_STAGING_PRIVATE_KEY');
  const signerAddress = envFn('AMOY_STAGING_ANCHOR_ADDRESS');
  const rpc = envFn('AMOY_STAGING_RPC_URL');
  if (!signingKey) missing.push('AMOY_STAGING_PRIVATE_KEY');
  if (!signerAddress) missing.push('AMOY_STAGING_ANCHOR_ADDRESS');
  if (!rpc) missing.push('AMOY_STAGING_RPC_URL');
  if (missing.length) return { ok: false, error: 'staging_config_missing', missing };
  return { ok: true, config: { signingKey, signerAddress, rpc, chainId: AMOY_STAGING_CHAIN_ID } };
}

// The batch commitment payload — identical format to production
// (buildBatchPayload in chainPolygon.ts) so the on-chain commitment is
// compatible with the production verifier. Staging records use the same
// payload shape but are NEVER written to production AnchorBatch records.
export function buildStagingBatchPayload(rootHex: string, memberCount: number): string {
  return JSON.stringify({ v: 1, t: 'blockward-batch', hv: 1, n: memberCount, r: rootHex });
}

export function parseStagingBatchPayload(input: string): { root: string; memberCount: number } | null {
  try {
    const meta = JSON.parse(input);
    if (meta?.v !== 1 || meta?.t !== 'blockward-batch' || meta?.hv !== 1
      || !Number.isInteger(meta?.n) || meta.n < 1
      || typeof meta.r !== 'string' || !/^[0-9a-f]{64}$/.test(meta.r)) return null;
    return { root: meta.r, memberCount: meta.n };
  } catch { return null; }
}

// Sign and broadcast ONE batch transaction on Polygon Amoy using the staging key.
// All guards: config required, signer address match, live chain-id match (80002),
// zero-value self-tx, commitment-only calldata, 12s receipt timeout.
export async function anchorStagingBatch(opts: { rootHex: string; memberCount: number }): Promise<{
  ok: true;
  transaction_hash: string;
  block_number: number;
  block_timestamp: string;
  gas_used: number | null;
  effective_gas_price_wei: string | null;
  network: string;
  chain_id: number;
  testnet: boolean;
  broadcast_at: string;
} | {
  ok: true;
  submitted: true;
  receipt_pending: true;
  receipt_timed_out: boolean;
  transaction_hash: string;
  network: string;
  chain_id: number;
  testnet: boolean;
  broadcast_at: string;
} | { ok: false; error: string; missing?: string[] }> {
  const log = (step: string, extra: Record<string, unknown> = {}) =>
    console.log(JSON.stringify({ fn: 'amoyStaging.batch', step, ...extra }));

  try {
    // Normalize the root — bare 64-hex, no 0x prefix.
    const rootHex = String(opts.rootHex || '').trim().toLowerCase().replace(/^0x/, '');
    if (!/^[0-9a-f]{64}$/.test(rootHex)) return { ok: false, error: 'invalid_root' };
    if (!Number.isInteger(opts.memberCount) || opts.memberCount < 1) return { ok: false, error: 'invalid_member_count' };

    const resolved = resolveAmoyStagingConfig();
    if (!resolved.ok) {
      log('staging_config_missing', { missing: resolved.missing });
      return { ok: false, error: 'staging_config_missing', missing: resolved.missing };
    }
    const cfg = resolved.config;

    // Derive the account from the staging key.
    const account = privateKeyToAccount(cfg.signingKey as `0x${string}`);

    // SIGNER ADDRESS GUARD — the staging key's address must match the
    // declared AMOY_STAGING_ANCHOR_ADDRESS. A mismatch fails closed.
    if (account.address.toLowerCase() !== cfg.signerAddress.toLowerCase()) {
      log('signer_address_mismatch', { expected: cfg.signerAddress.slice(0, 10) + '…', actual: account.address.slice(0, 10) + '…' });
      return { ok: false, error: 'signer_address_mismatch' };
    }

    const pub = createPublicClient({ chain: AMOY_CHAIN, transport: http(cfg.rpc) });
    const wal = createWalletClient({ account, chain: AMOY_CHAIN, transport: http(cfg.rpc) });

    // CHAIN-ID GUARD — the live RPC must report chain ID 80002 (Amoy).
    // This is the PRIMARY isolation check: if the RPC somehow points to
    // mainnet (chain ID 137), this guard rejects the broadcast.
    const liveChainId = await pub.getChainId().catch(() => null);
    if (liveChainId !== cfg.chainId) {
      log('wrong_chain', { live: liveChainId, expected: cfg.chainId });
      return { ok: false, error: 'wrong_chain', live: liveChainId, expected: cfg.chainId };
    }

    const payload = buildStagingBatchPayload(rootHex, opts.memberCount);
    const broadcastAt = new Date().toISOString();

    // Broadcast — 0-value self-tx with commitment-only calldata.
    const txHash = await wal.sendTransaction({
      to: account.address,
      value: 0n,
      data: stringToHex(payload),
    });
    log('sent', { txHash, members: opts.memberCount, chain_id: cfg.chainId, broadcast_at: broadcastAt });

    // Bounded receipt wait (12s) — same as production anchorBatchRoot.
    let receipt: any = null;
    try {
      receipt = await pub.waitForTransactionReceipt({ hash: txHash, timeout: 12000 });
      if (receipt.status !== 'success') {
        log('reverted', { txHash });
        return { ok: false, error: 'tx_reverted', transaction_hash: txHash } as any;
      }
    } catch (e: any) {
      const isTimeout = String(e?.name || e?.message || '').toLowerCase().includes('timeout');
      // Receipt not available within 12s — return receipt_pending for immediate
      // reconciliation by the staging test function (not the 5-min worker).
      log('receipt_pending', { txHash, timed_out: isTimeout });
      return {
        ok: true, submitted: true, receipt_pending: true, receipt_timed_out: isTimeout,
        transaction_hash: txHash, network: 'polygon_amoy', chain_id: cfg.chainId, testnet: true,
        broadcast_at: broadcastAt,
      };
    }

    log('anchored', { txHash, block: String(receipt.blockNumber), gas: String(receipt.gasUsed) });
    return {
      ok: true,
      transaction_hash: receipt.transactionHash,
      block_number: Number(receipt.blockNumber || 0),
      block_timestamp: receipt.blockTimestamp ? new Date(Number(receipt.blockTimestamp)).toISOString() : new Date().toISOString(),
      gas_used: receipt.gasUsed != null ? Number(receipt.gasUsed) : null,
      effective_gas_price_wei: receipt.effectiveGasPrice != null ? String(receipt.effectiveGasPrice) : null,
      network: 'polygon_amoy',
      chain_id: cfg.chainId,
      testnet: true,
      broadcast_at: broadcastAt,
    };
  } catch (e) {
    log('error', { err: String(e?.message || e).slice(0, 300) });
    return { ok: false, error: String(e?.message || e).slice(0, 300) };
  }
}

// Reconcile a pending receipt (non-blocking check) for a staging broadcast.
// Does NOT sign — only reads the receipt from Amoy.
export async function reconcileStagingReceipt(opts: { transactionHash: string }): Promise<{
  ok: true;
  confirmed: boolean;
  transaction_hash: string;
  block_number: number;
  block_timestamp: string;
  gas_used: number | null;
  effective_gas_price_wei: string | null;
} | { ok: false; error: string }> {
  const log = (step: string, extra: Record<string, unknown> = {}) =>
    console.log(JSON.stringify({ fn: 'amoyStaging.reconcile', step, ...extra }));

  try {
    const resolved = resolveAmoyStagingConfig();
    if (!resolved.ok) return { ok: false, error: 'staging_config_missing' };
    const cfg = resolved.config;

    const pub = createPublicClient({ chain: AMOY_CHAIN, transport: http(cfg.rpc) });
    const liveChainId = await pub.getChainId().catch(() => null);
    if (liveChainId !== cfg.chainId) return { ok: false, error: 'wrong_chain' };

    const receipt = await pub.getTransactionReceipt({ hash: opts.transactionHash as `0x${string}` }).catch(() => null);
    if (!receipt) return { ok: true, confirmed: false, transaction_hash: opts.transactionHash, block_number: 0, block_timestamp: '', gas_used: null, effective_gas_price_wei: null };
    if (receipt.status !== 'success') {
      log('reverted', { txHash: opts.transactionHash });
      return { ok: false, error: 'tx_reverted' };
    }

    log('confirmed', { txHash: opts.transactionHash, block: String(receipt.blockNumber) });
    return {
      ok: true,
      confirmed: true,
      transaction_hash: receipt.transactionHash,
      block_number: Number(receipt.blockNumber || 0),
      block_timestamp: receipt.blockTimestamp ? new Date(Number(receipt.blockTimestamp)).toISOString() : new Date().toISOString(),
      gas_used: receipt.gasUsed != null ? Number(receipt.gasUsed) : null,
      effective_gas_price_wei: receipt.effectiveGasPrice != null ? String(receipt.effectiveGasPrice) : null,
    };
  } catch (e) {
    log('error', { err: String(e?.message || e).slice(0, 300) });
    return { ok: false, error: String(e?.message || e).slice(0, 300) };
  }
}

// Read-only Amoy chain-id probe for isolation validation. Never signs.
export async function probeAmoyChainId(): Promise<{ ok: true; chain_id: number; is_amoy: boolean } | { ok: false; error: string }> {
  const resolved = resolveAmoyStagingConfig();
  if (!resolved.ok) return { ok: false, error: 'staging_config_missing' };
  const cfg = resolved.config;
  const pub = createPublicClient({ chain: AMOY_CHAIN, transport: http(cfg.rpc) });
  const liveChainId = await pub.getChainId().catch(() => null);
  return { ok: true, chain_id: liveChainId ?? -1, is_amoy: liveChainId === cfg.chainId };
}