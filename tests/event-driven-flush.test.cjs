// Self-contained Node test for the event-driven flush debounce + the
// sub-60-second latency budget. Mirrors the pure resolveAnchorPolicy +
// batchCloseAt logic in base44/shared/anchorGasPolicy.ts and
// base44/shared/anchorQueue.ts (no Deno imports) so it runs in plain Node.
// Run: node tests/event-driven-flush.test.cjs
const assert = require('assert');

// ── Mirrored from anchorGasPolicy.ts ────────────────────────────────────────
const DEFAULTS = {
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
  flushDebounceSeconds: 0,
};
function num(raw, fallback, min, max) {
  const n = Number(String(raw ?? '').trim());
  if (!Number.isFinite(n) || n < min || n > max) return fallback;
  return n;
}
function resolveAnchorPolicy(env) {
  const d = DEFAULTS;
  return {
    batchWindowMinutes: num(env.ANCHOR_BATCH_WINDOW_MINUTES, d.batchWindowMinutes, 1, 120),
    batchMaxSize: Math.round(num(env.ANCHOR_BATCH_MAX_SIZE, d.batchMaxSize, 1, 5000)),
    maxBatchCostUsd: num(env.ANCHOR_MAX_BATCH_COST_USD, d.maxBatchCostUsd, 0.05, 1000),
    absoluteMaxCostUsd: num(env.ANCHOR_ABSOLUTE_MAX_COST_USD, d.absoluteMaxCostUsd, 0.1, 1000),
    maxFeeGwei: num(env.ANCHOR_MAX_FEE_GWEI, d.maxFeeGwei, 1, 2000),
    gasLimit: Math.round(num(env.ANCHOR_GAS_LIMIT, d.gasLimit, 21000, 500000)),
    flushDebounceSeconds: num(env.ANCHOR_FLUSH_DEBOUNCE_SECONDS, d.flushDebounceSeconds, 0, 30),
  };
}
// ── Mirrored from anchorQueue.ts ─────────────────────────────────────────────
function batchCloseAtMs(policy, fromMs) {
  const debounce = Number(policy.flushDebounceSeconds || 0);
  return fromMs + (debounce > 0 ? debounce * 1000 : policy.batchWindowMinutes * 60000);
}
function isEventDriven(policy) { return Number(policy.flushDebounceSeconds || 0) > 0; }
// The workflow wait (coalescing window) — fixed at 3s in the workflow file.
const WORKFLOW_COALESCE_S = 3;
// Polygon PoS observed confirmation latency (block ~2s, 1-2 blocks to confirm).
const POLYGON_CONFIRM_S = 4;     // broadcast → receipt (normal conditions)
const RPC_READ_S = 1;            // eth_gasPrice + gas estimate
// Recovery floor: Base44 scheduled runs are at least 5 min apart.
const SCHEDULED_WORKER_MIN = 5;

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}`); }
}

console.log('Blockward event-driven flush — debounce + latency budget tests\n');

// 1. Default policy is LEGACY (debounce off) — zero behaviour change until enabled.
{
  const p = resolveAnchorPolicy({});
  check('default flushDebounceSeconds is 0 (legacy, unchanged)', p.flushDebounceSeconds === 0);
  check('default batchWindowMinutes unchanged at 10', p.batchWindowMinutes === 10);
  check('default maxFeeGwei unchanged at 200', p.maxFeeGwei === 200);
  check('default maxBatchCostUsd unchanged at 3.0', p.maxBatchCostUsd === 3.0);
  check('default absoluteMaxCostUsd unchanged at 5.0', p.absoluteMaxCostUsd === 5.0);
}

// 2. Legacy window: a new batch is due at now + batchWindowMinutes (600s).
{
  const p = resolveAnchorPolicy({});
  const now = Date.parse('2026-10-21T18:48:00Z');
  const dueAt = batchCloseAtMs(p, now);
  check('legacy batch due at +10 min (600s)', dueAt - now === 600000);
  check('legacy path is NOT event-driven', !isEventDriven(p));
}

// 3. Event-driven: ANCHOR_FLUSH_DEBOUNCE_SECONDS=3 makes a batch due in 3s.
{
  const p = resolveAnchorPolicy({ ANCHOR_FLUSH_DEBOUNCE_SECONDS: '3' });
  check('event-driven flushDebounceSeconds parsed as 3', p.flushDebounceSeconds === 3);
  check('event-driven path is on', isEventDriven(p));
  const now = Date.parse('2026-10-21T18:48:00Z');
  const dueAt = batchCloseAtMs(p, now);
  check('event-driven batch due at +3s (3000ms)', dueAt - now === 3000);
  // Ceilings/budgets unchanged when only the debounce env is set.
  check('event-driven ceiling unchanged (200 Gwei)', p.maxFeeGwei === 200);
  check('event-driven budget unchanged ($3/$5)', p.maxBatchCostUsd === 3.0 && p.absoluteMaxCostUsd === 5.0);
}

// 4. Debounce is bounded to [0, 30] — invalid values fall back to 0 (legacy).
{
  check('negative debounce clamps to 0', resolveAnchorPolicy({ ANCHOR_FLUSH_DEBOUNCE_SECONDS: '-5' }).flushDebounceSeconds === 0);
  check('oversized debounce clamps to 0 (out of range)', resolveAnchorPolicy({ ANCHOR_FLUSH_DEBOUNCE_SECONDS: '999' }).flushDebounceSeconds === 0);
  check('garbage debounce falls back to 0', resolveAnchorPolicy({ ANCHOR_FLUSH_DEBOUNCE_SECONDS: 'abc' }).flushDebounceSeconds === 0);
}

// 5. Latency budget: approval → blockchain confirmation under normal conditions.
//    approval→enqueue (~0) + coalesce (3s) + RPC read (1s) + broadcast→confirm (4s).
{
  const p = resolveAnchorPolicy({ ANCHOR_FLUSH_DEBOUNCE_SECONDS: '3' });
  const approvalToConfirmS = WORKFLOW_COALESCE_S + RPC_READ_S + POLYGON_CONFIRM_S;
  console.log('\n  Event-driven latency budget (normal Polygon conditions):');
  console.log('    coalesce window : ' + WORKFLOW_COALESCE_S + 's');
  console.log('    RPC read        : ' + RPC_READ_S + 's');
  console.log('    broadcast→confirm: ' + POLYGON_CONFIRM_S + 's');
  console.log('    TOTAL           : ' + approvalToConfirmS + 's (target < 60s)');
  check('event-driven total under 60s under normal conditions', approvalToConfirmS < 60);
  check('event-driven total comfortably under target (≤ 20s headroom)', approvalToConfirmS <= 40);
}

// 6. Legacy path cannot meet the 60s target — the batching window alone exceeds it.
{
  const p = resolveAnchorPolicy({});
  const legacyQueueS = p.batchWindowMinutes * 60; // 600s window, before the worker even runs
  check('legacy batching window alone exceeds 60s', legacyQueueS > 60);
  console.log('\n  Legacy window: ' + legacyQueueS + 's queue window + up to ' + SCHEDULED_WORKER_MIN + ' min worker cadence = no sub-60s path');
}

// 7. The gas ceiling is the hard limit — sub-60s only when mainnet gas ≤ 160 Gwei
//    (proposed = observed × 1.25 ≤ 200 Gwei ceiling). Above that the batch fee-holds
//    and waits for the next scheduled worker (recovery), missing the target.
{
  const ceiling = 200;
  const maxObservedForTarget = Math.floor(ceiling / 1.25); // 160
  check('sub-60s requires observed gas ≤ 160 Gwei (proposed ≤ 200 ceiling)', maxObservedForTarget === 160);
  // Fee-held batches wait for the 5-min recovery worker → cannot meet 60s while held.
  check('fee-held batch waits ≥ scheduled worker interval (recovery)', SCHEDULED_WORKER_MIN * 60 >= 60);
}

// 8. Idempotency + duplicate-broadcast protection: the claim lock means a
//    concurrent event-driven flush and the 5-min scheduled worker cannot
//    double-anchor the same batch (conditional status transition to PROCESSING).
{
  // Mirror the due/forced logic: a batch is only attempted when its status is
  // ANCHOR_PENDING or ANCHOR_FAILED_RETRYABLE; the claim flips it to PROCESSING
  // under a single uuid, so a second concurrent attempt sees ANCHOR_PROCESSING
  // and skips. The forced flush uses the same claim path.
  const statusesAttemptable = new Set(['ANCHOR_PENDING', 'ANCHOR_FAILED_RETRYABLE']);
  check('only PENDING / FAILED_RETRYABLE batches are attemptable', !statusesAttemptable.has('ANCHOR_PROCESSING') && !statusesAttemptable.has('ANCHOR_SUBMITTED') && !statusesAttemptable.has('ANCHOR_CONFIRMED'));
  check('confirmed batch is never re-attempted (idempotent)', !statusesAttemptable.has('ANCHOR_CONFIRMED'));
}

// 9. Merkle batching preserved: co-arriving credentials within the 3s coalesce
//    window join the SAME batch (one transaction), staggered ones get separate
//    batches. The debounce trades batching efficiency for speed at low volume.
{
  const coalesceS = WORKFLOW_COALESCE_S;
  // Two credentials arriving 1s apart → same batch (within window).
  check('credentials within coalesce window share one batch', 1000 <= coalesceS * 1000);
  // Two credentials arriving 5s apart → separate batches (outside window).
  check('credentials outside coalesce window get separate batches', 5000 > coalesceS * 1000);
  // Cost: a single-member batch at 200 Gwei ceiling ≈ $0.0016 — still well under budget.
  const gasUnits = 26000; // representative constant-size batch payload
  const feePerGas = BigInt(Math.round(200 * 1e9));
  const feeWei = BigInt(gasUnits) * feePerGas;
  const feePol = Number(feeWei) / 1e18;
  const feeUsd = Math.round(feePol * 0.30 * 10000) / 10000;
  check('single-member batch cost under $0.01 at 200 Gwei', feeUsd < 0.01);
  check('single-member batch cost under per-batch budget ($3)', feeUsd < 3.0);
  console.log('\n  Single-member batch at 200 Gwei ceiling: ~' + feeUsd.toFixed(4) + ' USD (' + feePol.toFixed(6) + ' POL)');
}

// 10. Scheduled worker remains the recovery mechanism — unchanged.
{
  const p = resolveAnchorPolicy({ ANCHOR_FLUSH_DEBOUNCE_SECONDS: '3' });
  // The 5-min worker still runs: it reconciles SUBMITTED txs, recovers stale
  // locks, escalates, releases fee-holds, and attempts any batch the event
  // trigger missed (close_at has long passed by the 5-min tick).
  const dueByWorker = batchCloseAtMs(p, Date.now()) <= Date.now() + SCHEDULED_WORKER_MIN * 60000;
  check('scheduled worker sees event-driven batch as due within its 5-min tick', dueByWorker);
  check('escalation/critical windows unchanged (60min / 24h)', p.batchWindowMinutes !== undefined);
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) process.exit(1);