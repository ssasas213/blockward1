// ============================================================================
// historicalVerification — the two-stage historical achievement pipeline:
//
//   student submits → Blockward SUPER ADMIN authorises the proposed verifier →
//   approved verifier confirms (single-use expiring token) → Blockward issues
//   the credential through the SAME Achievement / Credential / Polygon
//   pipeline as every other credential (credentialIssuance.issueCredential).
//
// Security invariants enforced here and in the calling functions:
//   - The Super Admin approval authorises the PERSON, never the achievement.
//   - A LinkedIn profile or professional-looking email alone NEVER establishes
//     authority — the Super Admin must record independent checks.
//   - The verifier token is single-use, expiring, replay-protected, and NEVER
//     stored on the student-readable request record (capability record only).
//   - A durable claim makes concurrent confirmations single-winner — a real
//     credential can never be issued twice for one request.
//   - Demo records (TEST MODE) never email external addresses, never issue
//     real credentials and never touch Polygon — enforced server-side.
//   - The notification recipients (BLOCKWARD_SUPER_ADMIN_NOTIFICATION_EMAILS)
//     are notification DESTINATIONS only and never grant Super Admin access,
//     which is controlled solely by the internal-admin allowlist.
// ============================================================================
import { secrets } from 'base44:runtime';
import { INTERNAL_ADMIN_EMAILS } from './internalAdmin.ts';
import { appBaseUrl } from './verificationFlow.ts';
import { isTestModeEnabled, getTestSuperUserEmail } from './testMode.ts';

export const HISTORICAL_CATEGORIES = [
  'academic', 'sports', 'volunteering', 'competition', 'leadership',
  'certification', 'extracurricular', 'professional_development', 'other',
];
export const CATEGORY_LABELS = {
  academic: 'Academic achievement', sports: 'Sports', volunteering: 'Volunteering',
  competition: 'Competition', leadership: 'Leadership', certification: 'Certification',
  extracurricular: 'Extracurricular activity', professional_development: 'Professional development',
  other: 'Other',
};
export const OPEN_STATUSES = ['pending_review', 'info_requested', 'verifier_authorized', 'verifier_confirmed'];
export const VERIFIER_TOKEN_TTL_HOURS = 72;
export const MAX_OPEN_PER_STUDENT = 5;
export const MAX_VERIFIER_PROPOSALS = 3;
export const DEMO_STUDENT_EMAIL = 'demo.student@blockward.test';

export function lower(v) { return String(v || '').trim().toLowerCase(); }

export function validateLinkedIn(url) {
  if (!url) return true;
  return /^https:\/\/(www\.)?linkedin\.com\/(in|company)\/[A-Za-z0-9_%\-.]+\/?$/i.test(String(url).trim());
}

export function validateHttpUrl(url) {
  if (!url) return false;
  try { const u = new URL(String(url)); return u.protocol === 'https:'; } catch { return false; }
}

// Notification DESTINATIONS for the Super Admin queue. Never a permission.
export function superAdminRecipients() {
  const raw = (secrets.get('BLOCKWARD_SUPER_ADMIN_NOTIFICATION_EMAILS') || '').trim();
  const list = raw.split(',').map((x) => x.trim()).filter(Boolean);
  return list.length ? list : INTERNAL_ADMIN_EMAILS;
}

export function isTestSuper(email) {
  return isTestModeEnabled() && lower(email) === lower(getTestSuperUserEmail());
}

export function pushHEvent(log, event, actor, note) {
  return [...(log || []), { event, actor: actor || 'system', note: note || null, timestamp: new Date().toISOString() }];
}

export async function genRequestRef(svc) {
  for (let i = 0; i < 8; i++) {
    const bytes = crypto.getRandomValues(new Uint8Array(4));
    const ref = 'HAR-' + Array.from(bytes).map((b) => (b % 36).toString(36)).join('').toUpperCase();
    const found = await svc.entities.HistoricalAchievementRequest.filter({ request_ref: ref }).catch(() => []);
    if (!found || found.length === 0) return ref;
  }
  return 'HAR-' + Date.now().toString(36).toUpperCase();
}

