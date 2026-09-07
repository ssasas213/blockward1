/**
 * endorsementAction — write-side for the peer endorsement system. Every rule
 * is enforced here (never trusted from the client):
 *
 *  - endorse: 20-200 char first-hand text, no self-endorsement, no reciprocal
 *    endorsement within the same term, shared organisation (or invited-by),
 *    budget of N per term (default 3, no roll-over), max 20 per achievement.
 *  - invite: endorse someone WITHOUT an account via email/phone. Creates an
 *    EndorsementInvite + sends the claim email (Resend). Consumes budget.
 *  - revoke: endorser or org admin revokes — frees the budget slot.
 *  - admin_update_term: org admin configures period length (default 90 days)
 *    and per-term budget.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { resolveEffectiveActor } from '../../shared/testMode.ts';
import {
  getOrCreateCurrentTerm, countBudgetUsed, validateEndorsementText,
  isEligibleToEndorse, buildAffiliation, MAX_ENDORSEMENTS_PER_ACHIEVEMENT,
  INVITE_EXPIRY_DAYS,
} from '../../shared/endorsements.ts';
import { sendResendEmail } from '../../shared/resendEmail.ts';

const bad = (msg: string, status = 400) => Response.json({ ok: false, error: msg }, { status });

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = body.action;

    // ---------- PUBLIC actions: none ----------

    const actor = await resolveEffectiveActor(base44);
    if (!actor.authorized) return bad(actor.reason || 'Not authorised', actor.status || 403);

    const svc = base44.asServiceRole;
    const actorProfiles = await svc.entities.UserProfile.filter({ id: actor.actor_id });
    const actorProfile = actorProfiles[0];
    if (!actorProfile) return bad('Profile not found', 404);
    if (!actorProfile.school_id) return bad('Join an organisation before endorsing anyone.');

    const textError = validateEndorsementText(body.text);
    if (textError) return bad(textError);

    const actorName = `${actor.first_name || ''} ${actor.last_name || ''}`.trim() || 'A BlockWard member';
    const actorHandle = actorProfile.handle || null;
    const schools = await svc.entities.School.filter({ id: actorProfile.school_id });
    const affiliation = buildAffiliation(actor.actor_role, schools[0]?.name || null);

    // ================= endorse an existing member's achievement =================
    if (action === 'endorse') {
      const registryId = body.registry_id;
      if (!registryId) return bad('Missing achievement to endorse.');

      const regs = await svc.entities.BlockWardVerificationRegistry.filter({ id: registryId });
      const reg = regs[0];
      if (!reg || reg.approval_status !== 'approved') return bad('Achievement not found.', 404);
      if (!reg.student_id) return bad('This achievement has no verified owner to endorse.');

      const recipientRows = await svc.entities.UserProfile.filter({ id: reg.student_id });
      const recipient = recipientRows[0];
      if (!recipient) return bad('Recipient profile not found.', 404);

      const eligibility = await isEligibleToEndorse(svc, actor, recipient);
      if (!eligibility.ok) return bad(eligibility.reason, 403);

      const term = await getOrCreateCurrentTerm(svc, actorProfile.school_id);
      if (!term) return bad('No active endorsement term.');

      // Reciprocal trading block — the recipient endorsed the actor this term.
      const reciprocal = await svc.entities.Endorsement.filter({
        term_id: term.id, endorser_id: recipient.id, recipient_id: actor.actor_id,
      });
      if (reciprocal.some((e: any) => e.status === 'active')) {
        return bad(`${recipient.first_name} endorsed you this term — endorsements can't be traded back.`, 403);
      }

      // One endorsement per endorser per achievement.
      const mine = await svc.entities.Endorsement.filter({ endorser_id: actor.actor_id, registry_id: registryId });
      if (mine.some((e: any) => e.status === 'active')) return bad("You've already endorsed this achievement.", 403);

      // Scarcity — the per-term budget.
      const used = await countBudgetUsed(svc, term.id, actor.actor_id);
      if (used >= term.budget) {
        return bad(`No endorsements left this term — you've used all ${term.budget}. The budget resets ${new Date(term.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}.`, 403);
      }

      // Vanity-wall cap.
      const onAchievement = await svc.entities.Endorsement.filter({ registry_id: registryId, status: 'active' });
      if (onAchievement.length >= MAX_ENDORSEMENTS_PER_ACHIEVEMENT) {
        return bad('This achievement has reached its endorsement limit.', 403);
      }

      await svc.entities.Endorsement.create({
        school_id: actorProfile.school_id,
        term_id: term.id,
        term_start: term.start_date,
        term_end: term.end_date,
        endorser_id: actor.actor_id,
        endorser_email: actor.actor_email,
        endorser_name: actorName,
        endorser_handle: actorHandle,
        endorser_affiliation: affiliation,
        recipient_id: recipient.id,
        recipient_email: recipient.user_email,
        recipient_name: `${recipient.first_name || ''} ${recipient.last_name || ''}`.trim(),
        recipient_handle: recipient.handle || null,
        registry_id: registryId,
        achievement_title: reg.achievement_title,
        achievement_verification_id: reg.verification_id || null,
        text: body.text.trim(),
        status: 'active',
      });

      return Response.json({
        ok: true,
        remaining: Math.max(0, term.budget - used - 1),
        budget: term.budget,
        term_end: term.end_date,
      });
    }

    // ================= invite someone without an account =================
    if (action === 'invite') {
      const inviteeEmail = (body.invitee_email || '').trim().toLowerCase();
      const inviteePhone = (body.invitee_phone || '').trim();
      const achievementTitle = (body.achievement_title || '').trim();
      if (!inviteeEmail && !inviteePhone) return bad('Enter an email address or phone number.');
      if (!achievementTitle) return bad('Name the achievement you saw them do.');
      if (inviteeEmail === actor.actor_email) return bad("You can't endorse yourself.");
      if (inviteeEmail) {
        const existing = await svc.entities.UserProfile.filter({ user_email: inviteeEmail });
        if (existing.length > 0) {
          return bad('They already have a BlockWard account — open their profile and endorse the achievement directly.');
        }
      }

      const term = await getOrCreateCurrentTerm(svc, actorProfile.school_id);
      const used = await countBudgetUsed(svc, term.id, actor.actor_id);
      if (used >= term.budget) {
        return bad(`No endorsements left this term — you've used all ${term.budget}.`, 403);
      }

      // One open invite per (invitee, achievement).
      if (inviteeEmail) {
        const dupInvites = await svc.entities.EndorsementInvite.filter({ endorser_id: actor.actor_id, invitee_email: inviteeEmail });
        if (dupInvites.some((i: any) => i.status === 'sent' && i.achievement_title === achievementTitle)) {
          return bad("You've already invited them about this achievement.");
        }
      }

      const token = crypto.randomUUID();
      const appUrl = (Deno.env.get('APP_URL') || '').replace(/\/$/, '');
      const claimUrl = `${appUrl}/endorsement-invite/${token}`;
      const now = new Date();

      const invite = await svc.entities.EndorsementInvite.create({
        school_id: actorProfile.school_id,
        term_id: term.id,
        token,
        endorser_id: actor.actor_id,
        endorser_email: actor.actor_email,
        endorser_name: actorName,
        endorser_handle: actorHandle,
        endorser_affiliation: affiliation,
        inviter_id: actor.actor_id,
        inviter_email: actor.actor_email,
        invitee_email: inviteeEmail || null,
        invitee_phone: inviteePhone || null,
        channel: inviteeEmail ? 'email' : 'phone',
        achievement_title: achievementTitle,
        text: body.text.trim(),
        claim_url: claimUrl,
        status: 'sent',
        invited_at: now.toISOString(),
        expires_at: new Date(now.getTime() + INVITE_EXPIRY_DAYS * 86400000).toISOString(),
      });

      let emailStatus = null;
      if (inviteeEmail) {
        const html = `
          <div style="font-family:Inter,system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#17121F">
            <p style="font-size:15px;line-height:1.5;margin:0 0 24px">
              <strong>${actorName}</strong> vouched for your work on
              <strong>${achievementTitle}</strong>.
            </p>
            <blockquote style="border-left:3px solid #8B5CF6;margin:0 0 24px;padding:4px 16px;color:#6F6878;font-size:14px">
              "${body.text.trim()}"
            </blockquote>
            <a href="${claimUrl}" style="display:inline-block;background:#7C3AED;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 24px;border-radius:10px">
              Claim it &rarr;
            </a>
            <p style="font-size:12px;color:#8A8499;margin:24px 0 0">
              The endorsement is waiting for you on BlockWard. Sign up with <strong>${inviteeEmail}</strong> to claim it.
            </p>
          </div>`;
        const result = await sendResendEmail(
          inviteeEmail,
          `${actorName} vouched for your work on "${achievementTitle}"`,
          html,
        );
        emailStatus = result.delivered ? 'sent' : 'failed';
        await svc.entities.EndorsementInvite.update(invite.id, {
          email_status: emailStatus,
          email_error: result.error || null,
        });
      }

      return Response.json({
        ok: true,
        invite: {
          claim_url: claimUrl,
          channel: inviteeEmail ? 'email' : 'phone',
          email_status: emailStatus,
          email_error: emailStatus === 'failed' ? 'Email delivery failed — share the claim link directly.' : null,
        },
        remaining: Math.max(0, term.budget - used - 1),
        budget: term.budget,
        term_end: term.end_date,
      });
    }

    // ================= revoke (endorser or org admin) =================
    if (action === 'revoke') {
      if (!body.endorsement_id) return bad('Missing endorsement.');
      const rows = await svc.entities.Endorsement.filter({ id: body.endorsement_id });
      const endorsement = rows[0];
      if (!endorsement) return bad('Endorsement not found.', 404);
      if (endorsement.endorser_id !== actor.actor_id && actor.actor_role !== 'admin') {
        return bad('Only the endorser or an organisation admin can revoke.', 403);
      }
      await svc.entities.Endorsement.update(endorsement.id, {
        status: 'revoked',
        revoked_at: new Date().toISOString(),
        revoked_reason: body.reason || null,
      });
      return Response.json({ ok: true });
    }

    // ================= admin: term settings =================
    if (action === 'admin_update_term') {
      if (actor.actor_role !== 'admin') return bad('Organisation admins only.', 403);
      const term = await getOrCreateCurrentTerm(svc, actorProfile.school_id);
      const update: any = {};
      if (body.period_days) {
        const days = Math.max(7, Math.min(365, Number(body.period_days)));
        update.period_days = days;
        update.end_date = new Date(new Date(term.start_date).getTime() + days * 86400000).toISOString();
      }
      if (body.budget) update.budget = Math.max(1, Math.min(10, Number(body.budget)));
      await svc.entities.EndorsementTerm.update(term.id, update);
      return Response.json({ ok: true, updated: update });
    }

    return bad('Unknown action.');
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}