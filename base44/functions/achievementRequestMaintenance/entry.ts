// achievementRequestMaintenance — daily sweep over requests waiting on a
// reviewer. Sends reminder emails at day 7 and day 21 of inactivity, and
// auto-expires requests with no reviewer action after 30 days (notifying the
// student). Runs from the "Achievement Request Maintenance" scheduled workflow.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  PENDING_REVIEWER_STATUSES, DAY_MS,
  logEvent, appendEvent, requestEmailHtml, notifyRequest, appUrl,
} from '../../shared/achievementRequests.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'content-type': 'application/json',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    const pending = [];
    for (const status of PENDING_REVIEWER_STATUSES) {
      const rows = await svc.entities.AchievementRequest.filter({ status }, '-created_date', 200);
      pending.push(...rows);
    }

    const now = Date.now();
    let expired = 0;
    let reminded = 0;

    for (const request of pending) {
      const anchor = request.last_reviewer_action_at || request.resubmitted_at || request.submitted_at;
      if (!anchor) continue;
      const idleDays = (now - new Date(anchor).getTime()) / DAY_MS;

      // ── 30 days of inactivity → auto-expire ──
      if (idleDays >= 30) {
        await svc.entities.AchievementRequest.update(request.id, {
          status: 'expired',
          event_log: appendEvent(request.event_log, logEvent('expired', 'system', 'BlockWard', 'system', 'No reviewer action for 30 days')),
        });
        expired++;
        const html = requestEmailHtml(
          'Your achievement request expired',
          [
            `Your request for <strong>${request.title}</strong> expired without a reviewer responding within 30 days.`,
            `You can submit it again — or nominate a different verifier.`,
          ],
          `${appUrl()}/AchievementRequests`,
          'View my requests'
        );
        await notifyRequest(request.student_email, `Your request for "${request.title}" expired`, html);
        continue;
      }

      // ── Day 7 and day 21 reminders ──
      const shouldRemind = (idleDays >= 21 && !request.reminder_2_at) || (idleDays >= 7 && !request.reminder_1_at);
      if (!shouldRemind) continue;

      const second = idleDays >= 21 && !request.reminder_2_at;
      const recipients = await pendingReviewers(svc, request);
      for (const to of recipients) {
        const html = requestEmailHtml(
          `Reminder: achievement request awaiting review`,
          [
            `<strong>${request.student_name || 'A student'}</strong>'s request for <strong>${request.title}</strong> has been waiting for ${Math.floor(idleDays)} days.`,
            `It will expire automatically if no one reviews it within ${Math.ceil(30 - idleDays)} days.`,
          ],
          `${appUrl()}/PendingSignoffs`,
          'Review queue'
        );
        await notifyRequest(to, `Reminder: "${request.title}" awaits your review`, html);
      }
      await svc.entities.AchievementRequest.update(request.id, second
        ? { reminder_2_at: new Date().toISOString() }
        : { reminder_1_at: new Date().toISOString() });
      reminded++;
    }

    console.log(JSON.stringify({ fn: 'achievementRequestMaintenance', pending: pending.length, expired, reminded }));
    return Response.json({ ok: true, pending: pending.length, expired, reminded }, { headers: CORS });
  } catch (e) {
    return Response.json({ ok: false, error: e?.message || String(e) }, { status: 500, headers: CORS });
  }
});

// Who should act on this request right now?
async function pendingReviewers(svc, request) {
  if (request.status === 'awaiting_external_verification') {
    return request.external_verifier_email ? [request.external_verifier_email] : [];
  }
  if (request.status === 'awaiting_second_approval') {
    const admins = await svc.entities.UserProfile.filter({ school_id: request.school_id, user_type: 'admin' });
    return admins.map((a) => a.user_email).filter(Boolean);
  }
  return request.nominated_verifier_email ? [request.nominated_verifier_email] : [];
}