// createAchievement — an authenticated individual adds an achievement to their
// profile. Achievements ALWAYS start UNVERIFIED: uploading a certificate never
// confers verification.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveEffectiveActor } from '../../shared/testMode.ts';
import { pushEvent, getActorProfile } from '../../shared/verificationFlow.ts';

const CATEGORIES = new Set(['certification', 'competition', 'academic', 'professional', 'course', 'training', 'award', 'challenge', 'other']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
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

    const title = String(body.title || '').trim();
    if (title.length < 3 || title.length > 200) {
      return Response.json({ error: 'Achievement title must be 3–200 characters' }, { status: 400 });
    }
    const category = CATEGORIES.has(body.category) ? body.category : 'other';
    const description = String(body.description || '').slice(0, 2000).trim();
    const issuerOrg = String(body.issuer_org || '').slice(0, 200).trim();
    const issuerContactName = String(body.issuer_contact_name || '').slice(0, 120).trim();
    const issuerEmail = String(body.issuer_email || '').trim().toLowerCase();
    if (issuerEmail && !EMAIL_RE.test(issuerEmail)) {
      return Response.json({ error: 'Issuer contact email is not a valid email address' }, { status: 400 });
    }
    const issuerWebsite = String(body.issuer_website || '').trim();
    if (issuerWebsite && !/^https:\/\//i.test(issuerWebsite)) {
      return Response.json({ error: 'Issuer website must start with https://' }, { status: 400 });
    }
    const dateAchieved = DATE_RE.test(String(body.date_achieved || '')) ? body.date_achieved : null;
    const expiresAt = DATE_RE.test(String(body.expires_at || '')) ? body.expires_at : null;
    if (expiresAt && dateAchieved && expiresAt < dateAchieved) {
      return Response.json({ error: 'Expiry date cannot be before the achievement date' }, { status: 400 });
    }
    const externalCredentialId = String(body.external_credential_id || '').slice(0, 100).trim();
    const certificateUrl = String(body.certificate_url || '').slice(0, 2000).trim() || null;
    const certificateName = String(body.certificate_name || '').slice(0, 200).trim() || null;

    let evidence: { name: string; url: string }[] = [];
    if (Array.isArray(body.evidence)) {
      evidence = body.evidence.slice(0, 5).map((e: any) => ({
        name: String(e?.name || 'Evidence').slice(0, 120),
        url: String(e?.url || '').slice(0, 2000),
      })).filter((e: any) => e.url);
    }

    const profile = await getActorProfile(svc, actor.actor_email);
    const holderName = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : actor.actor_email;
    const nowIso = new Date().toISOString();

    const created = await svc.entities.Achievement.create({
      holder_id: profile?.id || actor.actor_id || null,
      holder_email: (actor.actor_email || '').trim().toLowerCase(),
      holder_name: holderName || actor.actor_email,
      title,
      issuer_org: issuerOrg || null,
      issuer_contact_name: issuerContactName || null,
      issuer_email: issuerEmail || null,
      issuer_website: issuerWebsite || null,
      category,
      description,
      date_achieved: dateAchieved,
      expires_at: expiresAt,
      external_credential_id: externalCredentialId || null,
      certificate_url: certificateUrl,
      certificate_name: certificateName,
      evidence,
      is_public: false,
      status: 'unverified',
      event_log: [{ event: 'created', actor: actor.actor_email, timestamp: nowIso }],
    });

    try {
      await svc.entities.Achievement.update(created.id, {
        event_log: pushEvent(created.event_log, 'created', actor.actor_email, 'Achievement added — unverified'),
      });
    } catch { /* best-effort */ }

    return Response.json({ ok: true, achievement: created });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to create achievement' }, { status: 500 });
  }
}