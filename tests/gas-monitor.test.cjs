// Self-contained Node test for the gas-fee monitoring math. Mirrors the pure
// feeDecision + simulateCeilings logic in base44/shared/gasFeeMonitor.ts and
// base44/shared/anchorGasPolicy.ts (no Deno imports) so it runs in plain Node.
// Run: node tests/gas-monitor.test.cjs
const assert = require('assert');

// ── Mirrored from anchorGasPolicy.ts ────────────────────────────────────────
function gweiToWeiPerGas(gwei) { return BigInt(Math.round(gwei * 1e9)); }
function weiToUsd(wei, polUsd) { return Math.round((Number(wei) / 1e18) * polUsd * 10000) / 10000; }
function weiToPol(wei) {
  const whole = wei / 10n ** 18n;
  const fraction = (wei % 10n ** 18n).toString().padStart(18, '0').replace(/0+$/, '');
  return `${whole}${fraction ? `.${fraction}` : ''}`;
}
function estimateBatchGas(payloadText, gasLimit = 60000) {
  const bytes = Buffer.from(payloadText, 'utf-8');
  let dataGas = 0;
  for (const b of bytes) dataGas += b === 0 ? 4 : 16;
  const manual = Math.ceil((21000 + dataGas) * 1.15);
  return Math.min(manual, gasLimit);
}
function feeDecision(gasUnits, maxFeePerGasWei, polUsd, policy) {
  const estFeeWei = BigInt(gasUnits) * maxFeePerGasWei;
  const estUsd = weiToUsd(estFeeWei, polUsd);
  if (maxFeePerGasWei > gweiToWeiPerGas(policy.maxFeeGwei)) return { allowed: false, reason: 'fee_ceiling_gwei', estFeeWei, estUsd };
  if (estUsd > policy.absoluteMaxCostUsd) return { allowed: false, reason: 'absolute_cost_cap', estFeeWei, estUsd };
  if (estUsd > policy.maxBatchCostUsd) return { allowed: false, reason: 'batch_budget_exceeded', estFeeWei, estUsd };
  return { allowed: true, reason: null, estFeeWei, estUsd };
}
// ── Mirrored from gasFeeMonitor.ts ──────────────────────────────────────────
const HYPOTHETICAL_CEILINGS_GWEI = [200, 400, 500, 600, 800];
const FEE_HOLD_ALERT_MIN = 30;
function simulateCeilings(gasUnits, maxFeePerGasWei, polUsd, policy) {
  return HYPOTHETICAL_CEILINGS_GWEI.map((gwei) => {
    const dec = feeDecision(gasUnits, maxFeePerGasWei, polUsd, { ...policy, maxFeeGwei: gwei });
    return { ceiling_gwei: gwei, allowed: dec.allowed, reason: dec.reason, est_fee_usd: dec.estUsd, est_fee_pol: weiToPol(dec.estFeeWei) };
  });
}

const POLICY = { maxFeeGwei: 200, maxBatchCostUsd: 3.0, absoluteMaxCostUsd: 5.0, gasLimit: 60000, fallbackPolUsd: 0.30 };
const POL_USD = 0.30;
const PAYLOAD = JSON.stringify({ v: 1, t: 'blockward-batch', hv: 1, n: 1, r: '0'.repeat(64) });
const GAS_UNITS = estimateBatchGas(PAYLOAD, POLICY.gasLimit);

