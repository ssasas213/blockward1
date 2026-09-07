// Shared peer-endorsement rules — one implementation used by endorsementData
// and endorsementAction so scarcity, eligibility and caps behave identically
// everywhere. Endorsements are deliberately scarce: a small per-term budget,
// no roll-over, no anonymity, always attached to a specific achievement.

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