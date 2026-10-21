// anchorQueueStatus — READ-ONLY monitoring data for the internal admin
// console's blockchain panel: queue health, batch activity, cost tracking,
// the active gas policy, POL price, mainnet readiness and the scalability
// cost projection. Performs NO transactions and NO state changes.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { requireInternalAdmin } from '../../shared/internalAdmin.ts';
import { resolveAnchorPolicy, estimateBatchGas, gweiToWeiPerGas, weiToPol, weiToUsd, polUsdPrice, volumeCostTable } from '../../shared/anchorGasPolicy.ts';
import { resolvePolygonTarget, resolvePolygonConfig } from '../../shared/chainPolygon.ts';
import { CREDENTIAL_HASH_VERSION } from '../../shared/credentialHash.ts';

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const base44 = createClientFromRequest(req);
    const { error } = await requireInternalAdmin(base44);
    if (error) return error;
    const svc = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const action = body?.action === 'batch_detail' ? 'batch_detail' : body?.action === 'latency_report' ? 'latency_report' : 'overview';

    // ── Queue counters (one aggregate, no record loads) ──
    const statuses = ['ANCHOR_PENDING', 'ANCHOR_PENDING_FEE', 'ANCHOR_PROCESSING', 'ANCHOR_SUBMITTED', 'ANCHOR_CONFIRMED', 'ANCHOR_FAILED_RETRYABLE', 'ANCHOR_FAILED_PERMANENT'];
    const countRows = await Promise.allSettled(statuses.map((s) => svc.entities.AnchorBatch.count({ status: s })));
    const counts: Record<string, number> = {};
    statuses.forEach((s, i) => { counts[s] = countRows[i].status === 'fulfilled' ? (countRows[i] as any).value : 0; });

    const openCount = counts.ANCHOR_PENDING + counts.ANCHOR_PENDING_FEE + counts.ANCHOR_PROCESSING + counts.ANCHOR_SUBMITTED + counts.ANCHOR_FAILED_RETRYABLE;
    const confirmedCount = counts.ANCHOR_CONFIRMED;
    const permanentCount = counts.ANCHOR_FAILED_PERMANENT;

    // ── Recent batches ──
    const recent = await svc.entities.AnchorBatch.filter({}, { sort: '-created_date', limit: 15 });
    const batches = (recent?.items || recent || []).map((b: any) => ({
      batch_ref: b.batch_ref,
      status: b.status,
      network: b.network,
      member_count: b.member_count,
      created_at: b.created_at,
      close_at: b.close_at,
      escalated_at: b.escalated_at || null,
      critical_at: b.critical_at || null,
      attempts: b.attempts || 0,
      next_attempt_at: b.next_attempt_at || null,
      last_error: b.last_error || null,
      transaction_hash: b.transaction_hash || null,
      merkle_root: b.merkle_root ? `${String(b.merkle_root).slice(0, 16)}…` : null,
      actual_fee_pol: b.actual_fee_pol || null,
      actual_cost_usd: b.actual_cost_usd ?? null,
      confirmed_at: b.confirmed_at || null,
    }));
    const fullBatches = (recent?.items || recent || []);
    const detailRef = action === 'batch_detail' && typeof body.batch_ref === 'string' ? body.batch_ref.trim().toUpperCase() : null;
    let batchDetail: any = null;
    if (detailRef) {
      const rows = await svc.entities.AnchorBatch.filter({ batch_ref: detailRef }, { limit: 1 });
      const b = (rows?.items || rows || [])[0];
      if (b) {
        const memberRows = await svc.entities.Credential.filter({ id: { $in: b.member_ids || [] } }, { limit: 1000, fields: ['bw_id', 'title', 'holder_display_name', 'anchor_status', 'blockchain'] });
        batchDetail = {
          batch_ref: b.batch_ref, status: b.status, network: b.network,
          member_count: b.member_count, created_at: b.created_at, close_at: b.close_at,
          attempts: b.attempts, last_error: b.last_error || null,
          merkle_root: b.merkle_root || null, transaction_hash: b.transaction_hash || null,
          actual_fee_pol: b.actual_fee_pol || null, actual_cost_usd: b.actual_cost_usd ?? null,
          event_log: b.event_log || [],
          members: (memberRows?.items || memberRows || []).map((m: any) => ({
            bw_id: m.bw_id, title: m.title, holder_display_name: m.holder_display_name,
            anchor_status: m.anchor_status,
            leaf_index: m.blockchain?.merkle_leaf_index ?? null,
          })),
        };
      }
    }

    // ── Cost tracking totals ──
    const totalsRows = await svc.entities.AnchorBatch.aggregate({ query: { status: 'ANCHOR_CONFIRMED' }, sum: [], groupBy: null }).catch(() => null);
    void totalsRows;
    const confirmedAgg = await svc.entities.AnchorBatch.filter({ status: 'ANCHOR_CONFIRMED' }, { limit: 1000, fields: ['actual_cost_usd', 'actual_fee_wei', 'member_count'] });
    const confirmed = (confirmedAgg?.items || confirmedAgg || []) as any[];
    const totalUsd = confirmed.reduce((s: number, b: any) => s + (Number(b.actual_cost_usd) || 0), 0);
    const totalWei = confirmed.reduce((s: bigint, b: any) => { try { return s + BigInt(b.actual_fee_wei || '0'); } catch { return s; } }, 0n);
    const totalMembers = confirmed.reduce((s: number, b: any) => s + (Number(b.member_count) || 0), 0);
    const cost_tracking = {
      confirmed_batches: confirmed.length,
      anchored_credentials: totalMembers,
      total_cost_pol: weiToPol(totalWei),
      total_cost_usd: Math.round(totalUsd * 10000) / 10000,
      avg_cost_per_credential_usd: totalMembers > 0 ? Math.round((totalUsd / totalMembers) * 10000) / 10000 : null,
    };

    // ── Policy, price, projection ──
    const policy = resolveAnchorPolicy();
    const price = await polUsdPrice();
    const resolvedTarget = resolvePolygonTarget();
    const target = 'unsupported' in resolvedTarget ? null : resolvedTarget.target;
    const projection = volumeCostTable(policy, price.usd, estimateBatchGas(JSON.stringify({ v: 1, t: 'blockward-batch', hv: CREDENTIAL_HASH_VERSION, n: 1, r: '0'.repeat(64) }), policy));

    // ── Mainnet readiness (configuration only; no signing, no RPC writes) ──
    const cfgMain = resolvePolygonConfig('polygon_mainnet');
    const readiness = {
      selector: target,
      selector_supported: !('unsupported' in resolvedTarget),
      rpc_configured: !!cfgMain.rpc,
      anchor_address_configured: !!cfgMain.expectedSignerAddress,
      signer_key_configured: !!cfgMain.signingKey,
    };

    // ── Gas-fee monitoring (read-only) — observations, hypothetical ceiling
    //    comparison, fee-held batch age + next retry, confirmation latency. ──
    const gasMonitor = await buildGasMonitorData(svc, policy);
    const latencyReport = action === 'latency_report' ? await buildLatencyReport(svc) : null;

    return Response.json({
      ok: true,
      counts,
      open_count: openCount,
      confirmed_count: confirmedCount,
      permanent_failures: permanentCount,
      batches,
      batch_detail: batchDetail,
      cost_tracking,
      latency_report: latencyReport,
      policy: {
        batch_max_size: policy.batchMaxSize,
        batch_window_minutes: policy.batchWindowMinutes,
        target_minutes: policy.targetMinutes,
        escalation_minutes: policy.escalationMinutes,
        critical_minutes: policy.criticalMinutes,
        max_batch_cost_usd: policy.maxBatchCostUsd,
        absolute_max_cost_usd: policy.absoluteMaxCostUsd,
        max_fee_gwei: policy.maxFeeGwei,
        flush_debounce_seconds: policy.flushDebounceSeconds,
        max_attempts: policy.maxAttempts,
        integration_test_ceiling_pol: '0.01 (separate, unchanged)',
      },
      pol_price: price,
      volume_projection: projection,
      mainnet_readiness: readiness,
      gas_monitor: gasMonitor,
    });
  } catch (e) {
    return Response.json({ ok: false, error: e?.message || 'Queue status failed' }, { status: 500 });
  }
}

