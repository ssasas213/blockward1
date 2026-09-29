// retryAnchor — re-runs the Polygon PoS anchor for a credential whose anchor
// failed or is still pending. Authorised for the holder (their own credential)
// and platform admins. Idempotent: never re-anchors a confirmed credential.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveEffectiveActor } from '../../shared/testMode.ts';
import { anchorCredential } from '../../shared/chainPolygon.ts';
import { pushEvent, notifyHolder, appBaseUrl } from '../../shared/verificationFlow.ts';
import { sendTrackedEmail } from '../../shared/emailDelivery.ts';
import { holderVerifiedEmail } from '../../shared/issuerEmails.ts';

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const base44 = createClientFromRequest(req);
    const actor = await resolveEffectiveActor(base44);
    if (!actor.authorized) return Response.json({ error: actor.reason || 'Unauthorized' }, { status: actor.status || 401 });
    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const credentialId = String(body.credential_id || '');

    const rows = await svc.entities.Credential.filter({ id: credentialId });
    const cred = rows?.[0];
    if (!cred) return Response.json({ error: 'Credential not found' }, { status: 404 });

    if (cred.anchor_status === 'confirmed') {
      return Response.json({ ok: true, idempotent: true, transaction_hash: cred.blockchain?.transaction_hash });
    }
    const isHolder = (cred.holder_email || '').trim().toLowerCase() === (actor.actor_email || '').trim().toLowerCase();
    const isAdmin = actor.actor_role === 'admin';
    if (!isHolder && !isAdmin) {
      return Response.json({ error: 'Not authorised for this credential' }, { status: 403 });
    }

    const result = await anchorCredential(svc, credentialId);
    if (result.ok) {
      // Bring the achievement to VERIFIED only now — both conditions satisfied.
      const achRows = await svc.entities.Achievement.filter({ id: cred.achievement_id });
      const ach = achRows?.[0];
      if (ach && ach.status !== 'verified') {
        await svc.entities.Achievement.update(ach.id, {
          status: 'verified',
          event_log: pushEvent(ach.event_log, 'verified', 'system', `Blockward Verified — Polygon PoS anchor confirmed (tx ${String(result.transaction_hash || '').slice(0, 18)}…)`),
        });
      }
      const verifyUrl = `${appBaseUrl()}/verify/${cred.bw_id}`;
      const mail = holderVerifiedEmail({ achievementTitle: cred.title, bw_id: cred.bw_id, verifyUrl });
      await sendTrackedEmail(svc, { to: cred.holder_email, subject: mail.subject, html: mail.html, event_type: 'record_delivered_to_vault', related_id: cred.id, retryable: true, dedupe_key: `record_delivered_to_vault:${cred.id}:retry` });
      await notifyHolder(svc, cred.holder_email, 'Achievement is Blockward Verified', `"${cred.title}" is confirmed and secured on the blockchain. Credential ID: ${cred.bw_id}.`, 'achievement_verified', cred.achievement_id);
    }
    return Response.json({ ok: !!result.ok, ...result });
  } catch (error) {
    return Response.json({ error: error?.message || 'Anchor retry failed' }, { status: 500 });
  }
}