// orgVerificationReview — the Verifier's decision endpoint for organisation
// requests. THE authority is an ACTIVE, authenticated membership of the
// organisation. Signing requires an EXPLICIT per-verification authorisation:
// the verifier must send the id of their stored signature and tick the
// confirmation — a stored signature is NEVER attached automatically.
// Joint verification: issuer verification completes only when
// signature_count >= required_signatures, then the shared issuance pipeline
// (BW-HASH-V1 → Polygon anchor → public verification) takes over.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { authActor, requireActiveMember } from '../../shared/orgVerification.ts';
import { pushEvent, notifyHolder, rateLimit, appBaseUrl } from '../../shared/verificationFlow.ts';
import { issueCredential } from '../../shared/credentialIssuance.ts';
import { sendTrackedEmail } from '../../shared/emailDelivery.ts';
import { additionalSignatureEmail, holderSignatureReceivedEmail } from '../../shared/orgEmails.ts';
import { holderRejectedEmail, methodLabel } from '../../shared/issuerEmails.ts';

const METHODS = new Set(['witnessed_in_person', 'reviewed_evidence', 'official_records', 'third_party', 'other']);

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const base44 = createClientFromRequest(req);
    const { email, error } = await authActor(base44);
    if (error) return error;
    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const requestId = String(body.request_id || '');
    const decision = String(body.action || '');
    if (!['approve', 'reject'].includes(decision)) return Response.json({ error: 'Invalid action' }, { status: 400 });
    if (!rateLimit(`ovr:${requestId.slice(0, 12)}:${email.slice(0, 12)}`, 10, 60000)) {
      return Response.json({ error: 'Too many attempts. Please wait a minute.' }, { status: 429 });
    }

    const reqRows = await svc.entities.VerificationRequest.filter({ id: requestId });
    const vr = reqRows?.[0];
    if (!vr || !vr.org_id) return Response.json({ error: 'Verification request not found' }, { status: 404 });

    // ── Authorisation: ACTIVE member of the request's organisation ──
    const membership = await requireActiveMember(svc, email, vr.org_id);
    if (!membership) return Response.json({ error: 'You are not an active verifier of this organisation' }, { status: 403 });
    await svc.entities.OrganisationMember.update(membership.id, { last_active_at: new Date().toISOString() }).catch(() => {});

    const achRows = await svc.entities.Achievement.filter({ id: vr.achievement_id });
    const ach = achRows?.[0];
    if (!ach) return Response.json({ error: 'Achievement not found' }, { status: 404 });
    if ((ach.holder_email || '').toLowerCase() === email) {
      return Response.json({ error: 'You cannot verify your own achievement' }, { status: 403 });
    }

    if (!['pending', 'opened'].includes(vr.status)) {
      return Response.json({ error: 'This request has already been completed', state: vr.status }, { status: 409 });
    }

    const nowIso = new Date().toISOString();
    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || null;

    // ── REJECT ──
    if (decision === 'reject') {
      const reason = String(body.reason || '').slice(0, 500);
      await svc.entities.VerificationRequest.update(vr.id, {
        status: 'rejected',
        decision: 'cannot_verify',
        decision_method: METHODS.has(body.method) ? body.method : 'reviewed_evidence',
        decision_reason: reason,
        decision_ip: ip,
        responded_at: nowIso,
        event_log: pushEvent(vr.event_log, 'declined', email, `Rejected by ${membership.full_name || email}${reason ? `: ${reason}` : ''}`),
      });
      await svc.entities.Achievement.update(ach.id, {
        status: 'rejected',
        reject_reason: reason,
        event_log: pushEvent(ach.event_log, 'issuer_declined', email, `${vr.org_name} could not verify${reason ? `: ${reason}` : ''}`),
      });
      const mail = holderRejectedEmail({ achievementTitle: ach.title, issuerOrg: vr.org_name || 'the issuer', reason });
      await sendTrackedEmail(svc, { to: ach.holder_email, subject: mail.subject, html: mail.html, event_type: 'request_rejected', related_id: vr.id, retryable: true });
      await notifyHolder(svc, ach.holder_email, 'Verification declined', `${vr.org_name} could not verify "${ach.title}". Nothing was published.`, 'achievement_rejected', ach.id);
      return Response.json({ ok: true, outcome: 'declined' });
    }

    // ── APPROVE & SIGN ──
    const method = METHODS.has(body.method) ? body.method : null;
    if (!method) return Response.json({ error: 'Please choose how you verified this achievement' }, { status: 400 });
    if (body.consent !== true) {
      return Response.json({ error: 'You must explicitly confirm and authorise your stored signature for this verification' }, { status: 400 });
    }
    const signatureId = String(body.signature_id || '');
    const sigRows = await svc.entities.VerifierSignature.filter({ id: signatureId, user_email: email, active: true });
    const storedSig = sigRows?.[0];
    if (!storedSig) return Response.json({ error: 'Set up your signature in My Signature first — it must be confirmed as yours' }, { status: 400 });

    // One signature per verifier per request.
    const already = await svc.entities.VerificationSignature.filter({ request_id: vr.id, verifier_email: email });
    if (already?.length) return Response.json({ error: 'You have already signed this verification' }, { status: 409 });

    // Policy restriction — if the policy names specific verifiers, only they may sign.
    if (vr.policy_id) {
      const polRows = await svc.entities.VerificationPolicy.filter({ id: vr.policy_id });
      const policy = polRows?.[0];
      if (policy && Array.isArray(policy.specific_verifier_emails) && policy.specific_verifier_emails.length > 0
        && !policy.specific_verifier_emails.map((e: string) => String(e).toLowerCase()).includes(email)) {
        return Response.json({ error: 'This verification is restricted to specific named verifiers under the organisation policy' }, { status: 403 });
      }
    }

    // Mark opened (first reviewer).
    if (vr.status === 'pending') {
      await svc.entities.VerificationRequest.update(vr.id, {
        status: 'opened', opened_at: vr.opened_at || nowIso, open_count: (vr.open_count || 0) + 1,
      }).catch(() => {});
    }

    const newCount = (vr.signature_count || 0) + 1;
    const required = Math.max(1, Number(vr.required_signatures) || 1);
    const verifierName = membership.full_name || email;
    const verifierTitle = membership.job_title || 'Verifier';

    await svc.entities.VerificationSignature.create({
      request_id: vr.id,
      achievement_id: vr.achievement_id,
      org_id: vr.org_id,
      verifier_email: email,
      verifier_name: verifierName,
      verifier_title: verifierTitle,
      verifier_user_id: membership.user_id || null,
      signature_id: storedSig.id,
      signature_image_url: storedSig.image_url || null,
      verification_method: method,
      decision_note: String(body.method_note || '').slice(0, 500) || null,
      signed_at: nowIso,
      decision_ip: ip,
    });

    await svc.entities.VerificationRequest.update(vr.id, {
      signature_count: newCount,
      event_log: pushEvent(vr.event_log, 'signed', email, `${verifierName} (${verifierTitle}) signed — ${newCount} of ${required} signatures`),
    });
    await svc.entities.Achievement.update(ach.id, {
      event_log: pushEvent(ach.event_log, 'issuer_confirmed', email, `${verifierName} signed (${newCount} of ${required} signatures)`),
    });

    // ── Threshold not yet reached → AWAITING SIGNATURES ──
    if (newCount < required) {
      const mail = holderSignatureReceivedEmail({ achievementTitle: ach.title, orgName: vr.org_name, verifierName, signaturesSoFar: newCount, required });
      await sendTrackedEmail(svc, { to: ach.holder_email, subject: mail.subject, html: mail.html, event_type: 'issuer_confirmed', related_id: vr.id, retryable: true });
      await notifyHolder(svc, ach.holder_email, 'Signature received', `${verifierName} (${vr.org_name}) signed "${ach.title}" — ${newCount} of ${required} signatures complete.`, 'org_signature_received', ach.id);

      // Nudge the remaining verifiers who still need to sign.
      let remaining = await svc.entities.OrganisationMember.filter({ org_id: vr.org_id, status: 'active' }).catch(() => []);
      const signedEmails = new Set([email]);
      if (vr.policy_id) {
        const polRows = await svc.entities.VerificationPolicy.filter({ id: vr.policy_id });
        const pol = polRows?.[0];
        if (pol && Array.isArray(pol.specific_verifier_emails) && pol.specific_verifier_emails.length > 0) {
          remaining = (remaining || []).filter((m: any) => pol.specific_verifier_emails.includes(m.user_email));
        }
      }
      const nudged: string[] = [];
      for (const m of remaining || []) {
        const me = String(m.user_email || '').toLowerCase();
        if (!me || signedEmails.has(me) || me === (ach.holder_email || '').toLowerCase()) continue;
        const s = await svc.entities.VerificationSignature.filter({ request_id: vr.id, verifier_email: me }).catch(() => []);
        if (s?.length) continue;
        const nud = additionalSignatureEmail({ orgName: vr.org_name, achievementTitle: ach.title, holderName: ach.holder_name || 'a holder', signedBy: verifierName, dashboardUrl: `${appBaseUrl()}/organisation` });
        await sendTrackedEmail(svc, { to: me, subject: nud.subject, html: nud.html, event_type: 'issuer_verification_request', related_type: 'achievement_request', related_id: vr.id, retryable: true }).catch(() => {});
        nudged.push(me);
      }
      await svc.entities.VerificationRequest.update(vr.id, {
        event_log: pushEvent((await svc.entities.VerificationRequest.filter({ id: vr.id }))[0]?.event_log, 'additional_signature_requested', 'system', nudged.length ? `Signature request sent to ${nudged.length} verifier(s)` : null),
      }).catch(() => {});

      return Response.json({ ok: true, outcome: 'signed', signatures: newCount, required });
    }

    // ── Threshold reached → ISSUER VERIFIED → credential → Polygon ──
    await svc.entities.VerificationRequest.update(vr.id, {
      status: 'approved',
      decision: 'confirmed',
      decision_method: method,
      responded_at: nowIso,
      event_log: pushEvent(vr.event_log, 'threshold_reached', email, `All ${required} required signatures received — issuer verification complete`),
    });

    // A PENDING organisation cannot mint Blockward Verified credentials — its
    // queue can receive requests and collect signatures, but the blockchain
    // credential is only issued once Blockward has verified the organisation.
    if (vr.org_id) {
      const orgRows = await svc.entities.IssuerOrganisation.filter({ id: vr.org_id }).catch(() => []);
      const org = orgRows?.[0];
      if (org && org.status !== 'verified') {
        await svc.entities.Achievement.update(ach.id, {
          status: 'issuer_confirmed',
          event_log: pushEvent(ach.event_log, 'issuer_confirmed', email, `All ${required} signatures received — Blockward organisation verification for ${org.name} is pending, so the Polygon credential is held`),
        });
        await notifyHolder(svc, ach.holder_email, 'Verification nearly complete', `All required verifiers at ${org.name} signed "${ach.title}". The credential will be secured on Polygon once Blockward completes the organisation's verification.`, 'issuer_confirmed', ach.id);
        return Response.json({ ok: true, outcome: 'held_pending_org_verification', signatures: newCount, required });
      }
    }

    // Full signer snapshot from the persisted signature records.
    const sigRecords = await svc.entities.VerificationSignature.filter({ request_id: vr.id });
    const verifiers = (sigRecords || [])
      .sort((a: any, b: any) => new Date(a.signed_at).getTime() - new Date(b.signed_at).getTime())
      .map((s: any) => ({ name: s.verifier_name, title: s.verifier_title, signed_at: s.signed_at }));

    const issuance = await issueCredential(svc, {
      ach, vr, method, verifiers, methodNote: String(body.method_note || '').slice(0, 500) || null, actorEmail: email,
    });
    const anchor = issuance.anchor;

    return Response.json({
      ok: true,
      outcome: 'complete',
      credential: { bw_id: issuance.bwId },
      blockchain: anchor.ok
        ? { confirmed: true, transaction_hash: anchor.transaction_hash, network: anchor.network, testnet: anchor.testnet }
        : { confirmed: false, error: anchor.error || anchor.reason || 'pending' },
    });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to record decision' }, { status: 500 });
  }
}