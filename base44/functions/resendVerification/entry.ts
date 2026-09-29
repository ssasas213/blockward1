// resendVerification — the holder re-sends the verification email after the
// 24h cooldown. The token is unchanged: the original link keeps working until
// it expires or is used.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveEffectiveActor } from '../../shared/testMode.ts';
import { pushEvent, notifyHolder, RESEND_COOLDOWN_MS, REQUEST_TOKEN_DAYS, appBaseUrl } from '../../shared/verificationFlow.ts';
import { sendTrackedEmail } from '../../shared/emailDelivery.ts';
import { issuerVerificationRequestEmail, issuerReminderEmail } from '../../shared/issuerEmails.ts';

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const base44 = createClientFromRequest(req);
    const actor = await resolveEffectiveActor(base44);
    if (!actor.authorized) return Response.json({ error: actor.reason || 'Unauthorized' }, { status: actor.status || 401 });
    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const requestId = String(body.request_id || '');

    const rows = await svc.entities.VerificationRequest.filter({ id: requestId });
    const vr = rows?.[0];
    if (!vr) return Response.json({ error: 'Verification request not found' }, { status: 404 });
    if ((vr.holder_email || '').trim().toLowerCase() !== (actor.actor_email || '').trim().toLowerCase()) {
      return Response.json({ error: 'You can only manage your own verification requests' }, { status: 403 });
    }
    if (!['pending', 'opened'].includes(vr.status)) {
      return Response.json({ error: 'This request has already been resolved' }, { status: 409 });
    }
    if (vr.last_reminder_at && Date.now() - new Date(vr.last_reminder_at).getTime() < RESEND_COOLDOWN_MS) {
      const hours = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - new Date(vr.last_reminder_at).getTime())) / 3600000);
      return Response.json({ error: `You can resend this request in about ${hours} hour${hours === 1 ? '' : 's'}.` }, { status: 429 });
    }

    const nowIso = new Date().toISOString();
    const reviewUrl = `${appBaseUrl()}/issuer-verify/${vr.token}`;
    const first = (vr.reminder_count || 0) === 0;
    const mail = first
      ? issuerVerificationRequestEmail({
          holderName: vr.holder_name, achievementTitle: vr.achievement_title, issuerOrg: vr.issuer_org,
          reviewUrl, expiresInDays: REQUEST_TOKEN_DAYS,
        })
      : issuerReminderEmail({
          holderName: vr.holder_name, achievementTitle: vr.achievement_title, issuerOrg: vr.issuer_org,
          reviewUrl, expiresInDays: REQUEST_TOKEN_DAYS,
        });
    const subject = first ? mail.subject : `${mail.subject} (reminder)`;
    const sent = await sendTrackedEmail(svc, {
      to: vr.issuer_email,
      subject,
      html: mail.html,
      event_type: first ? 'issuer_verification_request' : 'issuer_verification_reminder',
      related_id: vr.id,
      retryable: true,
      dedupe_key: `${first ? 'issuer_verification_request' : 'issuer_verification_reminder'}:${vr.id}:${nowIso}`,
    });

    await svc.entities.VerificationRequest.update(vr.id, {
      email_status: sent.delivered ? 'sent' : 'failed',
      email_sent_at: nowIso,
      reminder_count: (vr.reminder_count || 0) + 1,
      last_reminder_at: nowIso,
      event_log: pushEvent(vr.event_log, 'reminded', actor.actor_email, sent.delivered ? `Verification email re-sent to ${vr.issuer_email}` : `Email delivery failed: ${sent.error || 'unknown'}`),
    });
    await notifyHolder(svc, vr.holder_email, 'Verification request re-sent', `The verification request for "${vr.achievement_title}" was emailed to ${vr.issuer_email} again.`, 'verification_sent', vr.id);

    return Response.json({ ok: true, email_status: sent.delivered ? 'sent' : 'failed' });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to resend verification request' }, { status: 500 });
  }
}