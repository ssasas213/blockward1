// Shared per-type notification dispatcher for social & credential events.
// ONE place that reads the recipient's per-type preferences
// (NotificationPreference.prefs[event_type] = { in_app, email }).
//
// In-app Notification records are created instantly when enabled.
//
// EMAIL IS NOT SENT INSTANTLY: every event type here is batched into ONE
// daily digest email per recipient (sendDailyDigest, run by the
// "Daily Social Digest" workflow). The digest honors the SAME per-type
// email preference, and skips notifications the user already read in-app —
// quiet by default, never more than one email a day, fully opt-out.

export const EVENT_TYPES = [
  'endorsement',
  'follow',
  'request_signed_off',
  'request_changes',
  'team_accepted',
  'opportunity_match',
  'view_milestone',
  'org_approved',
  // Classwork events — same opt-out prefs + daily-digest batching as the rest.
  'classwork_posted',
  'classwork_due_soon',
  'classwork_returned',
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

  // Email: nothing instant — the daily digest (sendDailyDigest) picks this
  // notification up within 24h and respects prefs[event_type].email there.
}