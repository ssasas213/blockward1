/**
 * updatePublicProfile — the single authenticated endpoint behind the student's
 * public /@handle profile settings.
 *
 * Actions (all optional in one call, applied in order):
 *  - get_my:               returns the current public-profile settings + the
 *                          student's registry achievements with their visibility.
 *  - handle:               claim/change the handle. Validates format, enforces
 *                          global uniqueness (incl. reserved history) and the
 *                          30-day change cooldown. Old handles are kept in
 *                          handle_history as permanent redirects.
 *  - bio:                  one-line bio (max 120 chars).
 *  - profile_visibility:   'public' | 'link_only' | 'private'.
 *  - og_image_url:         generated share-card image used as the OG image.
 *  - achievement_visibility: { registry_id, visibility } for one achievement —
 *                          only on achievements owned by the caller.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { resolveEffectiveActor } from '../../shared/testMode.ts';
import { normalizeHandle, validateHandle, isHandleAvailable, cooldownDaysRemaining } from '../../shared/handles.ts';

const MAX_BIO = 120;

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    const actor = await resolveEffectiveActor(base44);
    if (!actor.authorized) {
      return Response.json({ error: actor.reason }, { status: actor.status });
    }

    const body = await req.json().catch(() => ({}));

    let profiles = [];
    try { profiles = await svc.entities.UserProfile.filter({ id: actor.actor_id }); } catch (e) { /* empty */ }
    if (!profiles.length) {
      try { profiles = await svc.entities.UserProfile.filter({ user_email: actor.actor_email }); } catch (e) { /* empty */ }
    }
    const profile = profiles[0] || null;
    if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 });

    // Registry achievements owned by the caller (for get_my + visibility checks).
    let registry = [];
    try { registry = await svc.entities.BlockWardVerificationRegistry.filter({ student_id: profile.id }); } catch (e) { /* empty */ }

    const mine = registry
      .filter((r) => r.approval_status === 'approved')
      .sort((a, b) =>
        new Date(b.date_delivered || b.date_approved || b.date_achieved || b.updated_date || 0) -
        new Date(a.date_delivered || a.date_approved || a.date_achieved || a.updated_date || 0)
      );

    const myAchievements = mine.map((r) => ({
      registry_id: r.id,
      title: r.achievement_title,
      category: r.achievement_category,
      organisation_name: r.organisation_name || null,
      image_url: r.achievement_image || null,
      date_achieved: r.date_achieved || null,
      visibility: r.visibility || (r.is_public === false ? 'private' : 'public'),
    }));
    const achievementsById = Object.fromEntries(myAchievements.map((a) => [a.registry_id, a]));

    const updates = {};
    const now = new Date().toISOString();

    // ── Handle ──────────────────────────────────────────────────────────────
    if (typeof body.handle === 'string' && body.handle.trim() && normalizeHandle(body.handle) !== (profile.handle || '')) {
      const handle = normalizeHandle(body.handle);
      const check = validateHandle(handle);
      if (!check.valid) return Response.json({ error: check.reason }, { status: 400 });

      if (profile.handle) {
        const daysLeft = cooldownDaysRemaining(profile.handle, profile.handle_changed_at);
        if (daysLeft > 0) {
          return Response.json({
            error: `Handles can only be changed once every 30 days. You can change yours in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`,
          }, { status: 403 });
        }
      }

      const available = await isHandleAvailable(svc, handle, profile.id);
      if (!available) return Response.json({ error: 'That handle is already taken' }, { status: 409 });

      updates.handle = handle;
      updates.handle_changed_at = now;
      if (profile.handle) {
        updates.handle_history = [...(profile.handle_history || []), profile.handle];
      }
    }

    // ── Bio ─────────────────────────────────────────────────────────────────
    if (typeof body.bio === 'string') {
      const bio = body.bio.trim();
      if (bio.length > MAX_BIO) return Response.json({ error: `Bio must be ${MAX_BIO} characters or fewer` }, { status: 400 });
      updates.bio = bio || null;
    }

    // ── Global profile visibility ────────────────────────────────────────────
    if (typeof body.profile_visibility === 'string') {
      if (!['public', 'link_only', 'private'].includes(body.profile_visibility)) {
        return Response.json({ error: 'Invalid visibility' }, { status: 400 });
      }
      updates.profile_visibility = body.profile_visibility;
    }

    // ── OG image ─────────────────────────────────────────────────────────────
    if (typeof body.og_image_url === 'string') {
      updates.og_image_url = body.og_image_url || null;
    }

    // ── Per-achievement visibility ───────────────────────────────────────────
    let achievementUpdated = null;
    if (body.achievement_visibility && typeof body.achievement_visibility === 'object') {
      const { registry_id, visibility } = body.achievement_visibility;
      if (!['public', 'link_only', 'private'].includes(visibility)) {
        return Response.json({ error: 'Invalid visibility' }, { status: 400 });
      }
      const record = mine.find((r) => r.id === registry_id);
      if (!record) return Response.json({ error: 'Achievement not found' }, { status: 404 });
      await svc.entities.BlockWardVerificationRegistry.update(registry_id, { visibility });
      record.visibility = visibility;
      achievementUpdated = registry_id;
    }

    if (Object.keys(updates).length > 0) {
      await svc.entities.UserProfile.update(profile.id, updates);
    }

    // ── Response ────────────────────────────────────────────────────────────
    const fresh = Object.keys(updates).length > 0
      ? { ...profile, ...updates }
      : profile;

    return Response.json({
      ok: true,
      updated: Object.keys(updates),
      achievement_updated: achievementUpdated,
      profile: {
        handle: fresh.handle || null,
        handle_history: fresh.handle_history || [],
        handle_changed_at: fresh.handle_changed_at || null,
        cooldown_days_remaining: cooldownDaysRemaining(fresh.handle, fresh.handle_changed_at),
        bio: fresh.bio || null,
        profile_visibility: fresh.profile_visibility || 'public',
        og_image_url: fresh.og_image_url || null,
        name: `${fresh.first_name || ''} ${fresh.last_name || ''}`.trim(),
        avatar_url: fresh.avatar_url || null,
        grade_level: fresh.grade_level || null,
      },
      achievements: myAchievements,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}