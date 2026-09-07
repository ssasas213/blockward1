/**
 * opportunities.ts — shared logic for the opportunities marketplace.
 * Credential matching (opportunity requirements vs a student's verified
 * credentials), public credential mapping, verified-credential lookup and
 * notification helper. Used by opportunityData + opportunityAction.
 */

const STOP_WORDS = new Set(['a', 'an', 'the', 'of', 'in', 'at', 'for', 'and', 'or', 'to', 'with', 'on', 'by', 'my']);

export function normalizeText(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function significantTokens(s: string): string[] {
  return normalizeText(s).split(' ').filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}

/**
 * Overlap strength between a requirement label and a credential title:
 * containment either way wins outright; otherwise the number of shared
 * significant words (0 = no match).
 */
export function requirementOverlap(requirement: any, cred: any): number {
  if (!requirement?.label || !cred?.achievement_title) return 0;
  if (requirement.category && cred.achievement_category && requirement.category !== cred.achievement_category) {
    return 0;
  }
  const label = normalizeText(requirement.label);
  const title = normalizeText(cred.achievement_title);
  if (!label || !title) return 0;
  if (title.includes(label) || label.includes(title)) return Infinity;
  const reqTokens = significantTokens(requirement.label);
  const titleTokens = significantTokens(cred.achievement_title);
  const shared = reqTokens.filter((t) => titleTokens.includes(t)).length;
  // Single-word requirements match on that word alone; multi-word ones need
  // at least two shared words so generic words like "final" don't false-match.
  return shared >= (reqTokens.length === 1 ? 1 : 2) ? shared : 0;
}

/**
 * A verified credential satisfies a requirement when categories are
 * compatible and the title meaningfully matches the label.
 */
export function credentialMatchesRequirement(requirement: any, cred: any): boolean {
  return requirementOverlap(requirement, cred) > 0;
}

export function mapCredentialPublic(c: any) {
  return {
    registry_id: c.id,
    verification_id: c.verification_id,
    title: c.achievement_title,
    category: c.achievement_category,
    organisation_name: c.organisation_name || null,
    date_achieved: c.date_achieved || null,
    is_team_credential: !!c.is_team_credential,
    participant_role: c.participant_role || null,
  };
}

/**
 * Match a student's verified credentials against an opportunity's required
 * and preferred credential requirements. Each requirement is annotated with
 * the credential that satisfies it (or null), so the UI can highlight
 * matched credentials and name the missing ones.
 */
export function computeMatch(opportunity: any, credentials: any[]) {
  const mapReq = (req: any) => {
    // Pick the strongest match, not just the first.
    const matched = (credentials || [])
      .map((c) => ({ c, score: requirementOverlap(req, c) }))
      .filter((m: any) => m.score > 0)
      .sort((a: any, b: any) => b.score - a.score)[0]?.c || null;
    return {
      label: req.label,
      category: req.category || null,
      met: !!matched,
      matched_credential: matched ? mapCredentialPublic(matched) : null,
    };
  };
  const requirements = (opportunity?.required_credentials || []).map(mapReq);
  const preferred = (opportunity?.preferred_credentials || []).map(mapReq);
  const matchedCount = requirements.filter((r: any) => r.met).length;
  return {
    requirements,
    preferred,
    matched_count: matchedCount,
    total_required: requirements.length,
    unmet_required: requirements.filter((r: any) => !r.met),
    full_match: requirements.length > 0 && matchedCount === requirements.length,
  };
}

/** All approved (non-revoked) public credentials for a student, across every organisation. */
export async function getVerifiedCredentials(svc: any, student_email: string): Promise<any[]> {
  const rows = await svc.entities.BlockWardVerificationRegistry.filter({ student_email });
  return rows.filter((r: any) => (r.approval_status || 'approved') === 'approved');
}

/** Best-effort in-app notification. Never throws — messaging must not block the action. */
export async function notifyUser(svc: any, user_email: string, school_id: string | null, title: string, body: string, related_id: string | null) {
  try {
    await svc.entities.Notification.create({
      user_email,
      school_id: school_id || null,
      title,
      body,
      type: 'message',
      priority: 'normal',
      related_id,
      read: false,
    });
  } catch (e: any) {
    console.error('[opportunities] notification failed:', e?.message || e);
  }
}

/** True while the listing's deadline hasn't passed (null deadline = rolling). */
export function isDeadlineOpen(opportunity: any): boolean {
  if (!opportunity?.application_deadline) return true;
  const deadline = new Date(opportunity.application_deadline);
  deadline.setHours(23, 59, 59, 999);
  return deadline >= new Date();
}