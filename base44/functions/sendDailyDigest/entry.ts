/**
 * sendDailyDigest — ONE email per user per day summarising yesterday's social
 * & credential notifications. In-app they arrive instantly; this is the
 * batched, quiet-by-default email channel.
 *
 *   - Honors per-type email preferences (NotificationPreference.prefs[type].email).
 *   - Skips notifications the user already read in-app — no redundant email.
 *   - Marks everything it processed with digested_at so nothing is re-sent.
 *
 * Called daily by the "Daily Social Digest" workflow.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { EVENT_TYPES } from '../../shared/eventNotifications.ts';
import { sendResendEmail } from '../../shared/resendEmail.ts';

const TYPE_LABELS: Record<string, string> = {
  endorsement: 'Endorsement',
  follow: 'New follower',
  request_signed_off: 'Achievement verified',
  request_changes: 'Change requested',
  team_accepted: 'Team credential',
  opportunity_match: 'Opportunity match',
  view_milestone: 'Profile milestone',
  org_approved: 'Organisation approval',
  classwork_posted: 'New classwork',
  classwork_due_soon: 'Due soon',
  classwork_returned: 'Classwork returned',
};

function escapeHtml(s: string): string {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function appUrl() {
  return Deno.env.get('APP_URL') || 'https://blockward.base44.app';
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const since = Date.now() - 24 * 60 * 60 * 1000;

    let notifications: any[] = [];
    try { notifications = await svc.entities.Notification.list('-created_date', 500); } catch (e) { /* empty */ }

    // Pending digest items: social/credential types, unread, not yet digested,
    // created in the last 24h.
    const pending = notifications.filter((n) =>
      EVENT_TYPES.includes(n.type) &&
      !n.digested_at &&
      !n.read &&
      new Date(n.created_date).getTime() > since
    );

    const byUser: Record<string, any[]> = {};
    for (const n of pending) {
      if (!n.user_email) continue;
      (byUser[n.user_email] = byUser[n.user_email] || []).push(n);
    }

    const nowIso = new Date().toISOString();
    let emailsSent = 0;
    const digestedUpdates: any[] = [];

    for (const [email, items] of Object.entries(byUser)) {
      // Mark everything as handled — even items filtered out by email prefs
      // or already read, so the digest never revisits them.
      for (const n of items) digestedUpdates.push({ id: n.id, digested_at: nowIso });

      // Per-type email preferences.
      let prefRow: any = null;
      try {
        const rows = await svc.entities.NotificationPreference.filter({ user_email: email });
        prefRow = rows[0] || null;
      } catch { /* defaults on */ }
      const allowed = items.filter((n) => {
        const p = prefRow?.prefs?.[n.type];
        return !p || p.email !== false;
      });
      if (!allowed.length) continue;

      const listHtml = allowed
        .map((n) => `<li style="margin:0 0 10px;"><span style="color:#7c3aed;font-weight:600;">${TYPE_LABELS[n.type] || 'Update'}</span><br/>${escapeHtml(n.title)}<br/><span style="color:#64748b;font-size:13px;">${escapeHtml(n.body)}</span></li>`)
        .join('');

      const html = `<div style="font-family:Inter,system-ui,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
        <p style="font-size:18px;font-weight:700;margin:0 0 4px;">Your BlockWard day</p>
        <p style="color:#64748b;font-size:13px;margin:0 0 20px;">A quick summary of the last 24 hours — you've already seen these in the app.</p>
        <ul style="list-style:none;padding:0;margin:0 0 20px;">${listHtml}</ul>
        <p style="margin:0 0 8px;"><a href="${appUrl()}/StudentDashboard" style="background:#7c3aed;color:#ffffff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:600;display:inline-block;">Open BlockWard</a></p>
        <p style="color:#94a3b8;font-size:12px;margin:0;">You can change or turn off these emails anytime — Profile → Preferences → Social &amp; credential updates.</p>
      </div>`;

      const { delivered } = await sendResendEmail(
        email,
        `BlockWard — ${allowed.length} update${allowed.length === 1 ? '' : 's'} from the last 24h`,
        html,
      );
      if (delivered) emailsSent++;
    }

    if (digestedUpdates.length) {
      try { await svc.entities.Notification.bulkUpdate(digestedUpdates); } catch (e) { /* best-effort */ }
    }

    return Response.json({
      ok: true,
      pending: pending.length,
      recipients: Object.keys(byUser).length,
      emails_sent: emailsSent,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}