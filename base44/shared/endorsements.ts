// Shared peer-endorsement rules — one implementation used by endorsementData
// and endorsementAction so scarcity, eligibility and caps behave identically
// everywhere. Endorsements are deliberately scarce: a small per-term budget,
// no roll-over, no anonymity, always attached to a specific achievement.

import { notifyEvent } from './eventNotifications.ts';
import { requestEmailHtml, appUrl } from './achievementRequests.ts';

export const DEFAULT_TERM_DAYS = 90;
export const DEFAULT_BUDGET = 3;
export const MAX_ENDORSEMENTS_PER_ACHIEVEMENT = 20;
export const MIN_ENDORSEMENT_CHARS = 20;
export const MAX_ENDORSEMENT_CHARS = 200;
export const INVITE_EXPIRY_DAYS = 14;

/**
 * getOrCreateCurrentTerm — the active term for an organisation, auto-creating
 * a fresh one (length + budget carried over from the latest term, else the
 * 90-day / 3-endorsement defaults) when the previous term has lapsed.
 */
export async function getOrCreateCurrentTerm(svc: any, schoolId: string): Promise<any> {
  if (!schoolId) return null;
  const terms = await svc.entities.EndorsementTerm.filter({ school_id: schoolId });
  const now = new Date();
  const active = terms
    .filter((t: any) => t.status !== 'closed' && new Date(t.start_date) <= now && new Date(t.end_date) > now)
    .sort((a: any, b: any) => new Date(a.start_date) - new Date(b.start_date));
  if (active.length) return active[active.length - 1];

  const latest = [...terms].sort((a: any, b: any) => new Date(b.start_date) - new Date(a.start_date))[0];
  const periodDays = latest?.period_days || DEFAULT_TERM_DAYS;
  const budget = latest?.budget ?? DEFAULT_BUDGET;
  const start = now;
  const end = new Date(start.getTime() + periodDays * 86400000);
  return await svc.entities.EndorsementTerm.create({
    school_id: schoolId,
    name: `Term ${terms.length + 1}`,
    start_date: start.toISOString(),
    end_date: end.toISOString(),
    period_days: periodDays,
    budget,
    status: 'active',
  });
}

/**
 * countBudgetUsed — active endorsements + still-open invites the endorser
 * spent from this term. Revoked endorsements/invites free the slot again.
 */
export async function countBudgetUsed(svc: any, termId: string, endorserId: string): Promise<number> {
  const [endorsements, invites] = await Promise.all([
    svc.entities.Endorsement.filter({ term_id: termId, endorser_id: endorserId }),
    svc.entities.EndorsementInvite.filter({ term_id: termId, endorser_id: endorserId }),
  ]);
  return (
    endorsements.filter((e: any) => e.status !== 'revoked').length +
    invites.filter((i: any) => i.status === 'sent').length
  );
}

/**
 * validateEndorsementText — 20-200 characters of what the endorser
 * personally saw. Returns an error string or null when valid.
 */
export function validateEndorsementText(text: string): string | null {
  const t = (text || '').trim();
  if (t.length < MIN_ENDORSEMENT_CHARS) {
    return `Say a bit more — at least ${MIN_ENDORSEMENT_CHARS} characters about what you personally saw.`;
  }
  if (t.length > MAX_ENDORSEMENT_CHARS) {
    return `Keep it under ${MAX_ENDORSEMENT_CHARS} characters.`;
  }
  return null;
}

/**
 * isEligibleToEndorse — no self-endorsement; the endorser must share an
 * organisation with the recipient, or have been invited by them (a claimed
 * EndorsementInvite created by the recipient).
 */
export async function isEligibleToEndorse(svc: any, actor: any, recipient: any): Promise<{ ok: boolean; reason?: string }> {
  if (actor.actor_id === recipient.id) {
    return { ok: false, reason: "You can't endorse your own achievement." };
  }
  if (actor.school_id && recipient.school_id && actor.school_id === recipient.school_id) {
    return { ok: true };
  }
  try {
    const invites = await svc.entities.EndorsementInvite.filter({ inviter_id: recipient.id, invitee_email: actor.actor_email });
    if (invites.some((i: any) => i.status === 'claimed')) return { ok: true };
  } catch { /* fall through */ }
  return {
    ok: false,
    reason: 'You can only endorse people you share an organisation with — or people who invited you.',
  };
}

