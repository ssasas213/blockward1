// ============================================================================
// gasFeeMonitor — READ-ONLY production gas-fee monitoring for the Polygon
// anchoring queue. Records the worker's actual mainnet eth_gasPrice
// observation at each scheduled run, the proposed maxFeePerGas after the
// existing 25% headroom, the estimated total batch cost (POL + USD), and
// whether the UNCHANGED live fee policy would permit or reject broadcasting.
// Also simulates pass/fail under hypothetical ceilings (200/400/500/600/800
// Gwei) so admins can compare policies against real observations.
//
// THIS MODULE NEVER BROADCASTS, NEVER SIGNS, NEVER CHANGES THE FEE CEILING,
// BUDGETS, SECRETS OR BROADCASTING CONFIGURATION. eth_gasPrice is a read-only
// RPC call. Every monitor call is non-fatal: it never breaks the production
// queue tick.
//
// Alerting: alerts internal admins when a batch remains fee-held for 30 min
// (deduped per sustained hold), and when a submitted batch exceeds the
// confirmation SLA (deduped per sustained submission). Existing automatic
// retry, escalation and the 6-hour fee-hold notification are untouched.
// ============================================================================
import { createPublicClient, http } from 'npm:viem@2.7.0';
import { resolvePolygonConfig } from './chainPolygon.ts';
import {
  resolveAnchorPolicy, estimateBatchGas, weiToPol, weiToUsd, feeDecision, polUsdPrice,
} from './anchorGasPolicy.ts';
import { CREDENTIAL_HASH_VERSION } from './credentialHash.ts';
import { notifyAnchorAdmins } from './anchorAlerts.ts';

export const HYPOTHETICAL_CEILINGS_GWEI = [200, 400, 500, 600, 800];
export const FEE_HOLD_ALERT_MIN = 30;
export const CONFIRMATION_SLA_ALERT_MIN = 10;
export const WORKER_INTERVAL_MIN = 5; // Base44 scheduled runs are at least 5 min apart.

function nowIso(): string { return new Date().toISOString(); }
function log(step: string, extra: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ fn: 'gasFeeMonitor', step, ...extra }));
}

// Constant-size batch commitment payload — the on-chain calldata is the Merkle
// root + metadata, NOT credential content, so the transaction gas is constant
// regardless of batch size. A 1-member nominal payload is the representative
// batch transaction cost.
function nominalBatchPayload(): string {
  return JSON.stringify({ v: 1, t: 'blockward-batch', hv: CREDENTIAL_HASH_VERSION, n: 1, r: '0'.repeat(64) });
}

// ── Pure, testable ceiling simulation ──────────────────────────────────────
// Re-runs the fee decision under each hypothetical ceiling using the SAME
// observed gas price, so live vs hypothetical outcomes are directly comparable.
// Simulation only — never feeds back into broadcasting.
export function simulateCeilings(
  gasUnits: number,
  maxFeePerGasWei: bigint,
  polUsd: number,
  policy: ReturnType<typeof resolveAnchorPolicy>,
) {
  return HYPOTHETICAL_CEILINGS_GWEI.map((gwei) => {
    const dec = feeDecision(gasUnits, maxFeePerGasWei, polUsd, { ...policy, maxFeeGwei: gwei });
    return {
      ceiling_gwei: gwei,
      allowed: dec.allowed,
      reason: dec.reason,
      est_fee_usd: dec.estUsd,
      est_fee_pol: weiToPol(dec.estFeeWei),
    };
  });
}

