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

    const summary = await processAnchorQueue(base44.asServiceRole, { forceBatchRef });
    return Response.json({ ok: true, summary, forced_batch: forceBatchRef });
  } catch (error) {
    return Response.json({ ok: false, error: error?.message || 'Queue tick failed' }, { status: 500 });
  }
}