/**
 * buildAffiliation — the public affiliation label shown with every
 * endorsement (anonymity is never allowed): 'Student at Riverside High'.
 */
export function buildAffiliation(role: string, schoolName: string | null): string {
  const label = role === 'admin' ? 'Admin' : role === 'teacher' ? 'Teacher' : 'Student';
  return `${label} at ${schoolName || 'their organisation'}`;
}

/**
 * endorseAchievement — the single implementation of the 'endorse' rules,
 * used by endorsementAction (user-authenticated) and the demo seeder
 * (service-role with synthetic actors). Every check the endpoint performs is
 * performed here — nothing is trusted from the caller.
 * opts: { actor, actorProfile, actorName, actorHandle, affiliation,
 *          registryId, text }
 * Returns { ok, error?, status?, remaining, budget, term_end }.
 */
export async function endorseAchievement(svc: any, opts: any) {
  const { actor, actorProfile, actorName, actorHandle, affiliation, registryId, text } = opts;
  if (!registryId) return { ok: false, status: 400, error: 'Missing achievement to endorse.' };

  const regs = await svc.entities.BlockWardVerificationRegistry.filter({ id: registryId });
  const reg = regs[0];
  if (!reg || reg.approval_status !== 'approved') return { ok: false, status: 404, error: 'Achievement not found.' };
  if (!reg.student_id) return { ok: false, status: 400, error: 'This achievement has no verified owner to endorse.' };

  const recipientRows = await svc.entities.UserProfile.filter({ id: reg.student_id });
  const recipient = recipientRows[0];
  if (!recipient) return { ok: false, status: 404, error: 'Recipient profile not found.' };

  const eligibility = await isEligibleToEndorse(svc, actor, recipient);
  if (!eligibility.ok) return { ok: false, status: 403, error: eligibility.reason };

  const term = await getOrCreateCurrentTerm(svc, actorProfile.school_id);
  if (!term) return { ok: false, status: 400, error: 'No active endorsement term.' };

  // Reciprocal trading block — the recipient endorsed the actor this term.
  const reciprocal = await svc.entities.Endorsement.filter({
    term_id: term.id, endorser_id: recipient.id, recipient_id: actor.actor_id,
  });
  if (reciprocal.some((e: any) => e.status === 'active')) {
    return { ok: false, status: 403, error: `${recipient.first_name} endorsed you this term — endorsements can't be traded back.` };
  }

  // One endorsement per endorser per achievement.
  const mine = await svc.entities.Endorsement.filter({ endorser_id: actor.actor_id, registry_id: registryId });
  if (mine.some((e: any) => e.status === 'active')) return { ok: false, status: 403, error: "You've already endorsed this achievement." };

  // Scarcity — the per-term budget.
  const used = await countBudgetUsed(svc, term.id, actor.actor_id);
  if (used >= term.budget) {
    return {
      ok: false, status: 403,
      error: `No endorsements left this term — you've used all ${term.budget}. The budget resets ${new Date(term.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}.`,
    };
  }

  // Vanity-wall cap.
  const onAchievement = await svc.entities.Endorsement.filter({ registry_id: registryId, status: 'active' });
  if (onAchievement.length >= MAX_ENDORSEMENTS_PER_ACHIEVEMENT) {
    return { ok: false, status: 403, error: 'This achievement has reached its endorsement limit.' };
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
    text: text.trim(),
    status: 'active',
  });

  // Per-type notification to the recipient (respects their preferences).
  await notifyEvent(svc, {
    to_email: recipient.user_email,
    school_id: actorProfile.school_id,
    event_type: 'endorsement',
    title: `${actorName} endorsed "${reg.achievement_title}"`,
    body: text.trim().slice(0, 140),
    related_id: registryId,
    email_subject: `${actorName} endorsed your achievement`,
    email_html: requestEmailHtml('You received a peer endorsement', [
      `<strong>${actorName}</strong> (${affiliation}) endorsed your achievement <strong>${reg.achievement_title}</strong>:`,
      `<blockquote style="border-left:3px solid #7c3aed;padding-left:12px;color:#64748b;">${text.trim()}</blockquote>`,
    ], `${appUrl()}/@${recipient.handle || ''}`, 'View my profile'),
  });

  return {
    ok: true,
    remaining: Math.max(0, term.budget - used - 1),
    budget: term.budget,
    term_end: term.end_date,
  };
}