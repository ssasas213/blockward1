// orgRegister — Organisation onboarding. The person who registers an Issuer
// Organisation becomes its Organisation Owner. Organisations start PENDING —
// Blockward staff manually verify them before they receive full issuing
// authority (never auto-trusted for simply being created).
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { authActor, ORG_TYPES, slugifyHandle } from '../../shared/orgVerification.ts';
import { getActorProfile, pushEvent } from '../../shared/verificationFlow.ts';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const base44 = createClientFromRequest(req);
    const { actor, email, error } = await authActor(base44);
    if (error) return error;
    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));

    const name = String(body.name || '').trim().slice(0, 200);
    if (name.length < 2) return Response.json({ error: 'Organisation name is required' }, { status: 400 });
    const orgType = ORG_TYPES.includes(body.org_type) ? body.org_type : 'other';
    const website = String(body.website || '').trim();
    if (website && !/^https:\/\//i.test(website)) return Response.json({ error: 'Website must start with https://' }, { status: 400 });
    const contactEmail = String(body.contact_email || email).trim().toLowerCase();
    if (!EMAIL_RE.test(contactEmail)) return Response.json({ error: 'A valid organisation contact email is required' }, { status: 400 });
    const emailDomain = String(body.email_domain || '').trim().toLowerCase().replace(/^@/, '').slice(0, 120);
    const logoUrl = String(body.logo_url || '').trim() || null;
    if (logoUrl && !/^https:\/\//i.test(logoUrl)) return Response.json({ error: 'Logo must be an https URL' }, { status: 400 });
    const description = String(body.description || '').slice(0, 1000).trim() || null;
    const country = String(body.country || '').trim().slice(0, 80) || null;

    // Duplicate guard — one organisation record per exact name.
    const dupes = await svc.entities.IssuerOrganisation.filter({ name }, '-created_date', 1).catch(() => []);
    if (dupes?.length) return Response.json({ error: `An organisation named "${name}" already exists on Blockward` }, { status: 409 });

    // Unique public handle.
    let handle = slugifyHandle(name);
    for (let i = 0; i < 5; i++) {
      const taken = await svc.entities.IssuerOrganisation.filter({ handle }, '-created_date', 1).catch(() => []);
      if (!taken?.length) break;
      handle = `${slugifyHandle(name)}-${Math.floor(Math.random() * 9000 + 1000)}`;
    }

    const nowIso = new Date().toISOString();
    const profile = await getActorProfile(svc, email);
    const fullName = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : email;

    const org = await svc.entities.IssuerOrganisation.create({
      name,
      org_type: orgType,
      website: website || null,
      country,
      logo_url: logoUrl,
      description,
      email_domain: emailDomain || null,
      contact_email: contactEmail,
      handle,
      owner_email: email,
      status: 'pending',
      claim_source: 'self_registered',
      created_by_email: email,
      event_log: [{ event: 'registered', actor: email, note: `Organisation registered by ${fullName || email} — awaiting Blockward verification`, timestamp: nowIso }],
    });

    await svc.entities.OrganisationMember.create({
      org_id: org.id,
      org_name: name,
      user_email: email,
      user_id: profile?.id || null,
      full_name: fullName || email,
      job_title: 'Organisation Owner',
      role: 'owner',
      status: 'active',
      invited_at: nowIso,
      joined_at: nowIso,
      last_active_at: nowIso,
    });

    return Response.json({ ok: true, org: { id: org.id, name: org.name, handle: org.handle, status: org.status } });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to register organisation' }, { status: 500 });
  }
}