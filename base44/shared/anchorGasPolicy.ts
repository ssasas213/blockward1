// ============================================================================
// anchorGasPolicy — the central, server-side gas & cost policy for Polygon
// anchoring. Pure math + configuration (no I/O here except the optional POL
// price fetch, which lives behind an injected fetcher so it stays testable).
//
// TWO SEPARATE CEILINGS (deliberately):
//   • mainnetIntegrationPolicy.ts  HARD_MAX_FEE_WEI (0.01 POL) — the ISOLATED
//     integration-TEST ceiling. UNTOUCHED by this module; never weakened.
//   • THIS policy — the production operational budget, configurable via env:
//       ANCHOR_MAX_BATCH_COST_USD    per-batch cost gate    (default 3.00)
//       ANCHOR_ABSOLUTE_MAX_COST_USD absolute automatic cap (default 5.00)
//       ANCHOR_MAX_FEE_GWEI          per-gas-unit ceiling    (default 200)
//       ANCHOR_GAS_LIMIT             tx gas limit            (default 60000)
//     The absolute cap is never exceeded automatically: when fees rise above
//     what the approved budget allows, the batch enters ANCHOR_PENDING_FEE,
//     administrators are notified, and the credential is preserved for a
//     later, cheaper attempt — never dropped, never force-spent.
// ============================================================================

export const ANCHOR_POLICY_DEFAULTS = {
  batchMaxSize: 500,
  batchWindowMinutes: 10,
  targetMinutes: 15,
  escalationMinutes: 60,
  criticalMinutes: 1440,
  maxAttempts: 8,
  baseBackoffSeconds: 300,
  maxBatchCostUsd: 3.0,
  absoluteMaxCostUsd: 5.0,
  maxFeeGwei: 200,
  gasLimit: 60000,
  fallbackPolUsd: 0.30,
};

function num(raw: string | null | undefined, fallback: number, min: number, max: number): number {
  const n = Number(String(raw ?? '').trim());
  if (!Number.isFinite(n) || n < min || n > max) return fallback;
  return n;
}

// envFn: (name) => string | null | undefined — injectable for tests.
export function resolveAnchorPolicy(envFn: (n: string) => string | null | undefined = (n) => (typeof Deno !== 'undefined' ? Deno.env.get(n) : null)) {
  const d = ANCHOR_POLICY_DEFAULTS;
  const policy = {
    batchMaxSize: Math.round(num(envFn('ANCHOR_BATCH_MAX_SIZE'), d.batchMaxSize, 1, 5000)),
    batchWindowMinutes: num(envFn('ANCHOR_BATCH_WINDOW_MINUTES'), d.batchWindowMinutes, 1, 120),
    targetMinutes: num(envFn('ANCHOR_TARGET_MINUTES'), d.targetMinutes, 5, 120),
    escalationMinutes: num(envFn('ANCHOR_ESCALATION_MINUTES'), d.escalationMinutes, 10, 10080),
    criticalMinutes: num(envFn('ANCHOR_CRITICAL_MINUTES'), d.criticalMinutes, 60, 20160),
    maxAttempts: Math.round(num(envFn('ANCHOR_MAX_ATTEMPTS'), d.maxAttempts, 1, 30)),
    baseBackoffSeconds: num(envFn('ANCHOR_BASE_BACKOFF_SECONDS'), d.baseBackoffSeconds, 30, 86400),
    maxBatchCostUsd: num(envFn('ANCHOR_MAX_BATCH_COST_USD'), d.maxBatchCostUsd, 0.05, 1000),
    absoluteMaxCostUsd: num(envFn('ANCHOR_ABSOLUTE_MAX_COST_USD'), d.absoluteMaxCostUsd, 0.1, 1000),
    maxFeeGwei: num(envFn('ANCHOR_MAX_FEE_GWEI'), d.maxFeeGwei, 1, 2000),
    gasLimit: Math.round(num(envFn('ANCHOR_GAS_LIMIT'), d.gasLimit, 21000, 500000)),
    fallbackPolUsd: num(envFn('ANCHOR_FALLBACK_POL_USD'), d.fallbackPolUsd, 0.001, 100),
  };
  // The absolute cap must never sit below the per-batch budget.
  if (policy.absoluteMaxCostUsd < policy.maxBatchCostUsd) policy.absoluteMaxCostUsd = policy.maxBatchCostUsd;
  return policy;
}

// Exponential backoff with a ceiling: base * 2^attempt, capped at 6 h.
export function backoffSeconds(policy: ReturnType<typeof resolveAnchorPolicy>, attempt: number): number {
  const raw = policy.baseBackoffSeconds * Math.pow(2, Math.max(0, attempt - 1));
  return Math.min(raw, 6 * 3600);
}