function median(values: number[]): number | null {
  const v = values.filter((x) => Number.isFinite(x));
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// ── Phase 4 latency report ──────────────────────────────────────────────────
// Measures end-to-end verification latency from issuer approval to Blockward
// Verified, using production timestamps and independently verified receipts.
// Fee-held batches are EXCLUDED from the non-fee-held target and reported
// separately. Returns median, max and 95th-percentile in SECONDS, plus the
// sample size and a sufficiency flag (the 60-second target is only claimed
// when enough non-fee-held measurements support it).
async function buildLatencyReport(svc: any) {
  try {
    const rows = await svc.entities.AnchorBatch.filter({ status: 'ANCHOR_CONFIRMED' }, { sort: '-confirmed_at', limit: 200 });
    const confirmed = (rows?.items || rows || []) as any[];
    if (!confirmed.length) return { sample_size: 0, sufficient: false, note: 'No confirmed batches yet — latency cannot be measured until production remediation and fee-policy approval are complete.' };

    const firstMemberIds = confirmed.map((b) => (b.member_ids || [])[0]).filter(Boolean);
    const credMap = new Map<string, any>();
    if (firstMemberIds.length) {
      const cr = await svc.entities.Credential.filter({ id: { $in: firstMemberIds } }, { limit: 200, fields: ['id', 'verified_at', 'blockchain'] }).catch(() => null);
      for (const c of ((cr?.items || cr || []) as any[])) credMap.set(c.id, c);
    }

    const nonFeeHeld: number[] = [];
    const feeHeldLatency: number[] = [];
    for (const b of confirmed) {
      const events = Array.isArray(b.event_log) ? b.event_log : [];
      const submittedAt = events.find((e: any) => e.event === 'submitted')?.timestamp || null;
      const confirmedAt = b.confirmed_at || events.find((e: any) => e.event === 'confirmed')?.timestamp || null;
      const cred = credMap.get((b.member_ids || [])[0]);
      const verifiedAt = cred?.verified_at || null;
      if (!verifiedAt || !confirmedAt) continue;
      const totalMs = Math.max(0, new Date(confirmedAt).getTime() - new Date(verifiedAt).getTime());
      const wasFeeHeld = events.some((e: any) => e.event === 'fee_hold');
      if (wasFeeHeld) feeHeldLatency.push(totalMs);
      else nonFeeHeld.push(totalMs);
    }

    const pct = (arr: number[], p: number): number | null => {
      const v = arr.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
      if (!v.length) return null;
      const idx = Math.min(v.length - 1, Math.floor((p / 100) * v.length));
      return v[idx];
    };
    const med = (arr: number[]) => {
      const v = arr.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
      if (!v.length) return null;
      const mid = Math.floor(v.length / 2);
      return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
    };
    const toSec = (ms: number | null) => (ms == null ? null : Math.round(ms / 10) / 100);
    const sufficient = nonFeeHeld.length >= 20;

    return {
      non_fee_held: {
        sample_size: nonFeeHeld.length,
        median_seconds: toSec(med(nonFeeHeld)),
        max_seconds: toSec(nonFeeHeld.length ? Math.max(...nonFeeHeld) : null),
        p95_seconds: toSec(pct(nonFeeHeld, 95)),
      },
      fee_held: {
        sample_size: feeHeldLatency.length,
        median_seconds: toSec(med(feeHeldLatency)),
        max_seconds: toSec(feeHeldLatency.length ? Math.max(...feeHeldLatency) : null),
      },
      sufficient,
      target_seconds: 60,
      target_met: sufficient && (toSec(med(nonFeeHeld)) ?? Infinity) < 60 && (toSec(pct(nonFeeHeld, 95)) ?? Infinity) < 60,
      note: sufficient
        ? 'Sufficient non-fee-held production measurements exist.'
        : `Only ${nonFeeHeld.length} non-fee-held measurement(s) — the 60-second target is NOT YET PROVEN until at least 20 exist.`,
    };
  } catch (e) {
    return { error: String(e?.message || e).slice(0, 200) };
  }
}

// Read-only gas-fee monitoring aggregation for the admin dashboard. Pulls
// recorded GasFeeObservation rows, computes the live-vs-hypothetical ceiling
// comparison from real observations, fee-held batch age + next retry, and
// approval→confirmation latency from recently confirmed batches. Performs no
// writes and no transactions.
async function buildGasMonitorData(svc: any, policy: any) {
  try {
    const obsRows = await svc.entities.GasFeeObservation.filter({}, { sort: '-observed_at', limit: 50 }).catch(() => null);
    const obsList = (obsRows?.items || obsRows || []) as any[];
    const observations = obsList.map((o) => ({
      observed_at: o.observed_at,
      eth_gas_price_gwei: o.eth_gas_price_gwei,
      proposed_max_fee_per_gas_gwei: o.proposed_max_fee_per_gas_gwei,
      estimated_fee_pol: o.estimated_fee_pol,
      estimated_fee_usd: o.estimated_fee_usd,
      live_decision_allowed: o.live_decision_allowed,
      live_decision_reason: o.live_decision_reason,
      note: o.note,
    }));
    const withCeilings = obsList.filter((o) => Array.isArray(o.hypothetical_ceilings) && o.hypothetical_ceilings.length);
    const ceilingComparison = [200, 400, 500, 600, 800].map((gwei) => {
      const matches = withCeilings.flatMap((o) => (o.hypothetical_ceilings as any[]).filter((h) => h.ceiling_gwei === gwei));
      const pass = matches.filter((m) => m.allowed).length;
      const costs = matches.map((m) => Number(m.est_fee_usd)).filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
      const med = costs.length ? costs[Math.floor(costs.length / 2)] : null;
      return { ceiling_gwei: gwei, pass, total: matches.length, pass_rate: matches.length ? pass / matches.length : 0, median_est_fee_usd: med };
    });
    const sampleTo = observations[0]?.observed_at || null;
    const sampleFrom = observations[observations.length - 1]?.observed_at || null;

    const feeHeldRows = await svc.entities.AnchorBatch.filter({ status: 'ANCHOR_PENDING_FEE' }, { sort: 'created_date', limit: 50 }).catch(() => null);
    const feeHeldBatches = ((feeHeldRows?.items || feeHeldRows || []) as any[]).map((b) => ({
      batch_ref: b.batch_ref,
      member_count: b.member_count,
      age_minutes: b.created_at ? (Date.now() - new Date(b.created_at).getTime()) / 60000 : null,
      next_attempt_at: b.next_attempt_at || null,
      fee_hold_age_alerted_at: b.fee_hold_age_alerted_at || null,
    }));

    // Latency from recently confirmed batches + their first member credential.
    const confirmedRows = await svc.entities.AnchorBatch.filter({ status: 'ANCHOR_CONFIRMED' }, { sort: '-confirmed_at', limit: 10 }).catch(() => null);
    const confirmed = (confirmedRows?.items || confirmedRows || []) as any[];
    const firstMemberIds = confirmed.map((b) => (b.member_ids || [])[0]).filter(Boolean);
    const credMap = new Map<string, any>();
    if (firstMemberIds.length) {
      const cr = await svc.entities.Credential.filter({ id: { $in: firstMemberIds } }, { limit: 20, fields: ['id', 'verified_at', 'blockchain'] }).catch(() => null);
      for (const c of ((cr?.items || cr || []) as any[])) credMap.set(c.id, c);
    }
    const aq: number[] = [], qs: number[] = [], sc: number[] = [], tot: number[] = [];
    for (const b of confirmed) {
      const submittedAt = b.event_log?.find?.((e: any) => e.event === 'submitted')?.timestamp || null;
      const confirmedAt = b.confirmed_at || null;
      const cred = credMap.get((b.member_ids || [])[0]);
      const queuedAt = cred?.blockchain?.queued_at || null;
      const verifiedAt = cred?.verified_at || null;
      if (verifiedAt && queuedAt) aq.push((new Date(queuedAt).getTime() - new Date(verifiedAt).getTime()) / 60000);
      if (queuedAt && submittedAt) qs.push((new Date(submittedAt).getTime() - new Date(queuedAt).getTime()) / 60000);
      if (submittedAt && confirmedAt) sc.push((new Date(confirmedAt).getTime() - new Date(submittedAt).getTime()) / 60000);
      if (verifiedAt && confirmedAt) tot.push((new Date(confirmedAt).getTime() - new Date(verifiedAt).getTime()) / 60000);
    }
    const latency = {
      approval_to_queue_median: median(aq),
      queue_to_submit_median: median(qs),
      submit_to_confirm_median: median(sc),
      total_median: median(tot),
      sample_size: confirmed.length,
    };

    const recentRows = await svc.entities.AnchorBatch.filter({}, { sort: '-created_date', limit: 100 }).catch(() => null);
    const confirmAlerted = ((recentRows?.items || recentRows || []) as any[]).filter((b) => b.confirmation_sla_alerted_at).length;

    return {
      observations,
      ceiling_comparison: ceilingComparison,
      sample_from: sampleFrom,
      sample_to: sampleTo,
      fee_held_batches: feeHeldBatches,
      latency,
      confirmation_sla: { target_min: 5, alert_threshold_min: 10, alerted_count: confirmAlerted },
      live_max_fee_gwei: policy.maxFeeGwei,
      live_max_batch_cost_usd: policy.maxBatchCostUsd,
      live_absolute_max_cost_usd: policy.absoluteMaxCostUsd,
      worker_interval_minutes: 5,
    };
  } catch (e) {
    return { observations: [], ceiling_comparison: [], fee_held_batches: [], latency: {}, confirmation_sla: {}, error: String(e?.message || e).slice(0, 160) };
  }
}