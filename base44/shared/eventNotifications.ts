// Shared per-type notification dispatcher for social & credential events.
// ONE place that reads the recipient's per-type preferences
// (NotificationPreference.prefs[event_type] = { in_app, email }) and delivers
// both the in-app Notification record and (optionally) the Resend email.
// Every event type used here must exist in the Notification entity's type enum.
// Delivery is always best-effort and never throws — a notification failure
// must never block the action that triggered it.

import { sendResendEmail } from './resendEmail.ts';

export const EVENT_TYPES = [
  'endorsement',
  'follow',
  'request_signed_off',
  'request_changes',
  'team_accepted',
  'opportunity_match',
];

export async function notifyEvent(svc: any, opts: {
  to_email: string;
  school_id?: string | null;
  event_type: string;
  title: string;
  body: string;
  related_id?: string | null;
  email_subject?: string;
  email_html?: string | null;
}): Promise<void> {
  const { to_email, event_type, title, body } = opts;
  if (!to_email || !EVENT_TYPES.includes(event_type)) return;

  // Per-type preference — absent record/key/channel means ON (default).
  let pref: any = null;
  try {
    const rows = await svc.entities.NotificationPreference.filter({ user_email: to_email });
    pref = rows?.[0]?.prefs?.[event_type] || null;
  } catch { /* default on */ }

  if (!pref || pref.in_app !== false) {
    try {
      await svc.entities.Notification.create({
        user_email: to_email,
        school_id: opts.school_id || null,
        title,
        body,
        type: event_type,
        priority: 'normal',
        related_id: opts.related_id || null,
        read: false,
      });
    } catch (e: any) {
      console.log('[notifyEvent] in-app failed:', e?.message || e);
    }
  }

  if (opts.email_html && (!pref || pref.email !== false)) {
    const { delivered, error } = await sendResendEmail(to_email, opts.email_subject || title, opts.email_html);
    if (!delivered) console.log('[notifyEvent] email not delivered', { to_email, error });
  }
}