/**
 * endorsementData — read-side for the peer endorsement system.
 *
 * Modes:
 *  - { mode: 'invite_lookup', token }  → PUBLIC. Resolves an endorsement
 *    invite by its one-time token for the /endorsement-invite/:token landing
 *    page. No auth required. Returns only public-safe invite fields.
 *  - {} (authenticated) → the current user's endorsement dashboard data:
 *    term + remaining balance, endorsements given/received, invites sent,
 *    auto-claim of pending invites addressed to their email, and org admin
 *    funnel stats (invites sent/claimed/conversion).
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { resolveEffectiveActor } from '../../shared/testMode.ts';
import { getOrCreateCurrentTerm, countBudgetUsed } from '../../shared/endorsements.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));

    // ---------- PUBLIC: invite landing lookup ----------
    if (body.mode === 'invite_lookup') {
      if (!body.token) return Response.json({ ok: false, error: 'Missing token' }, { status: 400 });
      const invites = await svc.entities.EndorsementInvite.filter({ token: body.token });
      const invite = invites[0];
      if (!invite) return Response.json({ ok: false, error: 'not_found' }, { status: 404 });
      if (invite.status === 'claimed') return Response.json({ ok: false, error: 'claimed' }, { status: 410 });
      if (invite.status === 'revoked') return Response.json({ ok: false, error: 'revoked' }, { status: 410 });
      if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
        await svc.entities.EndorsementInvite.update(invite.id, { status: 'expired' });
        return Response.json({ ok: false, error: 'expired' }, { status: 410 });
      }
      return Response.json({
        ok: true,
        invite: {
          endorser_name: invite.endorser_name,
          endorser_handle: invite.endorser_handle || null,
          endorser_affiliation: invite.endorser_affiliation || null,
          achievement_title: invite.achievement_title,
          text: invite.text,
          invitee_email: invite.invitee_email || null,
          invited_at: invite.invited_at || null,
        },
      });
    }

    // ---------- AUTHENTICATED: dashboard data ----------
    const actor = await resolveEffectiveActor(base44);
    if (!actor.authorized) {
      return Response.json({ ok: false, error: actor.reason }, { status: actor.status || 403 });
    }

    const profileRows = await svc.entities.UserProfile.filter({ id: actor.actor_id });
    const profile = profileRows[0];
    if (!profile) return Response.json({ ok: false, error: 'Profile not found' }, { status: 404 });

    // Auto-claim: any pending invite addressed to this email converts into an
    // active Endorsement the moment the invitee first loads their dashboard.
    let claimed = 0;
    const pendingInvites = await svc.entities.EndorsementInvite.filter({ invitee_email: profile.user_email, status: 'sent' });
    for (const invite of pendingInvites) {
      if (invite.expires_at && new Date(invite.expires_at) < new Date()) continue;
      await svc.entities.Endorsement.create({
        school_id: invite.school_id,
        term_id: invite.term_id || null,
        term_start: null,
        term_end: null,
        endorser_id: invite.endorser_id,
        endorser_email: invite.endorser_email,
        endorser_name: invite.endorser_name,
        endorser_handle: invite.endorser_handle || null,
        endorser_affiliation: invite.endorser_affiliation || null,
        recipient_id: profile.id,
        recipient_email: profile.user_email,
        recipient_name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
        recipient_handle: profile.handle || null,
        registry_id: null,
        achievement_title: invite.achievement_title,
        achievement_verification_id: null,
        text: invite.text,
        status: 'active',
        via_invite_id: invite.id,
      });
      await svc.entities.EndorsementInvite.update(invite.id, {
        status: 'claimed',
        claimed_at: new Date().toISOString(),
        claimed_profile_id: profile.id,
      });
      claimed++;
    }

    // Term + balance
    const term = profile.school_id ? await getOrCreateCurrentTerm(svc, profile.school_id) : null;
    let balance = null;
    if (term) {
      const used = await countBudgetUsed(svc, term.id, actor.actor_id);
      balance = {
        budget: term.budget,
        used,
        remaining: Math.max(0, term.budget - used),
        term: {
          id: term.id,
          name: term.name,
          start_date: term.start_date,
          end_date: term.end_date,
          period_days: term.period_days,
          budget: term.budget,
        },
      };
    }

    // Given / received / invites (recent 20 each, public-safe mapping)
    const [givenRows, receivedRows, inviteRows] = await Promise.all([
      svc.entities.Endorsement.filter({ endorser_id: profile.id }, '-created_date', 20),
      svc.entities.Endorsement.filter({ recipient_id: profile.id, status: 'active' }, '-created_date', 20),
      svc.entities.EndorsementInvite.filter({ endorser_id: profile.id }, '-created_date', 20),
    ]);

    const mapEndorsement = (e: any) => ({
      id: e.id,
      achievement_title: e.achievement_title,
      registry_id: e.registry_id || null,
      text: e.text,
      status: e.status,
      created_date: e.created_date,
      endorser: {
        name: e.endorser_name,
        handle: e.endorser_handle || null,
        affiliation: e.endorser_affiliation || null,
      },
      recipient_name: e.recipient_name,
      recipient_handle: e.recipient_handle || null,
    });

    // Admin funnel stats for the org admin dashboard
    let admin = null;
    if (actor.actor_role === 'admin' && profile.school_id) {
      const [allInvites, termEndorsements] = await Promise.all([
        svc.entities.EndorsementInvite.filter({ school_id: profile.school_id }),
        term ? svc.entities.Endorsement.filter({ school_id: profile.school_id, term_id: term.id }) : Promise.resolve([]),
      ]);
      const sent = allInvites.filter((i: any) => i.status !== 'revoked').length;
      const claimedCount = allInvites.filter((i: any) => i.status === 'claimed').length;
      admin = {
        invites_sent: sent,
        invites_claimed: claimedCount,
        conversion_rate: sent > 0 ? Math.round((claimedCount / sent) * 100) : 0,
        endorsements_this_term: termEndorsements.filter((e: any) => e.status === 'active').length,
        term: balance?.term || null,
      };
    }

    return Response.json({
      ok: true,
      claimed,
      balance,
      given: givenRows.filter((e: any) => e.status !== 'revoked').map(mapEndorsement),
      received: receivedRows.map(mapEndorsement),
      invites: inviteRows.map((i: any) => ({
        id: i.id,
        invitee_email: i.invitee_email || null,
        invitee_phone: i.invitee_phone || null,
        channel: i.channel,
        achievement_title: i.achievement_title,
        text: i.text,
        status: i.status,
        invited_at: i.invited_at || null,
        claimed_at: i.claimed_at || null,
        claim_url: i.claim_url || null,
        email_status: i.email_status || null,
      })),
      admin,
    });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}