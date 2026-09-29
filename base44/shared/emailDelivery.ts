// ============================================================================
// emailDelivery — persistent delivery observability for important
// transactional emails. Wraps the shared Resend dispatcher so every
// credential-lifecycle email leaves a durable record of its outcome instead
// of discarding { delivered, error } into console logs.
//
// CONTRACT (Phase 5):
//   - Email delivery is ALWAYS best-effort: a failure here never throws and
//     never rolls back the calling credential action. Domain-state success
//     and communication success are fully separated.
//   - 'sent' means the provider ACCEPTED the message for sending — the
//     integration cannot prove inbox delivery, so we never claim 'delivered'.
//   - A short-window dedupe guard stops the same event emailing the same
//     recipient twice (double clicks, retried automations).
//   - Logging failures never block the send; send failures never block the
//     action.
// ============================================================================
import { sendResendEmail } from './resendEmail.ts';

// Same event + recipient will not email again within this window. Long
// enough to swallow double-clicks and concurrent/retried triggers; short
// enough that a legitimately repeated event (a second changes-requested
// round) still emails normally later.
const DEDUPE_WINDOW_MS = 10 * 60 * 1000;

export function dedupeKey(eventType: string, relatedId?: string | null, to?: string): string {
  return `${eventType}:${relatedId || 'none'}:${(to || '').trim().toLowerCase()}`;
}

export async function sendTrackedEmail(svc: any, opts: {
  to: string;
  subject: string;
  html: string;
  event_type: string;
  related_type?: string;
  related_id?: string | null;
  school_id?: string | null;
  retryable?: boolean;
  dedupe_key?: string;
}): Promise<{ delivered: boolean; error?: string; duplicate?: boolean; log_id?: string | null }> {
  const to = (opts.to || '').trim();
  if (!to) return { delivered: false, error: 'no recipient' };
  const key = opts.dedupe_key || dedupeKey(opts.event_type, opts.related_id, to);
  const nowIso = new Date().toISOString();

  // ── Short-window duplicate guard ──
  try {
    const rows = await svc.entities.EmailDeliveryLog.filter({ dedupe_key: key, status: 'sent' }, '-created_date', 5);
    const dup = (rows || []).find((r: any) =>
      r.created_date && Date.now() - new Date(r.created_date).getTime() < DEDUPE_WINDOW_MS
    );
    if (dup) return { delivered: true, duplicate: true, log_id: dup.id };
  } catch { /* dedupe is best-effort — never block the send */ }

  // ── Attempt count for this event+recipient (full retry history retained) ──
  let attempts = 1;
  try {
    const prior = await svc.entities.EmailDeliveryLog.filter({ dedupe_key: key }, '-created_date', 10);
    attempts = (prior?.length || 0) + 1;
  } catch { /* best-effort */ }

  // ── Pending record before the attempt (in-flight visibility) ──
  let log: any = null;
  try {
    log = await svc.entities.EmailDeliveryLog.create({
      event_type: opts.event_type,
      recipient_email: to,
      subject: opts.subject || null,
      related_type: opts.related_type || 'none',
      related_id: opts.related_id || null,
      school_id: opts.school_id || null,
      dedupe_key: key,
      status: 'pending',
      provider: 'resend',
      attempts,
      retryable: opts.retryable === true,
      last_attempted_at: nowIso,
    });
  } catch { /* logging must never block the send */ }

  const result = await sendResendEmail(to, opts.subject, opts.html);

  if (log) {
    try {
      await svc.entities.EmailDeliveryLog.update(log.id, {
        status: result.delivered ? 'sent' : 'failed',
        provider_message_id: result.message_id || null,
        error: result.delivered ? null : String(result.error || 'unknown error').slice(0, 500),
        last_attempted_at: new Date().toISOString(),
      });
    } catch { /* best-effort */ }
  }

  return {
    delivered: result.delivered,
    error: result.delivered ? undefined : result.error,
    log_id: log?.id || null,
  };
}