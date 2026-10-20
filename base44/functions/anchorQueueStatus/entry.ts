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
    const action = body?.action === 'batch_detail' ? 'batch_detail' : 'overview';

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

    return Response.json({
      ok: true,
      counts,
      open_count: openCount,
      confirmed_count: confirmedCount,
      permanent_failures: permanentCount,
      batches,
      batch_detail: batchDetail,
      cost_tracking,
      policy: {
        batch_max_size: policy.batchMaxSize,
        batch_window_minutes: policy.batchWindowMinutes,
        target_minutes: policy.targetMinutes,
        escalation_minutes: policy.escalationMinutes,
        critical_minutes: policy.criticalMinutes,
        max_batch_cost_usd: policy.maxBatchCostUsd,
        absolute_max_cost_usd: policy.absoluteMaxCostUsd,
        max_fee_gwei: policy.maxFeeGwei,
        max_attempts: policy.maxAttempts,
        integration_test_ceiling_pol: '0.01 (separate, unchanged)',
      },
      pol_price: price,
      volume_projection: projection,
      mainnet_readiness: readiness,
    });
  } catch (e) {
    return Response.json({ ok: false, error: e?.message || 'Queue status failed' }, { status: 500 });
  }
}