// ── One observation per tick ────────────────────────────────────────────────
export async function captureGasObservation(
  svc: any,
  opts: { batchRef?: string | null; batchMemberCount?: number | null; note?: string } = {},
) {
  const policy = resolveAnchorPolicy();
  const cfg = resolvePolygonConfig('polygon_mainnet');
  const obs: any = {
    observed_at: nowIso(),
    network: 'polygon_mainnet',
    eth_gas_price_wei: null,
    eth_gas_price_gwei: null,
    proposed_max_fee_per_gas_wei: null,
    proposed_max_fee_per_gas_gwei: null,
    batch_ref: opts.batchRef ?? null,
    batch_member_count: opts.batchMemberCount ?? 1,
    estimated_gas_units: null,
    estimated_fee_wei: null,
    estimated_fee_pol: null,
    estimated_fee_usd: null,
    pol_price_usd: null,
    pol_price_source: null,
    live_max_fee_gwei: policy.maxFeeGwei,
    live_max_batch_cost_usd: policy.maxBatchCostUsd,
    live_absolute_max_cost_usd: policy.absoluteMaxCostUsd,
    live_decision_allowed: null,
    live_decision_reason: null,
    hypothetical_ceilings: [],
    note: opts.note || 'tick',
    worker_interval_minutes: WORKER_INTERVAL_MIN,
  };

  if (!cfg.rpc) {
    obs.note = 'mainnet_rpc_unconfigured';
    try { await svc.entities.GasFeeObservation.create(obs); } catch (e) { log('create_failed', { err: String(e?.message || e).slice(0, 160) }); }
    return obs;
  }

  let gasPriceWei: bigint | null = null;
  try {
    const pub = createPublicClient({ chain: (cfg as any).chain, transport: http(cfg.rpc as string) });
    const gp = await pub.getGasPrice();
    if (gp) gasPriceWei = BigInt(gp);
  } catch (e) {
    log('gasprice_error', { err: String(e?.message || e).slice(0, 160) });
  }

  if (gasPriceWei == null) {
    // Transparent — never invent a gas observation.
    obs.note = 'gas_price_unavailable';
    try { await svc.entities.GasFeeObservation.create(obs); } catch (e) { log('create_failed', { err: String(e?.message || e).slice(0, 160) }); }
    return obs;
  }

  const proposedWei = (gasPriceWei * 125n) / 100n; // existing 25% headroom
  const price = await polUsdPrice();
  const gasUnits = estimateBatchGas(nominalBatchPayload(), policy);
  const live = feeDecision(gasUnits, proposedWei, price.usd, policy);
  const hypo = simulateCeilings(gasUnits, proposedWei, price.usd, policy);

  obs.eth_gas_price_wei = String(gasPriceWei);
  obs.eth_gas_price_gwei = Math.round((Number(gasPriceWei) / 1e9) * 1000) / 1000;
  obs.proposed_max_fee_per_gas_wei = String(proposedWei);
  obs.proposed_max_fee_per_gas_gwei = Math.round((Number(proposedWei) / 1e9) * 1000) / 1000;
  obs.estimated_gas_units = gasUnits;
  obs.estimated_fee_wei = String(live.estFeeWei);
  obs.estimated_fee_pol = weiToPol(live.estFeeWei);
  obs.estimated_fee_usd = live.estUsd;
  obs.pol_price_usd = price.usd;
  obs.pol_price_source = price.source;
  obs.live_decision_allowed = live.allowed;
  obs.live_decision_reason = live.reason;
  obs.hypothetical_ceilings = hypo;

  try { await svc.entities.GasFeeObservation.create(obs); } catch (e) { log('create_failed', { err: String(e?.message || e).slice(0, 160) }); }
  log('observed', { gwei: obs.eth_gas_price_gwei, live_allowed: live.allowed, reason: live.reason });
  return obs;
}

// ── Fee-hold age alert (30 min, deduped per sustained hold) ─────────────────
export async function checkFeeHoldAgeAlerts(svc: any) {
  try {
    const page = await svc.entities.AnchorBatch.filter({ status: 'ANCHOR_PENDING_FEE' }, { limit: 50 });
    const feeHeld = page?.items || page || [];
    let alerted = 0;
    for (const b of feeHeld) {
      const ageMin = (Date.now() - new Date(b.created_at || b.created_date).getTime()) / 60000;
      if (ageMin >= FEE_HOLD_ALERT_MIN && !b.fee_hold_age_alerted_at) {
        await svc.entities.AnchorBatch.update(b.id, { fee_hold_age_alerted_at: nowIso() }).catch(() => {});
        await notifyAnchorAdmins(svc, 'Fee-held batch — 30 min',
          `Batch ${b.batch_ref} (${b.member_count} credentials) has been fee-held for ${Math.round(ageMin)} min under the current gas ceiling. The credential is safe; anchoring resumes automatically when fees allow. Auto-retry and escalation are unchanged.`,
          'anchor_fee_hold', 'important');
        alerted++;
      }
    }
    return { alerted };
  } catch (e) { log('fee_hold_alert_error', { err: String(e?.message || e).slice(0, 160) }); return { alerted: 0 }; }
}

