// ============================================================================
// broadcast — Polygon Amoy batch-root broadcast + receipt reconciliation.
//
// Uses viem (Node-compatible imports, no Deno npm: specifiers). Hardcodes the
// Amoy chain — there is no mainnet chain definition and no network selector.
//
// Guards (all fail-closed, all run before any broadcast):
//   1. Config required — all AMOY_STAGING_* secrets present
//   2. Signer address match — derived address === declared address
//   3. Live chain-ID match — RPC reports 80002
//
// The transaction is a 0-value self-tx with commitment-only calldata, exactly
// as the production batch anchor. Receipt wait is bounded at 12s — if the
// receipt doesn't arrive, the harness reconciles at 4s + 4s (mirrors the
// production Anchor Batch Flush retry loop).
// ============================================================================

import { createPublicClient, createWalletClient, http, stringToHex, defineChain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { resolveConfig, AMOY_CHAIN_ID, type StagingConfig } from './config.ts';
import {
  validateConfigPresent,
  validateSignerAddressMatch,
  validateChainId,
  validateRootHex,
  validateMemberCount,
  type GuardResult,
} from './guards.ts';
import { buildBatchPayload } from './commitments.ts';
import { safeLog } from './sanitise.ts';

const AMOY_CHAIN = defineChain({
  id: 80002,
  name: 'Polygon Amoy (staging harness)',
  nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc-amoy.polygon.technology'] } },
  blockExplorers: { default: { name: 'PolygonScan', url: 'https://amoy.polygonscan.com' } },
  testnet: true,
});

export interface BroadcastSuccess {
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
  confirm_at: string;
  latency_ms: number;
}

export interface BroadcastPending {
  ok: true;
  submitted: true;
  receipt_pending: true;
  receipt_timed_out: boolean;
  transaction_hash: string;
  network: string;
  chain_id: number;
  testnet: boolean;
  broadcast_at: string;
}

export interface BroadcastFailure {
  ok: false;
  error: string;
  missing?: string[];
  [key: string]: unknown;
}

export type BroadcastResult = BroadcastSuccess | BroadcastPending | BroadcastFailure;

export type ReconcileResult =
  | {
      ok: true;
      confirmed: boolean;
      transaction_hash: string;
      block_number: number;
      block_timestamp: string;
      gas_used: number | null;
      effective_gas_price_wei: string | null;
    }
  | { ok: false; error: string };

function fail(guard: GuardResult): BroadcastFailure {
  return { ok: false, error: guard.error, missing: (guard as any).missing };
}

export async function broadcastBatchRoot(opts: {
  rootHex: string;
  memberCount: number;
}): Promise<BroadcastResult> {
  // Guard 1: root format
  const rootCheck = validateRootHex(opts.rootHex);
  if (!rootCheck.ok) return fail(rootCheck);

  // Guard 2: member count
  const countCheck = validateMemberCount(opts.memberCount);
  if (!countCheck.ok) return fail(countCheck);

  // Guard 3: config present
  const resolved = resolveConfig();
  const configCheck = validateConfigPresent(resolved);
  if (!configCheck.ok) return fail(configCheck);
  const cfg: StagingConfig = (resolved as any).config;

  // Guard 4: signer address match
  let account;
  try {
    account = privateKeyToAccount(cfg.signingKey as `0x${string}`);
  } catch {
    return { ok: false, error: 'invalid_private_key' };
  }
  const signerCheck = validateSignerAddressMatch(account.address, cfg.signerAddress);
  if (!signerCheck.ok) return fail(signerCheck);

  // Guard 5: live chain-ID match
  const pub = createPublicClient({ chain: AMOY_CHAIN, transport: http(cfg.rpc) });
  const liveChainId = await pub.getChainId().catch(() => null);
  const chainCheck = validateChainId(liveChainId, cfg.chainId);
  if (!chainCheck.ok) return fail(chainCheck);

  // Broadcast — 0-value self-tx with commitment-only calldata
  const wal = createWalletClient({ account, chain: AMOY_CHAIN, transport: http(cfg.rpc) });
  const payload = buildBatchPayload(opts.rootHex, opts.memberCount);
  const broadcastAt = new Date().toISOString();
  const broadcastMs = Date.now();

  let txHash: string;
  try {
    txHash = await wal.sendTransaction({
      to: account.address,
      value: 0n,
      data: stringToHex(payload),
    });
  } catch (e: unknown) {
    return { ok: false, error: 'broadcast_failed', detail: safeLog(e) };
  }

  // Bounded receipt wait (12s) — same as production anchorBatchRoot
  let receipt: any = null;
  try {
    receipt = await pub.waitForTransactionReceipt({ hash: txHash, timeout: 12000 });
    if (receipt.status !== 'success') {
      return { ok: false, error: 'tx_reverted', transaction_hash: txHash };
    }
  } catch (e: any) {
    const isTimeout = String(e?.name || e?.message || '').toLowerCase().includes('timeout');
    return {
      ok: true,
      submitted: true,
      receipt_pending: true,
      receipt_timed_out: isTimeout,
      transaction_hash: txHash,
      network: 'polygon_amoy',
      chain_id: cfg.chainId,
      testnet: true,
      broadcast_at: broadcastAt,
    };
  }

  const confirmMs = Date.now();
  return {
    ok: true,
    transaction_hash: receipt.transactionHash,
    block_number: Number(receipt.blockNumber || 0),
    block_timestamp: receipt.blockTimestamp
      ? new Date(Number(receipt.blockTimestamp)).toISOString()
      : new Date().toISOString(),
    gas_used: receipt.gasUsed != null ? Number(receipt.gasUsed) : null,
    effective_gas_price_wei: receipt.effectiveGasPrice != null ? String(receipt.effectiveGasPrice) : null,
    network: 'polygon_amoy',
    chain_id: cfg.chainId,
    testnet: true,
    broadcast_at: broadcastAt,
    confirm_at: new Date(confirmMs).toISOString(),
    latency_ms: confirmMs - broadcastMs,
  };
}

export async function reconcileReceipt(opts: {
  transactionHash: string;
}): Promise<ReconcileResult> {
  const resolved = resolveConfig();
  if (!resolved.ok) return { ok: false, error: 'staging_config_missing' };
  const cfg = (resolved as any).config;

  const pub = createPublicClient({ chain: AMOY_CHAIN, transport: http(cfg.rpc) });
  const liveChainId = await pub.getChainId().catch(() => null);
  const chainCheck = validateChainId(liveChainId, cfg.chainId);
  if (!chainCheck.ok) return { ok: false, error: 'wrong_chain' };

  const receipt = await pub
    .getTransactionReceipt({ hash: opts.transactionHash as `0x${string}` })
    .catch(() => null);

  if (!receipt) {
    return {
      ok: true,
      confirmed: false,
      transaction_hash: opts.transactionHash,
      block_number: 0,
      block_timestamp: '',
      gas_used: null,
      effective_gas_price_wei: null,
    };
  }

  if (receipt.status !== 'success') {
    return { ok: false, error: 'tx_reverted' };
  }

  return {
    ok: true,
    confirmed: true,
    transaction_hash: receipt.transactionHash,
    block_number: Number(receipt.blockNumber || 0),
    block_timestamp: receipt.blockTimestamp
      ? new Date(Number(receipt.blockTimestamp)).toISOString()
      : new Date().toISOString(),
    gas_used: receipt.gasUsed != null ? Number(receipt.gasUsed) : null,
    effective_gas_price_wei: receipt.effectiveGasPrice != null ? String(receipt.effectiveGasPrice) : null,
  };
}

export async function probeChainId(): Promise<{ ok: true; chain_id: number; is_amoy: boolean } | { ok: false; error: string }> {
  const resolved = resolveConfig();
  if (!resolved.ok) return { ok: false, error: 'staging_config_missing' };
  const cfg = (resolved as any).config;
  const pub = createPublicClient({ chain: AMOY_CHAIN, transport: http(cfg.rpc) });
  const liveChainId = await pub.getChainId().catch(() => null);
  return { ok: true, chain_id: liveChainId ?? -1, is_amoy: liveChainId === cfg.chainId };
}