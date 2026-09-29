// requestOrgVerification — the holder sends an achievement to a REGISTERED
// Issuer Organisation's verification queue. The organisation's verification
// policy determines how many verifier signatures are required. The legacy
// token-email flow (requestVerification) is untouched and still available.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { authActor, resolvePolicy } from '../../shared/orgVerification.ts';
import { pushEvent, notifyHolder, generateRequestToken, REQUEST_TOKEN_DAYS, appBaseUrl } from '../../shared/verificationFlow.ts';
import { sendTrackedEmail } from '../../shared/emailDelivery.ts';
import { orgNewRequestEmail } from '../../shared/orgEmails.ts';

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const base44 = createClientFromRequest(req);
    const { email, error } = await authActor(base44);
    if (error) return error;
    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const achievementId = String(body.achievement_id || '');

    const rows = await svc.entities.Achievement.filter({ id: achievementId });
    const ach = rows?.[0];
    if (!ach) return Response.json({ error: 'Achievement not found' }, { status: 404 });
    if ((ach.holder_email || '').trim().toLowerCase() !== email) {
      return Response.json({ error: 'You can only request verification for your own achievements' }, { status: 403 });
    }
    if (!['unverified', 'rejected'].includes(ach.status)) {
      return Response.json({ error: 'A verification request is already active for this achievement' }, { status: 409 });
    }

    const orgRows = await svc.entities.IssuerOrganisation.filter({ id: String(body.org_id || '') });
    const org = orgRows?.[0];
    if (!org) return Response.json({ error: 'Issuer organisation not found' }, { status: 404 });
    if (org.status !== 'verified') {
      return Response.json({ error: `"${org.name}" hasn't completed Blockward verification yet, so it cannot accept verification requests` }, { status: 409 });
    }

    const dupes = await svc.entities.VerificationRequest.filter({ achievement_id: achievementId, status: { $in: ['pending', 'opened'] } });
    if ((dupes || []).length > 0) {
      return Response.json({ error: 'A verification request is already active for this achievement' }, { status: 409 });
    }

    // Resolve the organisation's policy for this achievement category.
    const policy = await resolvePolicy(svc, org.id, ach.category);
    const required = Math.max(1, Math.min(5, Number(policy.required_signatures) || 1));

    const nowIso = new Date().toISOString();
    const request = await svc.entities.VerificationRequest.create({
      achievement_id: achievementId,
      holder_id: ach.holder_id,
      holder_email: ach.holder_email,
      holder_name: ach.holder_name,
      achievement_title: ach.title,
      issuer_org: org.name,
      issuer_contact_name: null,
      issuer_email: org.contact_email || org.owner_email,
      issuer_website: org.website || ach.issuer_website || null,
      org_id: org.id,
      org_name: org.name,
      org_handle: org.handle || null,
      org_logo_url: org.logo_url || null,
      policy_id: policy.id || null,
      required_signatures: required,
      signature_count: 0,
      token: generateRequestToken(),
      token_expires_at: new Date(Date.now() + REQUEST_TOKEN_DAYS * 24 * 60 * 60 * 1000).toISOString(),
      status: 'pending',
      email_status: 'pending',
      reminder_count: 0,
      event_log: [{ event: 'created', actor: email, note: `Verification requested from ${org.name}${required > 1 ? ` — joint verification, ${required} signatures required` : ''}`, timestamp: nowIso }],
    });

    await svc.entities.Achievement.update(achievementId, {
      status: 'verification_requested',
      verification_request_id: request.id,
      event_log: pushEvent(ach.event_log, 'verification_requested', email, `Verification requested from ${org.name}`),
    });

    // ── Notify the organisation: contact email + every ACTIVE verifier ──
    const members = await svc.entities.OrganisationMember.filter({ org_id: org.id, status: 'active' }).catch(() => []);
    const recipients = new Set<string>();
    if (org.contact_email) recipients.add(String(org.contact_email).toLowerCase());
    for (const m of members || []) {
      if ((m.user_email || '').toLowerCase() !== email) recipients.add(String(m.user_email).toLowerCase());
    }
    const dashboardUrl = `${appBaseUrl()}/organisation`;
    const mail = orgNewRequestEmail({
      orgName: org.name, holderName: ach.holder_name || 'A Blockward holder',
      achievementTitle: ach.title, dateAchieved: ach.date_achieved,
      credentialId: ach.external_credential_id, dashboardUrl,
    });
    let anySent = false;
    for (const to of recipients) {
      const sent = await sendTrackedEmail(svc, {
        to, subject: mail.subject, html: mail.html,
        event_type: 'issuer_verification_request', related_type: 'achievement_request', related_id: request.id, retryable: true,
      });
      if (sent.delivered) anySent = true;
    }
    // Specific verifiers (policy) get an individual heads-up too.
    for (const to of (policy.specific_verifier_emails || [])) {
      if (!recipients.has(to)) {
        await sendTrackedEmail(svc, { to, subject: mail.subject, html: mail.html, event_type: 'issuer_verification_request', related_type: 'achievement_request', related_id: request.id, retryable: true }).catch(() => {});
      }
    }
    await svc.entities.VerificationRequest.update(request.id, {
      email_status: anySent ? 'sent' : 'failed',
      email_sent_at: nowIso,
      last_reminder_at: nowIso,
    });

    // In-app notifications for active verifiers.
    for (const m of members || []) {
      if ((m.user_email || '').toLowerCase() === email) continue;
      await notifyHolder(svc, m.user_email, 'New verification request', `${ach.holder_name || 'A holder'} submitted "${ach.title}" for verification by ${org.name}.`, 'org_verification_requested', request.id).catch(() => {});
    }

    await notifyHolder(svc, ach.holder_email, 'Verification request sent', `Your achievement "${ach.title}" is now in ${org.name}'s verification queue${required > 1 ? ` (${required} verifier signatures required)` : ''}.`, 'verification_sent', request.id);

    return Response.json({
      ok: true,
      request: { id: request.id, org_name: org.name, required_signatures: required },
    });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to create verification request' }, { status: 500 });
  }
}