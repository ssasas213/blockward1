/**
 * markNotificationRead — Marks a notification read for its owner only.
 * Uses resolveEffectiveActor so Test Mode personas manage their own notifications.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { resolveEffectiveActor } from '../../shared/testMode.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'content-type': 'application/json'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  const base44 = createClientFromRequest(req);

  try {
    const actor = await resolveEffectiveActor(base44);
    if (!actor.authorized) return Response.json({ ok: false, error: actor.reason || 'Unauthorized' }, { status: actor.status || 401, headers: CORS });

    let body; try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'Invalid request' }, { status: 400, headers: CORS }); }
    const { notification_id } = body || {};
    if (!notification_id) return Response.json({ ok: false, error: 'Missing notification id' }, { status: 400, headers: CORS });

    const rows = await base44.asServiceRole.entities.Notification.filter({ id: notification_id });
    const n = rows[0];
    if (!n) return Response.json({ ok: false, error: 'Notification not found' }, { status: 404, headers: CORS });
    if (n.user_email !== actor.actor_email) {
      return Response.json({ ok: false, error: 'Not yours' }, { status: 403, headers: CORS });
    }
    if (n.read) return Response.json({ ok: true, already: true }, { headers: CORS });

    await base44.asServiceRole.entities.Notification.update(notification_id, { read: true, read_at: new Date().toISOString() });
    return Response.json({ ok: true }, { headers: CORS });
  } catch (error) {
    console.error('[markNotificationRead] fatal:', error?.message || error);
    return Response.json({ ok: false, error: 'Could not update notification.' }, { status: 500, headers: CORS });
  }
});