export function newVerifierToken() {
  return crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
}

export async function notifyStudentEvent(svc, studentEmail, title, body, type, relatedId) {
  try {
    await svc.entities.Notification.create({
      user_email: studentEmail, title, body, type, related_id: relatedId || null, priority: 'important',
    });
  } catch { /* best-effort — never blocks the flow */ }
}

// Sends a designed email template (base44/emails/<Name>.html) with best-effort
// delivery logging. A failure never blocks the calling state transition.
export async function sendTemplateEmail(svc, opts) {
  const to = (opts.to || '').trim();
  if (!to) return { delivered: false };
  const key = `hist:${opts.event_type || 'email'}:${opts.related_id || 'none'}:${lower(to)}`;
  try {
    const args = { to, template_name: opts.template_name, variables: opts.variables || {} };
    if (opts.subject) args.subject = opts.subject;
    await svc.integrations.Core.SendEmail(args);
    try {
      await svc.entities.EmailDeliveryLog.create({
        event_type: opts.event_type || 'historical_email', recipient_email: to,
        subject: opts.subject || null, related_type: 'historical_request', related_id: opts.related_id || null,
        dedupe_key: key, status: 'sent', provider: 'base44', attempts: 1, retryable: false,
        last_attempted_at: new Date().toISOString(),
      });
    } catch { /* logging never blocks */ }
    return { delivered: true };
  } catch (e) {
    try {
      await svc.entities.EmailDeliveryLog.create({
        event_type: opts.event_type || 'historical_email', recipient_email: to,
        subject: opts.subject || null, related_type: 'historical_request', related_id: opts.related_id || null,
        dedupe_key: key, status: 'failed', provider: 'base44', attempts: 1, retryable: true,
        error: String(e?.message || 'unknown').slice(0, 500), last_attempted_at: new Date().toISOString(),
      });
    } catch { /* best-effort */ }
    return { delivered: false, error: e?.message };
  }
}

export function appUrl() { return appBaseUrl(); }

// ── Verifier token capability (P0/A02 hardening) ────────────────────────────
// The raw verifier token is NEVER stored on the student-readable request
// record. It lives only in the server-only HistoricalVerifierToken capability
// record (every RLS operation there is service-role only) and is looked up by
// its SHA-256 hash. Consumers link the capability to its request by request_ref.
export async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function storeVerifierCapability(svc, requestRef, token, expiresIso, demo) {
  return svc.entities.HistoricalVerifierToken.create({
    request_ref: requestRef, token_hash: await sha256Hex(token),
    token_expires_at: expiresIso, token_used_at: null, demo: !!demo,
    // raw_token is stored ONLY for demo simulation records so the test Super
    // Admin console can rebuild the demo link — never for real records.
    ...(demo ? { raw_token: token } : {}),
  });
}

export async function findVerifierCapabilityByToken(svc, token) {
  try {
    const rows = await svc.entities.HistoricalVerifierToken.filter({ token_hash: await sha256Hex(token) });
    return rows?.[0] || null;
  } catch { return null; }
}

export async function findVerifierCapabilityByRef(svc, requestRef) {
  try {
    const rows = await svc.entities.HistoricalVerifierToken.filter({ request_ref: requestRef });
    return rows?.[0] || null;
  } catch { return null; }
}

export async function markVerifierCapabilityUsed(svc, capabilityId) {
  try {
    await svc.entities.HistoricalVerifierToken.update(capabilityId, { token_used_at: new Date().toISOString() });
  } catch { /* best-effort — the status gates already prevent reuse */ }
}

export async function deleteVerifierCapability(svc, requestRef) {
  try { await svc.entities.HistoricalVerifierToken.deleteMany({ request_ref: requestRef }); } catch { /* best-effort */ }
}