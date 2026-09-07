/**
 * publicTeamData — public shared team credential page (/team/:slug).
 * No auth required. Lists every participant with their role, avatar and
 * handle (linking to their public profile). Pending participants show as
 * pending; declined participants are excluded entirely — nobody appears on a
 * public record without consenting. Never returns emails or claim tokens.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'content-type': 'application/json'
};

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const slug = String(body.team_slug || '').trim();
    if (!slug) return Response.json({ ok: false, error: 'not_found' }, { status: 404, headers: CORS });

    let teams = [];
    try { teams = await svc.entities.TeamCredential.filter({ team_slug: slug }); } catch (e) { /* empty */ }
    const team = teams?.[0] || null;
    if (!team) return Response.json({ ok: false, error: 'not_found' }, { status: 404, headers: CORS });

    const participants = (team.participants || [])
      .filter((p) => p.status !== 'declined')
      .map((p) => p.status === 'accepted' ? {
        name: p.name || 'Teammate',
        role: p.role || 'Member',
        status: 'accepted',
        handle: p.handle || null,
        avatar_url: p.avatar_url || null,
        profile_url: p.handle ? `/@${p.handle}` : null,
        verification_id: p.verification_id || null,
      } : {
        name: p.name || 'Invited teammate',
        role: p.role || 'Member',
        status: 'pending',
        handle: null,
        avatar_url: null,
        profile_url: null,
        verification_id: null,
      });

    return Response.json({
      ok: true,
      team: {
        title: team.title,
        description: team.description || null,
        category: team.category || 'special',
        date_achieved: team.date_achieved || null,
        organisation_name: team.organisation_name || team.school_name || null,
        team_slug: team.team_slug,
        verification_id: team.verification_id || null,
        verifier_name: team.verifier_name || null,
        participants,
        accepted_count: participants.filter((p) => p.status === 'accepted').length,
        pending_count: participants.filter((p) => p.status === 'pending').length,
      },
    }, { headers: CORS });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500, headers: CORS });
  }
}