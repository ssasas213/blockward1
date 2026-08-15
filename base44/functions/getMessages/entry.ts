/**
 * getMessages — Returns the effective actor's direct messages + same-school
 * contacts + effective profile for the Messages page.
 *
 * Service-role reads bypass RLS so Test Mode personas see their own inbox
 * (the Message read RLS keys on {{user.email}} = controller, which would hide
 * persona messages). Contacts are filtered to the same active school, excluding
 * the effective persona (no self-messaging, no cross-school, no duplicates).
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
    if (!actor.school_id) return Response.json({ ok: true, profile: null, messages: [], contacts: [] }, { headers: CORS });

    const svc = base44.asServiceRole;

    const [sent, received, schoolProfiles] = await Promise.all([
      svc.entities.Message.filter({ school_id: actor.school_id, sender_email: actor.actor_email }),
      svc.entities.Message.filter({ school_id: actor.school_id, recipient_email: actor.actor_email }),
      svc.entities.UserProfile.filter({ school_id: actor.school_id }),
    ]);

    const map = new Map();
    [...sent, ...received].forEach(m => map.set(m.id, m));
    const messages = Array.from(map.values()).sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

    const contacts = schoolProfiles
      .filter(p => p.id !== actor.actor_id && p.user_email !== actor.actor_email)
      .filter(p => !p.status || p.status === 'active')
      .map(p => ({
        id: p.id,
        user_email: p.user_email,
        first_name: p.first_name,
        last_name: p.last_name,
        user_type: p.user_type,
      }));

    return Response.json({
      ok: true,
      profile: {
        id: actor.actor_id,
        user_email: actor.actor_email,
        first_name: actor.first_name,
        last_name: actor.last_name,
        user_type: actor.actor_role,
        school_id: actor.school_id,
      },
      messages,
      contacts,
    }, { headers: CORS });
  } catch (error) {
    console.error('[getMessages] fatal:', error?.message || error);
    return Response.json({ ok: false, error: 'Could not load messages.' }, { status: 500, headers: CORS });
  }
});