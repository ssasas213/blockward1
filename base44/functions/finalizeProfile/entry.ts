// finalizeProfile — individual onboarding: collects the profile basics, claims
// the public handle (blockward.me/handle) and grants the 'individual' role.
// Runs server-side because user_type and the handle are never client-writable.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveEffectiveActor } from '../../shared/testMode.ts';
import { validateHandle, isHandleAvailable, normalizeHandle } from '../../shared/handles.ts';
import { getActorProfile } from '../../shared/verificationFlow.ts';

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

    const firstName = String(body.first_name || '').trim().slice(0, 80);
    const lastName = String(body.last_name || '').trim().slice(0, 80);
    if (!firstName || !lastName) return Response.json({ error: 'Full name is required' }, { status: 400 });

    const handle = normalizeHandle(String(body.handle || ''));
    const handleCheck = validateHandle(handle);
    if (!handleCheck.valid) return Response.json({ error: handleCheck.reason }, { status: 400 });

    const bio = String(body.bio || '').slice(0, 200).trim();
    const location = String(body.location || '').slice(0, 120).trim();
    const education = String(body.education || '').slice(0, 200).trim();
    const linkedinUrl = String(body.linkedin_url || '').trim();
    if (linkedinUrl && !/^https:\/\/(www\.)?linkedin\.com\//i.test(linkedinUrl)) {
      return Response.json({ error: 'LinkedIn URL must be a linkedin.com profile link' }, { status: 400 });
    }
    const avatarUrl = String(body.avatar_url || '').trim().slice(0, 2000) || null;

    const profile = await getActorProfile(svc, actor.actor_email);
    if (!profile) {
      // New account with no profile row yet — create one.
      const availability = await isHandleAvailable(svc, handle, null);
      if (!availability.available) return Response.json({ error: availability.reason }, { status: 409 });
      const created = await svc.entities.UserProfile.create({
        user_email: (actor.actor_email || '').trim().toLowerCase(),
        user_type: 'individual',
        status: 'active',
        first_name: firstName,
        last_name: lastName,
        handle,
        handle_changed_at: new Date().toISOString(),
        bio: bio || null,
        avatar_url: avatarUrl,
        profile_visibility: 'public',
      });
      return Response.json({ ok: true, profile: created, created: true });
    }

    const availability = await isHandleAvailable(svc, handle, profile.id);
    if (!availability.available) return Response.json({ error: availability.reason }, { status: 409 });

    const firstClaim = !profile.handle; // first-ever claim has no cooldown
    const updated = await svc.entities.UserProfile.update(profile.id, {
      user_type: 'individual',
      status: profile.status === 'active' ? 'active' : 'active',
      first_name: firstName,
      last_name: lastName,
      handle,
      handle_changed_at: firstClaim ? new Date().toISOString() : (profile.handle_changed_at || new Date().toISOString()),
      bio: bio || profile.bio || null,
      avatar_url: avatarUrl || profile.avatar_url || null,
      location,
      education,
      linkedin_url: linkedinUrl || null,
    });
    return Response.json({ ok: true, profile: updated });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to save profile' }, { status: 500 });
  }
}