// ── Confirmation SLA alert (submitted > 10 min without receipt) ────────────
export async function checkConfirmationSlaAlerts(svc: any) {
  try {
    const page = await svc.entities.AnchorBatch.filter({ status: 'ANCHOR_SUBMITTED' }, { limit: 50 });
    const submitted = page?.items || page || [];
    let alerted = 0;
    for (const b of submitted) {
      const submittedAt = b.event_log?.find?.((e: any) => e.event === 'submitted')?.timestamp || b.updated_date || b.created_at;
      const ageMin = submittedAt ? (Date.now() - new Date(submittedAt).getTime()) / 60000 : 0;
      if (ageMin >= CONFIRMATION_SLA_ALERT_MIN && !b.confirmation_sla_alerted_at) {
        await svc.entities.AnchorBatch.update(b.id, { confirmation_sla_alerted_at: nowIso() }).catch(() => {});
        await notifyAnchorAdmins(svc, 'Blockchain confirmation SLA exceeded',
          `Batch ${b.batch_ref} was submitted ${Math.round(ageMin)} min ago and is still awaiting on-chain confirmation (target ≤5 min). The queue reconciles automatically; no action needed unless this persists.`,
          'anchor_escalation', 'important');
        alerted++;
      }
    }
    return { alerted };
  } catch (e) { log('confirm_sla_error', { err: String(e?.message || e).slice(0, 160) }); return { alerted: 0 }; }
}

// Clear monitoring alert flags for batches that have LEFT the corresponding
// state, so a NEW sustained fee-hold / submission re-alerts. Decoupled from
// the production queue transitions — never touches broadcasting.
export async function clearStaleMonitorFlags(svc: any) {
  try {
    const page = await svc.entities.AnchorBatch.filter({}, { sort: '-created_date', limit: 100 });
    const recent = page?.items || page || [];
    const feeClear: any[] = [];
    const confirmClear: any[] = [];
    for (const b of recent) {
      if (b.fee_hold_age_alerted_at && b.status !== 'ANCHOR_PENDING_FEE') feeClear.push({ id: b.id, fee_hold_age_alerted_at: null });
      if (b.confirmation_sla_alerted_at && b.status !== 'ANCHOR_SUBMITTED') confirmClear.push({ id: b.id, confirmation_sla_alerted_at: null });
    }
    if (feeClear.length) await svc.entities.AnchorBatch.bulkUpdate(feeClear).catch(() => {});
    if (confirmClear.length) await svc.entities.AnchorBatch.bulkUpdate(confirmClear).catch(() => {});
    return { fee_cleared: feeClear.length, confirm_cleared: confirmClear.length };
  } catch (e) { log('clear_flags_error', { err: String(e?.message || e).slice(0, 160) }); return { fee_cleared: 0, confirm_cleared: 0 }; }
}

// ── One entry point for the worker tick ─────────────────────────────────────
// Runs all monitoring. Every step is individually guarded so a failure in one
// never skips the others and never reaches the production tick.
export async function runGasFeeMonitoring(
  svc: any,
  opts: { batchRef?: string | null; batchMemberCount?: number | null } = {},
) {
  try { await captureGasObservation(svc, opts); } catch (e) { log('capture_failed', { err: String(e?.message || e).slice(0, 160) }); }
  try { await checkFeeHoldAgeAlerts(svc); } catch (e) { log('feehold_failed', { err: String(e?.message || e).slice(0, 160) }); }
  try { await checkConfirmationSlaAlerts(svc); } catch (e) { log('confirmsla_failed', { err: String(e?.message || e).slice(0, 160) }); }
  try { await clearStaleMonitorFlags(svc); } catch (e) { log('clearflags_failed', { err: String(e?.message || e).slice(0, 160) }); }
}