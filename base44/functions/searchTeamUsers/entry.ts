/**
 * searchTeamUsers — searches the actor's organisation for existing members to
 * add as teammates on a team achievement. Used by the participant picker in
 * the request form. Returns only public-safe display fields.
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
  try {
    const body = await req.json().catch(() => ({}));
    const query = String(body.query || '').trim().toLowerCase();
    if (query.length < 2) return Response.json({ ok: true, results: [] }, { headers: CORS });

    const base44 = createClientFromRequest(req);
    const actor = await resolveEffectiveActor(base44);
    if (!actor.authorized) {
      return Response.json({ ok: false, error: actor.reason || 'Unauthorized' }, { status: actor.status || 401, headers: CORS });
    }

    const svc = base44.asServiceRole;
    const rows = await svc.entities.UserProfile.filter({ school_id: actor.school_id }, null, 500);

    const results = rows
      .filter((p) => p.user_type === 'student' && p.status !== 'inactive' && p.status !== 'suspended')
      .filter((p) => (p.user_email || '').toLowerCase() !== (actor.actor_email || '').toLowerCase())
      .map((p) => ({
        id: p.id,
        name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.user_email,
        email: p.user_email,
        handle: p.handle || null,
        avatar_url: p.avatar_url || null,
      }))
      .filter((p) =>
        p.name.toLowerCase().includes(query) ||
        (p.email || '').toLowerCase().includes(query) ||
        (p.handle || '').includes(query)
      )
      .slice(0, 8);

    return Response.json({ ok: true, results }, { headers: CORS });
  } catch (e) {
    return Response.json({ ok: false, error: e?.message || String(e) }, { status: 500, headers: CORS });
  }
});