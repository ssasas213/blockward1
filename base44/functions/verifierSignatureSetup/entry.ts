// verifierSignatureSetup — each Verifier sets up their signature ONCE
// (drawn or uploaded), confirming they own it. A stored signature is NEVER
// applied automatically: orgVerificationReview attaches it only when that
// verifier explicitly authorises an individual verification.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { authActor } from '../../shared/orgVerification.ts';

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const base44 = createClientFromRequest(req);
    const { email, error } = await authActor(base44);
    if (error) return error;
    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '');
    const nowIso = new Date().toISOString();

    if (action === 'get') {
      const rows = await svc.entities.VerifierSignature.filter({ user_email: email, active: true });
      return Response.json({ ok: true, signature: rows?.[0] || null });
    }

    if (action === 'save') {
      const method = body.method === 'drawn' ? 'drawn' : body.method === 'uploaded' ? 'uploaded' : null;
      if (!method) return Response.json({ error: 'Choose how you created your signature' }, { status: 400 });
      const imageUrl = String(body.image_url || '').trim();
      if (!/^https:\/\//i.test(imageUrl)) return Response.json({ error: 'Upload your signature image first' }, { status: 400 });
      if (body.consent !== true) {
        return Response.json({ error: 'You must confirm that this is your signature and authorise its use on explicitly approved verifications' }, { status: 400 });
      }
      // Deactivate previous signatures (history retained).
      await svc.entities.VerifierSignature.updateMany({ user_email: email, active: true }, { $set: { active: false } }).catch(() => {});
      const sig = await svc.entities.VerifierSignature.create({
        user_email: email,
        member_id: String(body.member_id || '') || null,
        org_id: String(body.org_id || '') || null,
        method,
        image_url: imageUrl,
        confirmed_at: nowIso,
        consent: true,
        active: true,
      });
      return Response.json({ ok: true, signature: sig });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error?.message || 'Signature setup failed' }, { status: 500 });
  }
}