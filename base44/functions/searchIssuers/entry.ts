// searchIssuers — the holder searches Blockward's VERIFIED issuer
// organisations by name, or (when nothing matches) submits the organisation
// as a suggestion: Blockward emails the organisation an invitation to
// register. Only VERIFIED organisations accept verification requests.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { authActor, slugifyHandle } from '../../shared/orgVerification.ts';
import { notifyHolder, getActorProfile } from '../../shared/verificationFlow.ts';
import { sendTrackedEmail } from '../../shared/emailDelivery.ts';
import { issuerJoinInviteEmail } from '../../shared/orgEmails.ts';
import { isDisposableEmail } from '../../shared/independentVerification.ts';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const base44 = createClientFromRequest(req);
    const { email, error } = await authActor(base44);
    if (error) return error;
    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));

    if (body.action === 'suggest') {
      // ── "Can't find your issuer?" ──
      const name = String(body.name || '').trim().slice(0, 200);
      const website = String(body.website || '').trim();
      const contactEmail = String(body.contact_email || '').trim().toLowerCase();
      if (name.length < 2) return Response.json({ error: 'Add the organisation name' }, { status: 400 });
      if (website && !/^https:\/\//i.test(website)) return Response.json({ error: 'Website must start with https://' }, { status: 400 });
      if (!EMAIL_RE.test(contactEmail)) return Response.json({ error: 'Add a valid contact email for the organisation' }, { status: 400 });
      if (isDisposableEmail(contactEmail)) return Response.json({ error: 'Disposable email addresses cannot be used' }, { status: 400 });

      const dupes = await svc.entities.IssuerOrganisation.filter({ name }, '-created_date', 1).catch(() => []);
      if (dupes?.length) return Response.json({ error: `"${name}" already exists on Blockward — search for it instead` }, { status: 409 });

      const profile = await getActorProfile(svc, email);
      const holderName = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : email;
      const nowIso = new Date().toISOString();

      const org = await svc.entities.IssuerOrganisation.create({
        name,
        org_type: 'other',
        website: website || null,
        contact_email: contactEmail,
        handle: `${slugifyHandle(name)}-${Math.floor(Math.random() * 9000 + 1000)}`,
        owner_email: contactEmail,
        status: 'pending',
        claim_source: 'holder_suggestion',
        suggested_by_email: email,
        created_by_email: email,
        event_log: [{ event: 'registered', actor: email, note: `Suggested by holder ${holderName} — invitation emailed to ${contactEmail}`, timestamp: nowIso }],
      });

      const registerUrl = `${process.env.APP_URL || 'https://blockward.base44.app'}/register-organisation`;
      const mail = issuerJoinInviteEmail({ orgName: name, holderName, registerUrl });
      const sent = await sendTrackedEmail(svc, { to: contactEmail, subject: mail.subject, html: mail.html, event_type: 'issuer_verification_request', related_type: 'invitation', related_id: org.id, retryable: true });
      await notifyHolder(svc, email, 'Issuer invited to Blockward', `We've emailed ${name} (${contactEmail}) an invitation to register. Once they join and are verified, you can request verification from them.`, 'verification_sent', org.id);
      return Response.json({ ok: true, suggested: true, email_sent: !!sent.delivered });
    }

    // ── Search verified issuers ──
    const q = String(body.q || '').trim().slice(0, 80);
    if (!q) return Response.json({ ok: true, results: [] });
    // Verified organisations are a small, curated set — fetch and match in
    // code, which is immune to per-SDK-version $regex/$options differences.
    const verified = await svc.entities.IssuerOrganisation.filter({ status: 'verified' }, '-created_date', 200)
      .catch((e) => { console.error('searchIssuers filter failed', e?.message || e); return []; });
    const ql = q.toLowerCase();
    const rows = (verified || []).filter((o: any) => (o.name || '').toLowerCase().includes(ql)).slice(0, 8);
    return Response.json({ ok: true, results: rows || [] });
  } catch (error) {
    return Response.json({ error: error?.message || 'Issuer search failed' }, { status: 500 });
  }
}