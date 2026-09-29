// requestVerification — the holder asks the achievement's original issuer to
// confirm it. Creates a VerificationRequest with a secure, expiring,
// single-purpose token and emails the issuer. Guards: self-verification,
// disposable addresses, duplicate active requests.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveEffectiveActor } from '../../shared/testMode.ts';
import { pushEvent, notifyHolder, generateRequestToken, REQUEST_TOKEN_DAYS, RESEND_COOLDOWN_MS, appBaseUrl, getActorProfile } from '../../shared/verificationFlow.ts';
import { sendTrackedEmail } from '../../shared/emailDelivery.ts';
import { issuerVerificationRequestEmail } from '../../shared/issuerEmails.ts';
import { isDisposableEmail, selfVerificationError } from '../../shared/independentVerification.ts';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const base44 = createClientFromRequest(req);
    const actor = await resolveEffectiveActor(base44);
    if (!actor.authorized) return Response.json({ error: actor.reason || 'Unauthorized' }, { status: actor.status || 401 });
    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const achievementId = String(body.achievement_id || '');

    const rows = await svc.entities.Achievement.filter({ id: achievementId });
    const ach = rows?.[0];
    if (!ach) return Response.json({ error: 'Achievement not found' }, { status: 404 });
    if ((ach.holder_email || '').trim().toLowerCase() !== (actor.actor_email || '').trim().toLowerCase()) {
      return Response.json({ error: 'You can only request verification for your own achievements' }, { status: 403 });
    }

    if (!['unverified', 'rejected'].includes(ach.status)) {
      return Response.json({ error: 'A verification request is already active for this achievement' }, { status: 409 });
    }
    const issuerOrg = String(ach.issuer_org || '').trim();
    if (!issuerOrg) return Response.json({ error: 'Add the issuing organisation before requesting verification' }, { status: 400 });

    const issuerEmail = String(body.issuer_email || ach.issuer_email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(issuerEmail)) return Response.json({ error: 'A valid issuer email is required' }, { status: 400 });
    if (isDisposableEmail(issuerEmail)) return Response.json({ error: 'Disposable email addresses cannot be used for verification' }, { status: 400 });
    const selfErr = selfVerificationError(issuerEmail, actor.actor_email);
    if (selfErr) return Response.json({ error: selfErr }, { status: 400 });

    const dupes = await svc.entities.VerificationRequest.filter({ achievement_id: achievementId, status: { $in: ['pending', 'opened'] } });
    if ((dupes || []).length > 0) {
      return Response.json({ error: 'A verification request is already active for this achievement' }, { status: 409 });
    }

    // 24h cooldown per achievement — protects issuers from repeat emails.
    const existing = await svc.entities.VerificationRequest.filter({ achievement_id: achievementId }, '-created_date', 1);
    const last = existing?.[0];
    if (last?.last_reminder_at && Date.now() - new Date(last.last_reminder_at).getTime() < RESEND_COOLDOWN_MS) {
      return Response.json({ error: 'A verification request was sent recently. You can resend after 24 hours.' }, { status: 429 });
    }

    const profile = await getActorProfile(svc, actor.actor_email);
    const holderName = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : actor.actor_email;
    const token = generateRequestToken();
    const nowIso = new Date().toISOString();
    const expiresAt = new Date(Date.now() + REQUEST_TOKEN_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const request = await svc.entities.VerificationRequest.create({
      achievement_id: achievementId,
      holder_id: ach.holder_id,
      holder_email: ach.holder_email,
      holder_name: holderName || ach.holder_name,
      achievement_title: ach.title,
      issuer_org: issuerOrg,
      issuer_contact_name: String(body.issuer_contact_name || ach.issuer_contact_name || '').slice(0, 120).trim() || null,
      issuer_email: issuerEmail,
      issuer_website: ach.issuer_website || null,
      token,
      token_expires_at: expiresAt,
      status: 'pending',
      email_status: 'pending',
      reminder_count: 0,
      event_log: [{ event: 'created', actor: actor.actor_email, timestamp: nowIso }],
    });

    // Issuer registry (upsert by email) — for platform observability.
    try {
      const is = await svc.entities.Issuer.filter({ email: issuerEmail });
      if (is?.[0]) {
        await svc.entities.Issuer.update(is[0].id, { last_activity_at: nowIso, request_count: (is[0].request_count || 0) + 1, name: is[0].name || issuerOrg, website: is[0].website || ach.issuer_website || null, contact_name: is[0].contact_name || ach.issuer_contact_name || null });
      } else {
        await svc.entities.Issuer.create({ email: issuerEmail, name: issuerOrg, contact_name: ach.issuer_contact_name || null, website: ach.issuer_website || null, first_request_at: nowIso, last_activity_at: nowIso, request_count: 1, confirmed_count: 0, declined_count: 0 });
      }
    } catch { /* best-effort */ }

    // The professional verification email — the ONLY way the issuer reaches the page.
    const reviewUrl = `${appBaseUrl()}/issuer-verify/${token}`;
    const mail = issuerVerificationRequestEmail({
      holderName: holderName || ach.holder_name || 'A Blockward user',
      achievementTitle: ach.title,
      issuerOrg,
      dateAchieved: ach.date_achieved,
      credentialId: ach.external_credential_id,
      category: ach.category,
      reviewUrl,
      expiresInDays: REQUEST_TOKEN_DAYS,
    });
    const sent = await sendTrackedEmail(svc, {
      to: issuerEmail,
      subject: mail.subject,
      html: mail.html,
      event_type: 'issuer_verification_request',
      related_type: 'achievement_request',
      related_id: request.id,
      retryable: true,
    });

    await svc.entities.VerificationRequest.update(request.id, {
      email_status: sent.delivered ? 'sent' : 'failed',
      email_sent_at: nowIso,
      last_reminder_at: nowIso,
      event_log: pushEvent(request.event_log, sent.delivered ? 'email_sent' : 'email_failed', 'system', sent.delivered ? `Verification email sent to ${issuerEmail}` : `Email delivery failed: ${sent.error || 'unknown'}`),
    });
    await svc.entities.Achievement.update(achievementId, {
      status: 'verification_requested',
      verification_request_id: request.id,
      event_log: pushEvent(ach.event_log, 'verification_requested', actor.actor_email, `Verification requested from ${issuerOrg} (${issuerEmail})`),
    });
    await notifyHolder(svc, ach.holder_email, 'Verification request sent', `Your verification request for "${ach.title}" was emailed to ${issuerEmail}.`, 'verification_sent', request.id);

    return Response.json({
      ok: true,
      request: { id: request.id, issuer_email: issuerEmail, token_expires_at: expiresAt, email_status: sent.delivered ? 'sent' : 'failed' },
    });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to create verification request' }, { status: 500 });
  }
}