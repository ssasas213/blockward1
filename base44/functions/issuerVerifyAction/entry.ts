// issuerVerifyAction — the issuer's decision endpoint. No account, no login:
// the ONLY authority is the secure one-time token. Decisions are final (the
// link cannot be reused to change them), fully audited (IP, user agent,
// method, attestation), and a confirmation immediately starts the credential
// + blockchain stage. NEVER trusts client-side state.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { anchorCredential } from '../../shared/chainPolygon.ts';
import { pushEvent, notifyHolder, ensureUniqueBwId, appBaseUrl, rateLimit } from '../../shared/verificationFlow.ts';
import { sendTrackedEmail } from '../../shared/emailDelivery.ts';
import { holderRejectedEmail, holderVerifiedEmail, methodLabel } from '../../shared/issuerEmails.ts';

const METHODS = new Set(['witnessed_in_person', 'reviewed_evidence', 'official_records', 'third_party', 'other']);

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const body = await req.json().catch(() => ({}));
    const token = String(body.token || '').trim();
    if (!token || token.length < 32) return Response.json({ error: 'Invalid verification link' }, { status: 400 });
    if (!rateLimit(`iva:${token.slice(0, 12)}`, 10, 60000)) {
      return Response.json({ error: 'Too many attempts. Please wait a minute.' }, { status: 429 });
    }

    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const rows = await svc.entities.VerificationRequest.filter({ token });
    const vr = rows?.[0];
    if (!vr) return Response.json({ error: 'not_found' }, { status: 404 });

    // Single-use confirmation — a responded or expired request can never be changed.
    if (vr.status === 'approved' || vr.status === 'rejected') {
      return Response.json({ state: 'responded', decision: vr.decision }, { status: 409 });
    }
    if (vr.status === 'withdrawn') return Response.json({ state: 'withdrawn' }, { status: 409 });
    if (vr.token_expires_at && new Date(vr.token_expires_at).getTime() < Date.now()) {
      await svc.entities.VerificationRequest.update(vr.id, {
        status: 'expired',
        event_log: pushEvent(vr.event_log, 'expired', 'system', 'Verification link expired'),
      }).catch(() => {});
      return Response.json({ state: 'expired' }, { status: 410 });
    }

    const decision = String(body.decision || '');
    const method = METHODS.has(body.method) ? body.method : null;
    const attestation = body.attestation === true;
    const signature = String(body.signature || '').trim().slice(0, 120);
    if (!decision || !['confirmed', 'cannot_verify'].includes(decision)) {
      return Response.json({ error: 'Invalid decision' }, { status: 400 });
    }
    if (!method) return Response.json({ error: 'Please choose how you verified this achievement' }, { status: 400 });
    if (!attestation) return Response.json({ error: 'Please tick the final confirmation to proceed' }, { status: 400 });
    if (signature.length < 2) return Response.json({ error: 'Please type your full name to sign' }, { status: 400 });

    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || null;
    const ua = (req.headers.get('user-agent') || '').slice(0, 300);
    const nowIso = new Date().toISOString();
    const achRows = await svc.entities.Achievement.filter({ id: vr.achievement_id });
    const ach = achRows?.[0];

    if (decision === 'cannot_verify') {
      const reason = String(body.reason || '').slice(0, 500);
      await svc.entities.VerificationRequest.update(vr.id, {
        status: 'rejected',
        decision: 'cannot_verify',
        decision_method: method,
        decision_reason: reason,
        decision_ip: ip,
        decision_user_agent: ua,
        responded_at: nowIso,
        event_log: pushEvent(vr.event_log, 'declined', vr.issuer_email, reason ? `Cannot verify: ${reason}` : 'Cannot verify'),
      });
      if (ach) {
        await svc.entities.Achievement.update(ach.id, {
          status: 'rejected',
          reject_reason: reason,
          event_log: pushEvent(ach.event_log, 'issuer_declined', vr.issuer_email, reason || 'Issuer could not verify'),
        });
        const mail = holderRejectedEmail({ achievementTitle: ach.title, issuerOrg: vr.issuer_org || ach.issuer_org || 'the issuer', reason });
        await sendTrackedEmail(svc, { to: ach.holder_email, subject: mail.subject, html: mail.html, event_type: 'request_rejected', related_id: vr.id, retryable: true });
        await notifyHolder(svc, ach.holder_email, 'Verification declined', `${vr.issuer_org || 'The issuer'} could not verify "${ach.title}". Nothing was published.`, 'achievement_rejected', ach.id);
      }
      try {
        const is = await svc.entities.Issuer.filter({ email: vr.issuer_email });
        if (is?.[0]) await svc.entities.Issuer.update(is[0].id, { declined_count: (is[0].declined_count || 0) + 1, last_activity_at: nowIso });
      } catch { /* best-effort */ }
      return Response.json({ ok: true, outcome: 'declined' });
    }

    // ── CONFIRMED: issuer_confirmed → standardized credential → blockchain ──
    if (!ach) return Response.json({ error: 'achievement_not_found' }, { status: 404 });

    await svc.entities.VerificationRequest.update(vr.id, {
      status: 'approved',
      decision: 'confirmed',
      decision_method: method,
      decision_note: String(body.method_note || '').slice(0, 500) || null,
      decision_ip: ip,
      decision_user_agent: ua,
      responded_at: nowIso,
      event_log: pushEvent(vr.event_log, 'confirmed', vr.issuer_email, `Confirmed via ${methodLabel(method)}`),
    });

    const bwId = await ensureUniqueBwId(svc);
    const cred = await svc.entities.Credential.create({
      bw_id: bwId,
      achievement_id: ach.id,
      holder_id: ach.holder_id,
      holder_email: ach.holder_email,
      holder_display_name: ach.holder_name || vr.holder_name || 'Blockward member',
      issuer_org: ach.issuer_org || vr.issuer_org,
      issuer_website: ach.issuer_website || null,
      title: ach.title,
      category: ach.category,
      description: ach.description || '',
      date_achieved: ach.date_achieved || null,
      expires_at: ach.expires_at || null,
      verified_at: nowIso,
      verification_method: method,
      verification_request_id: vr.id,
      schema_version: 1,
      hash_version: 1,
      anchor_status: 'pending',
      blockchain: { status: 'pending' },
      is_public: true,
      status: 'active',
      event_log: [{ event: 'created', actor: vr.issuer_email, note: `Issuer confirmed via ${methodLabel(method)}`, timestamp: nowIso }],
    });

    await svc.entities.Achievement.update(ach.id, {
      status: 'blockchain_processing',
      credential_id: cred.id,
      event_log: pushEvent(ach.event_log, 'issuer_confirmed', vr.issuer_email, `Issuer confirmed via ${methodLabel(method)} — creating blockchain proof`),
    });

    // The blockchain stage — Blockward pays the gas in the background; the
    // issuer's page response is not blocked on the chain being fast.
    const anchor = await anchorCredential(svc, cred.id);
    if (anchor.ok) {
      await svc.entities.Achievement.update(ach.id, {
        status: 'verified',
        event_log: pushEvent(ach.event_log, 'verified', 'system', `Blockward Verified — Polygon PoS anchor confirmed (tx ${String(anchor.transaction_hash || '').slice(0, 18)}…)`),
      });
      const verifyUrl = `${appBaseUrl()}/verify/${bwId}`;
      const mail = holderVerifiedEmail({ achievementTitle: ach.title, bwId, verifyUrl });
      await sendTrackedEmail(svc, { to: ach.holder_email, subject: mail.subject, html: mail.html, event_type: 'record_delivered_to_vault', related_id: cred.id, retryable: true });
      await notifyHolder(svc, ach.holder_email, 'Achievement is Blockward Verified', `"${ach.title}" is confirmed and secured on the blockchain. Credential ID: ${bwId}.`, 'achievement_verified', ach.id);
    } else {
      await svc.entities.Achievement.update(ach.id, {
        status: 'issuer_confirmed',
        event_log: pushEvent(ach.event_log, 'blockchain_failed', 'system', `Blockchain anchor failed: ${anchor.error || anchor.reason || 'unknown'} — retryable`),
      });
      await notifyHolder(svc, ach.holder_email, 'Issuer confirmed — blockchain processing', `${vr.issuer_org || 'The issuer'} confirmed "${ach.title}". The blockchain proof is being processed.`, 'issuer_confirmed', ach.id);
    }

    try {
      const is = await svc.entities.Issuer.filter({ email: vr.issuer_email });
      if (is?.[0]) await svc.entities.Issuer.update(is[0].id, { confirmed_count: (is[0].confirmed_count || 0) + 1, last_activity_at: nowIso });
    } catch { /* best-effort */ }

    return Response.json({
      ok: true,
      outcome: 'confirmed',
      credential: { bw_id: bwId },
      blockchain: anchor.ok
        ? { confirmed: true, transaction_hash: anchor.transaction_hash, network: anchor.network, testnet: anchor.testnet }
        : { confirmed: false, error: anchor.error || anchor.reason || 'pending' },
    });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to record decision' }, { status: 500 });
  }
}