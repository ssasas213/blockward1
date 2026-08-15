/**
 * getNotifications — Returns notifications for the EFFECTIVE actor (persona in
 * Test Mode), bypassing the Notification read RLS which keys on {{user.email}}
 * (the controller) and would hide persona notifications.
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

    const notifications = await base44.asServiceRole.entities.Notification.filter(
      { user_email: actor.actor_email }, '-created_date', 30
    );
    return Response.json({ ok: true, notifications: notifications || [] }, { headers: CORS });
  } catch (error) {
    console.error('[getNotifications] fatal:', error?.message || error);
    return Response.json({ ok: false, error: 'Could not load notifications.' }, { status: 500, headers: CORS });
  }
});