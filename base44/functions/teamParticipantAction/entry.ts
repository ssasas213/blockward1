/**
 * teamParticipantAction — lets a listed teammate view, accept or decline
 * their inclusion in a team achievement.
 *
 * Auth: either a private claim token from their email link (/team-join/:token)
 * or an authenticated session matched by email + team slug.
 *
 * Accepting mints their personal credential (with their role, linked to the
 * shared team record) and emails them a share prompt. Declining removes them
 * from the public team page and revokes any already-minted credential.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { resolveEffectiveActor } from '../../shared/testMode.ts';
import { requestEmailHtml, notifyRequest, appUrl } from '../../shared/achievementRequests.ts';
import { mintTeamParticipantCredential } from '../../shared/teamCredentials.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'content-type': 'application/json'
};

function bad(error, status = 400) {
  return Response.json({ ok: false, error }, { status, headers: CORS });
}

async function findTeamByToken(svc, token) {
  let teams = [];
  try { teams = await svc.entities.TeamCredential.filter({ 'participants.token': token }); } catch (_) { /* dot-path unsupported — fall back */ }
  if (teams?.length) return teams[0];
  try {
    const all = await svc.entities.TeamCredential.filter({}, '-created_date', 1000);
    return all.find((t) => (t.participants || []).some((p) => p.token === token)) || null;
  } catch (_) { return null; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    let team = null;
    let idx = -1;

    if (body.token) {
      team = await findTeamByToken(svc, body.token);
      if (!team) return bad('This invitation link is invalid or has already been used', 404);
      idx = (team.participants || []).findIndex((p) => p.token === body.token);
      if (idx === -1) return bad('This invitation link is invalid', 404);
    } else {
      const actor = await resolveEffectiveActor(base44);
      if (!actor.authorized) {
        return Response.json({ ok: false, error: actor.reason || 'Unauthorized' }, { status: actor.status || 401, headers: CORS });
      }
      if (!body.team_slug) return bad('Missing team_slug');
      const rows = await svc.entities.TeamCredential.filter({ team_slug: body.team_slug });
      team = rows?.[0] || null;
      if (!team) return bad('Team not found', 404);
      idx = (team.participants || []).findIndex((p) => (p.email || '').toLowerCase() === (actor.actor_email || '').toLowerCase());
      if (idx === -1) return bad('You are not listed on this team achievement', 403);
    }

    const participants = [...(team.participants || [])];
    const me = participants[idx];
    const now = new Date().toISOString();

    if (action === 'get') {
      return Response.json({
        ok: true,
        team: {
          title: team.title,
          description: team.description || null,
          category: team.category || 'special',
          date_achieved: team.date_achieved || null,
          organisation_name: team.organisation_name || team.school_name || null,
          team_slug: team.team_slug,
          added_by: participants[0]?.name || null,
        },
        you: {
          name: me.name || null,
          role: me.role || 'Member',
          status: me.status,
          on_blockward: me.on_blockward === true,
          verification_id: me.verification_id || null,
        },
      }, { headers: CORS });
    }

    if (action === 'decline') {
      participants[idx] = { ...me, status: 'declined', responded_at: now };
      await svc.entities.TeamCredential.update(team.id, { participants });
      // Revoke a credential minted by an earlier acceptance.
      if (me.verification_id) {
        try {
          const regs = await svc.entities.BlockWardVerificationRegistry.filter({ verification_id: me.verification_id });
          if (regs?.[0]) {
            await svc.entities.BlockWardVerificationRegistry.update(regs[0].id, { approval_status: 'revoked', is_public: false });
          }
        } catch (_) { /* best-effort */ }
      }
      return Response.json({ ok: true, status: 'declined' }, { headers: CORS });
    }

    if (action === 'accept') {
      if (me.status === 'accepted' && me.verification_id) {
        return Response.json({
          ok: true, status: 'accepted', already: true,
          verification_id: me.verification_id,
          team_slug: team.team_slug,
          handle: me.handle || null,
          on_blockward: me.on_blockward === true,
        }, { headers: CORS });
      }

      const mint = await mintTeamParticipantCredential(svc, team, me);
      if (!mint.ok) return Response.json({ ok: false, error: mint.error }, { status: 500, headers: CORS });

      // Refresh profile info in case they joined BlockWard since the invite.
      let profile = null;
      try {
        const rows = await svc.entities.UserProfile.filter({ user_email: me.email });
        profile = rows?.find((r) => r.user_type === 'student') || rows?.[0] || null;
      } catch (_) { /* best-effort */ }

      const displayName = me.name || (profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : null) || me.email;
      participants[idx] = {
        ...me,
        name: displayName,
        profile_id: profile?.id || me.profile_id || null,
        handle: profile?.handle || me.handle || null,
        avatar_url: profile?.avatar_url || me.avatar_url || null,
        on_blockward: !!profile || me.on_blockward === true,
        status: 'accepted',
        responded_at: now,
        verification_id: mint.verificationId,
      };
      await svc.entities.TeamCredential.update(team.id, { participants });

      // Confirmation + share prompt — the growth surface.
      const teamUrl = `${appUrl()}/team/${team.team_slug}`;
      const handle = participants[idx].handle;
      const html = requestEmailHtml(
        'Your team credential is live',
        [
          `You're now on the verified team record for <strong>${team.title}</strong> as <strong>${me.role}</strong>.`,
          handle
            ? 'Your own credential — with your role — is on your public profile. Share it with your teammates, friends and family.'
            : `Your credential is saved to this email. Create your free BlockWard account with <strong>${me.email}</strong> to put it on your public profile.`,
          'Every teammate who accepts strengthens the same team record — share it:',
        ],
        teamUrl,
        'View the team record'
      );
      await notifyRequest(me.email, `Your credential for "${team.title}" is live`, html);

      return Response.json({
        ok: true,
        status: 'accepted',
        verification_id: mint.verificationId,
        team_slug: team.team_slug,
        handle: handle || null,
        on_blockward: participants[idx].on_blockward,
      }, { headers: CORS });
    }

    return bad('Unknown action');
  } catch (e) {
    return Response.json({ ok: false, error: e?.message || String(e) }, { status: 500, headers: CORS });
  }
});