// ── Cost estimation ──────────────────────────────────────────────────────────
// The batch transaction is a 0-value self-tx whose calldata permanently records
// the batch commitment. Data gas: 16/byte nonzero, 4/byte zero (EIP-2028),
// on top of the 21000 base. A 15% headroom is added for signature/scheme
// variance; the RPC's own estimate, when available, takes precedence.

export function estimateBatchGas(payloadText: string, policy: ReturnType<typeof resolveAnchorPolicy>, rpcEstimate?: number | null): number {
  const bytes = new TextEncoder().encode(payloadText);
  let dataGas = 0;
  for (const b of bytes) dataGas += b === 0 ? 4 : 16;
  const manual = Math.ceil((21000 + dataGas) * 1.15);
  const est = Number.isFinite(rpcEstimate as number) && (rpcEstimate as number) > 0 ? Math.ceil((rpcEstimate as number) * 1.15) : manual;
  return Math.min(est, policy.gasLimit);
}

export function gweiToWeiPerGas(gwei: number): bigint {
  return BigInt(Math.round(gwei * 1e9));
}

export function weiToPol(wei: bigint): string {
  const whole = wei / 10n ** 18n;
  const fraction = (wei % 10n ** 18n).toString().padStart(18, '0').replace(/0+$/, '');
  return `${whole}${fraction ? `.${fraction}` : ''}`;
}

export function weiToUsd(wei: bigint, polUsd: number): number {
  return Math.round((Number(wei) / 1e18) * polUsd * 10000) / 10000;
}

export function feeDecision(
  gasUnits: number,
  maxFeePerGasWei: bigint,
  polUsd: number,
  policy: ReturnType<typeof resolveAnchorPolicy>,
): { allowed: boolean; reason: string | null; estFeeWei: bigint; estUsd: number } {
  const estFeeWei = BigInt(gasUnits) * maxFeePerGasWei;
  const estUsd = weiToUsd(estFeeWei, polUsd);
  if (maxFeePerGasWei > gweiToWeiPerGas(policy.maxFeeGwei)) {
    return { allowed: false, reason: 'fee_ceiling_gwei', estFeeWei, estUsd };
  }
  if (estUsd > policy.absoluteMaxCostUsd) {
    return { allowed: false, reason: 'absolute_cost_cap', estFeeWei, estUsd };
  }
  if (estUsd > policy.maxBatchCostUsd) {
    return { allowed: false, reason: 'batch_budget_exceeded', estFeeWei, estUsd };
  }
  return { allowed: true, reason: null, estFeeWei, estUsd };
}

// ── Scalability projection (§D) — estimated per-credential blockchain cost ──
// At volume the batch payload is a ~200-byte root commitment (constant), so a
// full batch of N shares one near-constant transaction. Low volumes pay the
// batching window with smaller batches, so per-credential cost is higher.
export function volumeCostTable(policy: ReturnType<typeof resolveAnchorPolicy>, polUsd: number, batchAnchorGasUnits: number) {
  const volumes = [100, 1000, 10000, 100000];
  const feePerGas = gweiToWeiPerGas(policy.maxFeeGwei); // conservative worst case
  return volumes.map((v) => {
    const batchSize = Math.min(policy.batchMaxSize, v);
    const batches = Math.ceil(v / batchSize);
    const perCredWei = (BigInt(batchAnchorGasUnits) * feePerGas) / BigInt(batchSize);
    return {
      volume: v,
      batch_size: batchSize,
      batches: batches,
      est_cost_per_credential_usd: weiToUsd(perCredWei, polUsd),
      est_total_cost_usd: weiToUsd(BigInt(batchAnchorGasUnits) * feePerGas * BigInt(batches), polUsd),
    };
  });
}

// POL/USD — cached 10 min. Any failure falls back to a conservative constant
// clearly labelled 'fallback_estimate' (cost decisions stay safe: the fallback
// price is a floor, not a promise).
let priceCache: { usd: number; source: string; at: number } | null = null;
export async function polUsdPrice(fetchImpl: typeof fetch = fetch): Promise<{ usd: number; source: string }> {
  if (priceCache && Date.now() - priceCache.at < 10 * 60 * 1000) {
    return { usd: priceCache.usd, source: priceCache.source };
  }
  try {
    const res = await fetchImpl('https://api.coingecko.com/api/v3/simple/price?ids=polygon-ecosystem-token&vs_currencies=usd', {
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json();
    const usd = Number(data?.['polygon-ecosystem-token']?.usd);
    if (Number.isFinite(usd) && usd > 0) {
      priceCache = { usd, source: 'coingecko', at: Date.now() };
      return { usd, source: 'coingecko' };
    }
  } catch { /* fall through */ }
  const d = ANCHOR_POLICY_DEFAULTS.fallbackPolUsd;
  return { usd: d, source: 'fallback_estimate' };
}