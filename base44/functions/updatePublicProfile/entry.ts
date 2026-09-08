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
 *  - bio:                  public bio (max 200 chars, plain text, line breaks ok).
 *  - profile_visibility:   'public' | 'link_only' | 'private'.
 *  - og_image_url:         generated share-card image used as the OG image.
 *  - Visual customisation — PRESETS ONLY, validated against fixed lists:
 *      theme_id, accent_colour, profile_layout, display_font, banner_url,
 *      social_links (whitelisted platforms, https forced, max 6),
 *      featured_link (one https CTA button).
 *  - pinned_achievement_ids: up to 6 pinned verified achievements.
 *  - achievement_visibility: { registry_id, visibility } for one achievement —
 *                          only on achievements owned by the caller.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { resolveEffectiveActor } from '../../shared/testMode.ts';
import { normalizeHandle, validateHandle, isHandleAvailable, cooldownDaysRemaining } from '../../shared/handles.ts';

const MAX_BIO = 200;
const THEMES = ['slate', 'midnight', 'paper', 'terracotta', 'forest', 'cobalt', 'rose', 'mono', 'gradient', 'carbon'];
const LAYOUTS = ['grid', 'list', 'showcase'];
const FONTS = ['sans', 'serif', 'mono', 'display'];
const ACCENT_HEXES = ['#7c3aed', '#4f46e5', '#2563eb', '#0d9488', '#059669', '#d97706', '#ea580c', '#dc2626', '#e11d48', '#db2777', '#334155', '#171717'];
const PLATFORMS = ['instagram', 'tiktok', 'linkedin', 'github', 'youtube', 'twitter', 'discord', 'behance', 'dribbble', 'strava', 'chess', 'website'];
const PRESET_BANNER_IDS = ['aurora', 'dusk', 'ember', 'glacier', 'prism', 'sandstone', 'tide', 'orchid', 'voltage', 'botanical', 'nebula', 'blueprint'];

// Force https, reject every other protocol.
function normalizeHttpsUrl(raw: string): string | null {
  if (!raw || typeof raw !== 'string') return null;
  let url = raw.trim();
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') u.protocol = 'https:';
    if (u.protocol !== 'https:') return null;
    return u.toString();
  } catch {
    return null;
  }
}

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

    // ── Bio (200 chars, plain text, line breaks allowed) ──────────────────────
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

    // ── Visual customisation — validated presets, never raw styling ──────────
    if (typeof body.theme_id === 'string') {
      if (!THEMES.includes(body.theme_id)) return Response.json({ error: 'Unknown theme' }, { status: 400 });
      updates.theme_id = body.theme_id;
    }
    if (body.accent_colour === null || body.accent_colour === '') {
      updates.accent_colour = null;
    } else if (typeof body.accent_colour === 'string') {
      const hex = body.accent_colour.toLowerCase();
      if (!ACCENT_HEXES.includes(hex)) return Response.json({ error: 'Accent colour must come from the BlockWard palette' }, { status: 400 });
      updates.accent_colour = hex;
    }
    if (typeof body.profile_layout === 'string') {
      if (!LAYOUTS.includes(body.profile_layout)) return Response.json({ error: 'Unknown layout' }, { status: 400 });
      updates.profile_layout = body.profile_layout;
    }
    if (typeof body.display_font === 'string') {
      if (!FONTS.includes(body.display_font)) return Response.json({ error: 'Unknown font pairing' }, { status: 400 });
      updates.display_font = body.display_font;
    }
    if (typeof body.banner_url === 'string' || body.banner_url === null) {
      const b = body.banner_url;
      if (!b) {
        updates.banner_url = null;
      } else if (b.startsWith('preset:')) {
        if (!PRESET_BANNER_IDS.includes(b.slice(7))) return Response.json({ error: 'Unknown banner preset' }, { status: 400 });
        updates.banner_url = b;
      } else {
        const u = normalizeHttpsUrl(b);
        if (!u) return Response.json({ error: 'Banner must be a valid image URL' }, { status: 400 });
        updates.banner_url = u;
      }
    }
    if (Array.isArray(body.social_links)) {
      const links = [];
      for (const raw of body.social_links) {
        if (!raw || typeof raw !== 'object') continue;
        if (!PLATFORMS.includes(raw.platform)) continue;
        const url = normalizeHttpsUrl(raw.url);
        if (!url) continue;
        links.push({
          platform: raw.platform,
          url,
          label: String(raw.label || '').slice(0, 40) || null,
        });
        if (links.length >= 6) break;
      }
      updates.social_links = links;
    }
    if (body.featured_link === null || body.featured_link === '') {
      updates.featured_link = null;
    } else if (typeof body.featured_link === 'object') {
      const fl = body.featured_link;
      if (!fl.url) {
        updates.featured_link = null;
      } else {
        const url = normalizeHttpsUrl(fl.url);
        if (!url) return Response.json({ error: 'Featured link must be a valid https URL' }, { status: 400 });
        updates.featured_link = { url, label: String(fl.label || '').slice(0, 60) || 'Featured link' };
      }
    }

    // ── Highlights — up to 6 pinned verified achievements ──────────────────
    if (Array.isArray(body.pinned_achievement_ids)) {
      const ids = [...new Set(body.pinned_achievement_ids)]
        .filter((id: string) => mine.some((r) => r.id === id))
        .slice(0, 6);
      updates.pinned_achievement_ids = ids;
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
      if (achievementsById[registry_id]) achievementsById[registry_id].visibility = visibility;
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
        pinned_achievement_ids: fresh.pinned_achievement_ids || [],
        name: `${fresh.first_name || ''} ${fresh.last_name || ''}`.trim(),
        avatar_url: fresh.avatar_url || null,
        grade_level: fresh.grade_level || null,
        banner_url: fresh.banner_url || null,
        theme_id: fresh.theme_id || 'slate',
        accent_colour: fresh.accent_colour || null,
        profile_layout: fresh.profile_layout || 'grid',
        display_font: fresh.display_font || 'sans',
        social_links: fresh.social_links || [],
        featured_link: fresh.featured_link || null,
      },
      achievements: Object.values(achievementsById),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}