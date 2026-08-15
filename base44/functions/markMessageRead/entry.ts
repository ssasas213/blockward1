/**
 * markMessageRead — Marks a direct message read for its recipient only.
 * Uses resolveEffectiveActor so Test Mode personas mark their own messages.
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
    const { message_id } = body || {};
    if (!message_id) return Response.json({ ok: false, error: 'Missing message id' }, { status: 400, headers: CORS });

    const rows = await base44.asServiceRole.entities.Message.filter({ id: message_id });
    const msg = rows[0];
    if (!msg) return Response.json({ ok: false, error: 'Message not found' }, { status: 404, headers: CORS });

    // Only the recipient may mark a message read (never the sender's own copy).
    if (msg.recipient_email !== actor.actor_email && msg.recipient_profile_id !== actor.actor_id) {
      return Response.json({ ok: false, error: 'You can only mark messages sent to you as read.' }, { status: 403, headers: CORS });
    }
    if (msg.read) return Response.json({ ok: true, already: true }, { headers: CORS });

    await base44.asServiceRole.entities.Message.update(message_id, {
      read: true,
      read_at: new Date().toISOString(),
      status: 'read',
    });
    return Response.json({ ok: true }, { headers: CORS });
  } catch (error) {
    console.error('[markMessageRead] fatal:', error?.message || error);
    return Response.json({ ok: false, error: 'Could not mark message read.' }, { status: 500, headers: CORS });
  }
});