function gweiToWei(g) { return BigInt(Math.round(g * 1e9)); }

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}`); }
}

console.log('Blockward gas-fee monitoring — math + alert tests\n');

// 1. Live policy rejects when observed gas exceeds the 200 Gwei ceiling.
{
  const observedGwei = 350; // typical mainnet spike
  const proposedWei = (gweiToWei(observedGwei) * 125n) / 100n;
  const live = feeDecision(GAS_UNITS, proposedWei, POL_USD, POLICY);
  check('live 350 gwei rejected under 200 ceiling', !live.allowed && live.reason === 'fee_ceiling_gwei');
  const hypo = simulateCeilings(GAS_UNITS, proposedWei, POL_USD, POLICY);
  const byCeiling = Object.fromEntries(hypo.map((h) => [h.ceiling_gwei, h]));
  check('hypothetical 200 gwei rejects 350 gwei observation (proposed 437.5 gwei)', !byCeiling[200].allowed);
  check('hypothetical 400 gwei rejects 350 gwei observation (proposed 437.5 > 400)', !byCeiling[400].allowed);
  check('hypothetical 500/600/800 admit 350 gwei observation', byCeiling[500].allowed && byCeiling[600].allowed && byCeiling[800].allowed);
}

// 2. Live policy admits when gas is comfortably under the ceiling.
{
  const observedGwei = 120;
  const proposedWei = (gweiToWei(observedGwei) * 125n) / 100n; // 150 gwei proposed
  const live = feeDecision(GAS_UNITS, proposedWei, POL_USD, POLICY);
  check('live 120 gwei admitted under 200 ceiling', live.allowed && live.reason === null);
  const hypo = simulateCeilings(GAS_UNITS, proposedWei, POL_USD, POLICY);
  check('all hypothetical ceilings admit 120 gwei observation', hypo.every((h) => h.allowed));
  // Per-credential cost at a full batch of 500.
  const perCredUsd = live.estUsd / 500;
  check('per-credential cost under $0.02 at 120 gwei / 500-batch', perCredUsd < 0.02);
}

// 3. Very high gas rejected under every hypothetical ceiling.
{
  const observedGwei = 900;
  const proposedWei = (gweiToWei(observedGwei) * 125n) / 100n;
  const hypo = simulateCeilings(GAS_UNITS, proposedWei, POL_USD, POLICY);
  check('900 gwei rejected under every hypothetical ceiling', hypo.every((h) => !h.allowed));
}

// 4. Budget gate triggers before ceiling when gas is cheap but batch is huge.
// (constant batch gas keeps this under budget at normal POL price — verify the
//  budget gate is reachable with a deliberately low ceiling.)
{
  const cheap = { ...POLICY, maxFeeGwei: 1000000, maxBatchCostUsd: 0.0001, absoluteMaxCostUsd: 1.0 };
  const proposedWei = gweiToWei(50);
  const dec = feeDecision(GAS_UNITS, proposedWei, POL_USD, cheap);
  check('budget gate rejects below the absolute cap', !dec.allowed && dec.reason === 'batch_budget_exceeded');
}

// 5. Fee-hold alert threshold is 30 minutes.
check('fee-hold alert threshold is 30 min', FEE_HOLD_ALERT_MIN === 30);

// 6. Hypothetical policy comparison using a sample of recorded observations.
{
  // Simulated recorded observations (gwei observed at successive ticks).
  const recorded = [110, 180, 240, 360, 420, 510, 130, 200, 330, 470];
  const comparison = HYPOTHETICAL_CEILINGS_GWEI.map((ceiling) => {
    let pass = 0;
    for (const g of recorded) {
      const proposedWei = (gweiToWei(g) * 125n) / 100n;
      const dec = feeDecision(GAS_UNITS, proposedWei, POL_USD, { ...POLICY, maxFeeGwei: ceiling });
      if (dec.allowed) pass++;
    }
    return { ceiling_gwei: ceiling, pass_rate: pass / recorded.length, pass, total: recorded.length };
  });
  console.log('\n  Hypothetical ceiling comparison (n=' + recorded.length + ' recorded observations):');
  for (const c of comparison) {
    console.log('    ' + c.ceiling_gwei + ' gwei -> ' + (c.pass_rate * 100).toFixed(0) + '% would broadcast (' + c.pass + '/' + c.total + ')');
  }
  check('200 gwei passes the fewest observations', comparison[0].pass <= comparison[comparison.length - 1].pass);
  check('800 gwei passes all observations', comparison[comparison.length - 1].pass_rate === 1);
  check('comparison reports sample size', comparison[0].total === recorded.length);
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) process.exit(1);