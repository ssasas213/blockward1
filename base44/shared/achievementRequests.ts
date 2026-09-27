// Shared constants, helpers and email templates for the student-initiated
// achievement request flow. Used by achievementRequestData,
// achievementRequestAction and achievementRequestMaintenance.
import { sendResendEmail } from './resendEmail.ts';

// Statuses that count as "open" for the 10-open-requests cap.
export const OPEN_STATUSES = [
  'submitted', 'under_review', 'changes_requested', 'verifier_signed',
  'awaiting_second_approval', 'awaiting_external_verification',
];

// Statuses waiting on a reviewer (anchors the reminder / expiry clock).
export const PENDING_REVIEWER_STATUSES = [
  'submitted', 'under_review', 'verifier_signed',
  'awaiting_second_approval', 'awaiting_external_verification',
];

// Queues shown on the Pending Sign-offs page.
export const VERIFIER_ACTIONABLE = ['submitted', 'under_review'];
export const ADMIN_ACTIONABLE = ['submitted', 'under_review', 'awaiting_second_approval'];

export const VERIFICATION_METHODS = [
  'witnessed_in_person', 'reviewed_evidence', 'official_records', 'third_party', 'other',
];

export const METHOD_LABELS = {
  witnessed_in_person: 'Witnessed in person',
  reviewed_evidence: 'Reviewed submitted evidence',
  official_records: 'Confirmed against official records',
  third_party: 'Confirmed with a third party',
  other: 'Other',
};

export const ATTESTATION_TEXT = 'I confirm this achievement is accurate and I am authorised to verify it.';

export const OPEN_REQUEST_LIMIT = 10;
export const WEEKLY_PER_ORG_LIMIT = 3;
export const DAY_MS = 24 * 60 * 60 * 1000;

export function appUrl(): string {
  return Deno.env.get('APP_URL') || 'https://blockward.me';
}

export function logEvent(event: string, actorEmail?: string, actorName?: string, actorRole?: string, note?: string) {
  return {
    event,
    actor_email: actorEmail || null,
    actor_name: actorName || null,
    actor_role: actorRole || null,
    note: note || null,
    timestamp: new Date().toISOString(),
  };
}

export function appendEvent(log: any[] | undefined, entry: any) {
  return [...(log || []), entry];
}

export function buildSignerChain(request: any): any[] {
  const chain: any[] = [];
  const s = (signoff: any, role: string, name?: string, email?: string) => {
    if (!signoff) return;
    chain.push({
      role,
      name: name || signoff.signer_name || signoff.name || null,
      email: email || signoff.signer_email || signoff.email || null,
      method: signoff.method || null,
      method_note: signoff.method_note || null,
      attestation: signoff.attestation === true,
      ip_country: signoff.ip_country || null,
      timestamp: signoff.signed_at || null,
    });
  };
  s(request.verifier_signoff, 'Nominated verifier');
  s(request.admin_signoff, 'Organisation admin');
  // For independently verified credentials the signer's real role is shown
  // (e.g. "Coach") so the verification chain reads as a personal attestation,
  // not an institutional one.
  s(request.external_signoff, request.verification_mode === 'independent'
    ? (request.external_signoff?.role || 'Independent verifier')
    : 'External verifier');
  return chain;
}

// Rejection-rate abuse signal: rejected / total (excluding drafts) across a
// student's requests to one organisation. Flagged when >= 5 total and > 40%.
export async function rejectionStatsFor(svc: any, studentEmail: string, schoolId: string) {
  const rows = await svc.entities.AchievementRequest.filter({ student_email: studentEmail, school_id: schoolId });
  const total = rows.filter((r: any) => r.status !== 'draft').length;
  const rejected = rows.filter((r: any) => r.status === 'rejected').length;
  const rate = total > 0 ? rejected / total : 0;
  return {
    total,
    rejected,
    rate,
    flagged: total >= 5 && rate > 0.4,
  };
}

export function requestEmailHtml(heading: string, lines: string[], ctaUrl?: string, ctaText?: string): string {
  const body = lines.map((l) => `<p style="color:#475569;margin:0 0 10px;">${l}</p>`).join('');
  const cta = ctaUrl
    ? `<p style="margin:24px 0 0;"><a href="${ctaUrl}" style="background:#7c3aed;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600;">${ctaText || 'Open BlockWard'}</a></p>`
    : '';
  return `<div style="font-family:Inter,Arial,sans-serif;max-width:520px;">
    <h3 style="color:#5b21b6;margin:0 0 16px;">${heading}</h3>
    ${body}${cta}
  </div>`;
}

export async function notifyRequest(to: string, subject: string, html: string) {
  return sendResendEmail(to, subject, html);
}