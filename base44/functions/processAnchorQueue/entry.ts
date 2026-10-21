// processAnchorQueue — the worker tick for the Polygon anchoring queue.
// Runs on a schedule (the "Blockchain Anchor Queue" workflow, every 5 minutes)
// and can be invoked on demand by an internal admin (e.g. to force a batch).
//
// Auth: a signed-in Blockward admin OR a Blockward internal admin — the queue
// touches credentials and signs blockchain transactions, so it must never be
// publicly callable.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { processAnchorQueue } from '../../shared/anchorQueue.ts';
import { isInternalAdmin } from '../../shared/internalAdmin.ts';

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const base44 = createClientFromRequest(req);
    let me: any = null;
    try { me = await base44.auth.me(); } catch { me = null; }
    const email = String(me?.email || '').trim().toLowerCase();
    const authorized = !!me && (me.role === 'admin' || isInternalAdmin(email));
    if (!authorized) return Response.json({ error: 'Admin or internal admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const forceBatchRef = body && typeof body.batch_ref === 'string' && body.batch_ref.trim()
      ? String(body.batch_ref).trim().toUpperCase() : null;

    const svc = base44.asServiceRole;
    const t0 = Date.now();
    const summary = await processAnchorQueue(svc, { forceBatchRef });
    const tick_ms = Date.now() - t0;

    // Forced-batch result + timing instrumentation: the workflow's
    // reconciliation loop reads forced_batch_confirmed / forced_batch_status
    // to decide whether to re-call immediately or end.
    let forced_batch_result: any = null;
    if (forceBatchRef) {
      const rows = await svc.entities.AnchorBatch.filter({ batch_ref: forceBatchRef }, { limit: 1 });
      const b = (rows?.items || rows || [])[0];
      if (b) {
        const events = Array.isArray(b.event_log) ? b.event_log : [];
        const evt = (name: string) => events.find((e: any) => e.event === name);
        const opened = evt('opened');
        const memberAdded = evt('member_added');
        const submitted = evt('submitted');
        const confirmed = evt('confirmed');
        const enqueueAt = b.created_at || opened?.timestamp || null;
        const flushAt = b.anchor_claimed_at || null;
        const broadcastAt = submitted?.timestamp || null;
        const receiptAt = confirmed?.timestamp || b.confirmed_at || null;
        forced_batch_result = {
          batch_ref: forceBatchRef,
          status: b.status,
          confirmed: b.status === 'ANCHOR_CONFIRMED',
          fee_held: b.status === 'ANCHOR_PENDING_FEE',
          submitted: b.status === 'ANCHOR_SUBMITTED',
          transaction_hash: b.transaction_hash || null,
          member_count: b.member_count,
          timing: {
            enqueue_at: enqueueAt,
            flush_at: flushAt,
            broadcast_at: broadcastAt,
            receipt_at: receiptAt,
            tick_ms: tick_ms,
            // End-to-end latency from enqueue to confirmed receipt (the
            // 8-10s target). Null until the batch is confirmed.
            total_ms: enqueueAt && receiptAt
              ? Math.max(0, new Date(receiptAt).getTime() - new Date(enqueueAt).getTime())
              : null,
            broadcast_to_receipt_ms: broadcastAt && receiptAt
              ? Math.max(0, new Date(receiptAt).getTime() - new Date(broadcastAt).getTime())
              : null,
          },
        };
      }
    }

    return Response.json({ ok: true, summary, forced_batch: forceBatchRef, forced_batch_result, tick_ms });
  } catch (error) {
    return Response.json({ ok: false, error: error?.message || 'Queue tick failed' }, { status: 500 });
  }
}