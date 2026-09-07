/**
 * socialAction — write-side for the social layer:
 *   follow / unfollow   → one-directional public follows (no approval),
 *                         resolved by handle or profile id
 *   follow_state        → is the viewer following a handle?
 *   react               → toggle one of the four fixed reactions on a public
 *                         achievement (same reaction again = remove,
 *                         different reaction = switch)
 *   set_leaderboard_opt_out → hide yourself from organisation leaderboards
 *
 * Follow notifies the followed person (per-type preferences apply).
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { resolveEffectiveActor } from '../../shared/testMode.ts';
import { notifyEvent } from '../../shared/eventNotifications.ts';
import { requestEmailHtml, appUrl } from '../../shared/achievementRequests.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'content-type': 'application/json',
};

const REACTION_TYPES = ['celebrate', 'clap', 'heart', 'star'];

const bad = (msg: string, status = 400) => Response.json({ ok: false, error: msg }, { status, headers: CORS });
const ok = (data: any = {}) => Response.json({ ok: true, ...data }, { headers: CORS });

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = body.action;

    const actor = await resolveEffectiveActor(base44);
    if (!actor.authorized) return bad(actor.reason || 'Not authorised', actor.status || 403);

    const svc = base44.asServiceRole;
    const profileRows = await svc.entities.UserProfile.filter({ id: actor.actor_id });
    const profile = profileRows?.[0];
    if (!profile) return bad('Profile not found', 404);

    const myName = `${actor.first_name || ''} ${actor.last_name || ''}`.trim() || 'A BlockWard member';
    const myHandle = profile.handle || null;

    // ─────────────── follows ───────────────
    if (action === 'follow' || action === 'unfollow' || action === 'follow_state') {
      let target: any = null;
      if (body.handle) {
        const rows = await svc.entities.UserProfile.filter({ handle: String(body.handle).toLowerCase() });
        target = rows?.[0] || null;
      } else if (body.target_user_id) {
        const rows = await svc.entities.UserProfile.filter({ id: body.target_user_id });
        target = rows?.[0] || null;
      }
      if (!target) return bad('Profile not found', 404);
      if (target.id === actor.actor_id) return bad("You can't follow yourself.");

      const rows = await svc.entities.Follow.filter({ follower_email: actor.actor_email, followed_id: target.id });
      const existing = rows?.[0] || null;

      if (action === 'follow_state') return ok({ following: !!existing });

      if (action === 'unfollow') {
        if (existing) await svc.entities.Follow.delete(existing.id);
        return ok({ following: false });
      }

      if (existing) return ok({ following: true, already: true });

      await svc.entities.Follow.create({
        follower_id: actor.actor_id,
        follower_email: actor.actor_email,
        follower_name: myName,
        follower_handle: myHandle,
        followed_id: target.id,
        followed_email: target.user_email,
        followed_name: `${target.first_name || ''} ${target.last_name || ''}`.trim() || target.user_email,
        followed_handle: target.handle || null,
      });

      const targetName = `${target.first_name || ''} ${target.last_name || ''}`.trim() || 'someone';
      const profileUrl = myHandle ? `${appUrl()}/@${myHandle}` : `${appUrl()}`;
      await notifyEvent(svc, {
        to_email: target.user_email,
        school_id: target.school_id || null,
        event_type: 'follow',
        title: `${myName} followed you`,
        body: 'Your new verified achievements will appear in their feed.',
        related_id: profile.id,
        email_subject: `${myName} is now following you on BlockWard`,
        email_html: requestEmailHtml('You have a new follower', [
          `<strong>${myName}</strong> started following you on BlockWard.`,
          'Your new verified achievements will show up in their activity feed.',
        ], profileUrl, 'See their profile'),
      });
      return ok({ following: true });
    }

    // ─────────────── reactions ───────────────
    if (action === 'react') {
      const registryId = body.registry_id;
      const type = body.type;
      if (!registryId) return bad('Missing achievement.');
      if (!REACTION_TYPES.includes(type)) return bad('Unknown reaction.');

      const rows = await svc.entities.BlockWardVerificationRegistry.filter({ id: registryId });
      const reg = rows?.[0];
      if (!reg || reg.approval_status !== 'approved') return bad('Achievement not found.', 404);

      const mine = (await svc.entities.Reaction.filter({ registry_id: registryId, reactor_email: actor.actor_email }))?.[0] || null;

      if (mine && mine.type === type) {
        await svc.entities.Reaction.delete(mine.id);
        return ok({ my_reactions: [] });
      }
      if (mine) {
        await svc.entities.Reaction.update(mine.id, { type });
        return ok({ my_reactions: [type] });
      }
      await svc.entities.Reaction.create({
        registry_id: registryId,
        verification_id: reg.verification_id || null,
        achievement_title: reg.achievement_title,
        reactor_id: actor.actor_id,
        reactor_email: actor.actor_email,
        reactor_name: myName,
        reactor_handle: myHandle,
        type,
      });
      return ok({ my_reactions: [type] });
    }

    // ─────────────── leaderboard opt-out ───────────────
    if (action === 'set_leaderboard_opt_out') {
      const optOut = body.opt_out === true;
      await svc.entities.UserProfile.update(actor.actor_id, { leaderboard_opt_out: optOut });
      return ok({ leaderboard_opt_out: optOut });
    }

    return bad('Unknown action.');
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || String(e) }, { status: 500, headers: CORS });
  }
}