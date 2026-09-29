// achievementRequestMaintenance — daily sweep over requests waiting on a
// reviewer. Sends reminder emails at day 7 and day 21 of inactivity, and
// auto-expires requests with no reviewer action after 30 days (notifying the
// student). Runs from the "Achievement Request Maintenance" scheduled workflow.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  PENDING_REVIEWER_STATUSES, DAY_MS,
  logEvent, appendEvent, requestEmailHtml, notifyRequest, appUrl,
} from '../../shared/achievementRequests.ts';
import { sendTrackedEmail, dedupeKey } from '../../shared/emailDelivery.ts';

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
      // Independent verification — a personal email, not an institutional
      // queue: the one-time link expires after 14 days with two reminders
      // (day 3 and day 7). Runs before the generic 30-day organisation logic.
      if (request.verification_mode === 'independent' && request.status === 'awaiting_external_verification') {
        const ivAnchor = request.last_reviewer_action_at || request.submitted_at;
        if (ivAnchor) {
          const ivIdle = (now - new Date(ivAnchor).getTime()) / DAY_MS;
          const expiresAt = request.external_token_expires_at ? new Date(request.external_token_expires_at).getTime() : null;
          if (expiresAt && now >= expiresAt) {
            await svc.entities.AchievementRequest.update(request.id, {
              status: 'expired',
              event_log: appendEvent(request.event_log, logEvent('expired', 'system', 'BlockWard', 'system', 'Independent verification link expired after 14 days')),
            });
            expired++;
            const html = requestEmailHtml(
              'Your verification request expired',
              [
                `The person you nominated to verify <strong>${request.title}</strong> didn't respond within 14 days.`,
                `You can submit it again — or nominate a different verifier.`,
              ],
              `${appUrl()}/StudentBlockWards?tab=pending&request=${request.id}`,
              'View my requests'
            );
            await notifyRequest(svc, request.student_email, `Your verification request for "${request.title}" expired`, html, { event_type: 'request_expired', related_id: request.id, school_id: request.school_id });
            continue;
          }
          const second = ivIdle >= 7 && !request.reminder_2_at;
          if ((ivIdle >= 7 && !request.reminder_2_at) || (ivIdle >= 3 && !request.reminder_1_at)) {
            if (request.external_verifier_email && request.external_token) {
              const html = requestEmailHtml(
                `Reminder: verification request from ${request.student_name || 'a student'}`,
                [
                  `<strong>${request.student_name || 'A student'}</strong> is waiting for you to verify: <strong>${request.title}</strong>.`,
                  `The one-time link expires ${request.external_token_expires_at ? `on ${new Date(request.external_token_expires_at).toUTCString()}` : 'soon'}.`,
                ],
                `${appUrl()}/external-verify/${request.external_token}`,
                'Verify this achievement'
              );
              await notifyRequest(svc, request.external_verifier_email, `Reminder: verify "${request.title}"`, html, { event_type: 'maintenance_reminder', related_id: request.id, school_id: null });
              await svc.entities.AchievementRequest.update(request.id, second
                ? { reminder_2_at: new Date().toISOString() }
                : { reminder_1_at: new Date().toISOString() });
              reminded++;
            }
          }
        }
        continue;
      }

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
          `${appUrl()}/StudentBlockWards?tab=pending&request=${request.id}`,
          'View my requests'
        );
        await notifyRequest(svc, request.student_email, `Your request for "${request.title}" expired`, html, { event_type: 'request_expired', related_id: request.id, school_id: request.school_id });
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
        await notifyRequest(svc, to, `Reminder: "${request.title}" awaits your review`, html, { event_type: 'maintenance_reminder', related_id: request.id, school_id: request.school_id });
      }
      await svc.entities.AchievementRequest.update(request.id, second
        ? { reminder_2_at: new Date().toISOString() }
        : { reminder_1_at: new Date().toISOString() });
      reminded++;
    }

    // ── Safe system retry for failed external-verification emails ──
    // A failed Tier 3 / Independent link email is the one communication
    // failure that can strand an otherwise-healthy verification: the student
    // waits on someone who may never have received the link. The sweep
    // re-sends it, re-rendered from CURRENT state with the EXISTING one-time
    // token — never a replacement token, never a duplicate credential action —
    // and only while the token is still live, capped at MAX_ATTEMPTS.
    const MAX_ATTEMPTS = 3;
    let retried = 0;
    try {
      const failed = await svc.entities.EmailDeliveryLog.filter(
        { status: 'failed', retryable: true },
        { sort: '-created_date', limit: 200 },
      );
      const handledKeys = new Set();
      for (const log of failed || []) {
        if (!['independent_verification_link', 'tier3_external_link'].includes(log.event_type)) continue;
        const reqRows = await svc.entities.AchievementRequest.filter({ id: log.related_id }).catch(() => []);
        const req = reqRows?.[0];
        if (!req || req.status !== 'awaiting_external_verification' || !req.external_token) continue;
        // Once the token has expired the normal expiry path has already told
        // the student — a retry would point at a dead link.
        if (req.external_token_expires_at && new Date(req.external_token_expires_at).getTime() <= Date.now()) continue;
        const key = log.dedupe_key || dedupeKey(log.event_type, req.id, log.recipient_email);
        if (handledKeys.has(key)) continue;
        // Attempt budget across the key's whole history.
        const all = await svc.entities.EmailDeliveryLog.filter({ dedupe_key: key }, '-created_date', 20);
        if ((all?.length || 0) >= MAX_ATTEMPTS) continue;
        handledKeys.add(key);

        const isIndependent = log.event_type === 'independent_verification_link';
        const expiresLine = `on ${new Date(req.external_token_expires_at).toUTCString()}`;
        const subject = isIndependent
          ? `Can you verify an achievement for ${req.student_name || 'a student'}?`
          : `Verify an achievement for ${req.school_name || 'an organisation'}`;
        const html = isIndependent
          ? requestEmailHtml(
              `Can you verify an achievement for ${req.student_name || 'a student'}?`,
              [
                `<strong>${req.student_name || 'A student'}</strong> has asked you to verify: <strong>${req.title}</strong>`,
                req.independent_verifier?.relationship ? `They wrote: <em>"${req.independent_verifier.relationship}"</em>` : null,
                `You were named as their ${(req.independent_verifier?.role || '').replace(/_/g, ' ')}${req.independent_verifier?.organisation_label ? ` at ${req.independent_verifier.organisation_label}` : ''}. If you were in a position to confirm this, follow the link — no account needed.`,
                `The link is one-time and expires ${expiresLine}.`,
              ].filter(Boolean),
              `${appUrl()}/external-verify/${req.external_token}`,
              'Review this achievement'
            )
          : requestEmailHtml(
              `External verification request from ${req.school_name || 'an organisation'}`,
              [
                `${req.student_name || 'A student'} has been awarded <strong>${req.title}</strong>.`,
                `As an independent verifier, please confirm this achievement is accurate.`,
                `This link is one-time use and expires ${expiresLine}.`,
              ],
              `${appUrl()}/external-verify/${req.external_token}`,
              'Verify this achievement'
            );
        await sendTrackedEmail(svc, {
          to: req.external_verifier_email || log.recipient_email,
          subject, html,
          event_type: log.event_type,
          related_type: 'achievement_request',
          related_id: req.id,
          school_id: req.school_id,
          retryable: true,
        });
        retried++;
      }
    } catch (e) { /* the retry pass is best-effort */ }

    console.log(JSON.stringify({ fn: 'achievementRequestMaintenance', pending: pending.length, expired, reminded, retried }));
    return Response.json({ ok: true, pending: pending.length, expired, reminded, retried }, { headers: CORS });
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