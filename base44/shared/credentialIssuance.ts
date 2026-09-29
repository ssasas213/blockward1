// ============================================================================
// credentialIssuance — the SINGLE path from "issuer verification complete" to
// "Blockward Verified". Extracted from issuerVerifyAction so the legacy token
// flow and the new organisation/verifier flow share EXACTLY the same
// credential + Polygon anchoring pipeline. The anchoring implementation
// (chainPolygon), BW-HASH-V1, idempotency locking and retry behavior are
// untouched — this module only orchestrates them.
// ============================================================================
import { anchorCredential } from './chainPolygon.ts';
import { ensureUniqueBwId, pushEvent, notifyHolder, appBaseUrl } from './verificationFlow.ts';
import { sendTrackedEmail } from './emailDelivery.ts';
import { holderVerifiedEmail, methodLabel } from './issuerEmails.ts';

export interface IssuanceOptions {
  ach: any;            // Achievement record
  vr: any;             // VerificationRequest record
  method: string;      // verification_method
  verifiers?: { name: string; title?: string | null; signed_at?: string | null }[];
  methodNote?: string | null;
  actorEmail?: string; // who triggered issuance (for audit)
}

export async function issueCredential(svc: any, opts: IssuanceOptions) {
  const { ach, vr, method } = opts;
  const nowIso = new Date().toISOString();
  const bwId = await ensureUniqueBwId(svc);

  const verifiersSnapshot = (opts.verifiers || []).map((v) => ({
    name: String(v.name || '').slice(0, 120),
    title: v.title ? String(v.title).slice(0, 120) : null,
    signed_at: v.signed_at || null,
  }));

  const cred = await svc.entities.Credential.create({
    bw_id: bwId,
    achievement_id: ach.id,
    org_id: vr?.org_id || null,
    holder_id: ach.holder_id,
    holder_email: ach.holder_email,
    holder_display_name: ach.holder_name || vr?.holder_name || 'Blockward member',
    issuer_org: ach.issuer_org || vr?.issuer_org || vr?.org_name || null,
    issuer_org_handle: vr?.org_handle || null,
    issuer_website: ach.issuer_website || vr?.issuer_website || null,
    verifiers: verifiersSnapshot,
    title: ach.title,
    category: ach.category,
    description: ach.description || '',
    date_achieved: ach.date_achieved || null,
    expires_at: ach.expires_at || null,
    verified_at: nowIso,
    verification_method: method,
    verification_request_id: vr?.id || null,
    schema_version: 1,
    hash_version: 1,
    anchor_status: 'pending',
    blockchain: { status: 'pending' },
    is_public: true,
    status: 'active',
    event_log: [{ event: 'created', actor: opts.actorEmail || 'system', note: `Issuer verification complete (${methodLabel(method)})`, timestamp: nowIso }],
  });

  await svc.entities.Achievement.update(ach.id, {
    status: 'blockchain_processing',
    credential_id: cred.id,
    event_log: pushEvent(ach.event_log, 'issuer_confirmed', opts.actorEmail || 'system', `Issuer verification complete — creating blockchain proof`),
  });

  // The blockchain stage — Blockward pays the gas in the background; the
  // caller's response is not blocked on the chain being fast.
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
    await notifyHolder(svc, ach.holder_email, 'Issuer verified — blockchain processing', `All required verifiers have signed "${ach.title}". The blockchain proof is being processed.`, 'issuer_confirmed', ach.id);
  }

  return { ok: true, bwId, cred, anchor };
}