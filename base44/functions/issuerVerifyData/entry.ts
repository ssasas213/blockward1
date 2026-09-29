// issuerVerifyData — the account-free issuer page's data source. Public:
// access is authorised SOLELY by the secure, expiring token in the URL —
// never by database ids. First open is tracked so the holder sees
// "Request opened". The token itself is never returned.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { pushEvent, rateLimit } from '../../shared/verificationFlow.ts';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const body = await req.json().catch(() => ({}));
    const token = String(body.token || '').trim();
    if (!token || token.length < 32) return Response.json({ error: 'Invalid verification link' }, { status: 400 });
    if (!rateLimit(`ivd:${token.slice(0, 12)}`, 30, 60000)) {
      return Response.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 });
    }

    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const rows = await svc.entities.VerificationRequest.filter({ token });
    const vr = rows?.[0];
    if (!vr) return Response.json({ error: 'not_found' }, { status: 404 });

    // Terminal states — the link can never be reused to change a response.
    if (vr.status === 'approved' || vr.status === 'rejected') {
      return Response.json({ state: 'responded', decision: vr.decision, responded_at: vr.responded_at });
    }
    if (vr.status === 'withdrawn') return Response.json({ state: 'withdrawn' });
    if (vr.token_expires_at && new Date(vr.token_expires_at).getTime() < Date.now()) {
      if (vr.status !== 'expired') {
        await svc.entities.VerificationRequest.update(vr.id, {
          status: 'expired',
          event_log: pushEvent(vr.event_log, 'expired', 'system', 'Verification link expired'),
        }).catch(() => {});
      }
      return Response.json({ state: 'expired' });
    }

    // Track the open (first open flips pending → opened).
    const nowIso = new Date().toISOString();
    try {
      await svc.entities.VerificationRequest.update(vr.id, {
        status: vr.status === 'pending' ? 'opened' : vr.status,
        opened_at: vr.opened_at || nowIso,
        open_count: (vr.open_count || 0) + 1,
        event_log: vr.opened_at ? vr.event_log : pushEvent(vr.event_log, 'opened', 'issuer', 'Opened the secure verification page'),
      });
      if (!vr.opened_at) {
        await svc.entities.Notification.create({
          user_email: (vr.holder_email || '').toLowerCase(),
          title: 'Issuer opened your verification request',
          body: `${vr.issuer_org} opened the verification request for "${vr.achievement_title}".`,
          type: 'issuer_opened',
          related_id: vr.id,
        }).catch(() => {});
      }
    } catch { /* tracking is best-effort */ }

    // Achievement snapshot + permission-checked signed URLs for private files.
    const achRows = await svc.entities.Achievement.filter({ id: vr.achievement_id });
    const ach = achRows?.[0];

    const signFile = async (fileUri: string): Promise<string | null> => {
      if (!fileUri || /^https?:\/\//i.test(fileUri)) return fileUri || null;
      try {
        const res = await svc.integrations.Core.CreateFileSignedUrl({ file_uri: fileUri, expires_in: 3600 });
        return res?.signed_url || null;
      } catch {
        return null;
      }
    };

    const certificate = ach?.certificate_url
      ? { name: ach.certificate_name || 'Certificate', url: await signFile(ach.certificate_url) }
      : null;
    const evidence = [];
    for (const e of ach?.evidence || []) {
      const isLink = /^https?:\/\//i.test(e.url || '');
      evidence.push({
        type: isLink ? 'link' : 'file',
        name: e.name || (isLink ? 'Supporting link' : 'Evidence file'),
        url: isLink ? e.url : await signFile(e.url),
      });
    }

    return Response.json({
      state: 'actionable',
      request: {
        holder_name: vr.holder_name,
        achievement_title: vr.achievement_title,
        issuer_org: vr.issuer_org,
        token_expires_at: vr.token_expires_at,
      },
      achievement: {
        title: ach?.title || vr.achievement_title,
        category: ach?.category || 'other',
        description: ach?.description || '',
        date_achieved: ach?.date_achieved || null,
        external_credential_id: ach?.external_credential_id || null,
      },
      certificate,
      evidence,
    });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to load verification request' }, { status: 500 });
  }
}