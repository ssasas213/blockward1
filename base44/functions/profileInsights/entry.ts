/**
 * profileInsights — owner-only feedback-loop data for the student's own
 * public profile:
 *   - total view count (server-incremented only, owner views excluded)
 *   - 30-day daily sparkline
 *   - anonymised weekly aggregate ("N people from M schools viewed your
 *     profile this week") — NEVER individual viewer identities
 *   - view-milestone notifications (10/25/50/100/250/500/1000), once each
 *   - profile-strength inputs (owner-only completeness meter)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { notifyEvent } from '../../shared/eventNotifications.ts';

const MILESTONES = [10, 25, 50, 100, 250, 500, 1000];

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const svc = base44.asServiceRole;

    const profiles = await svc.entities.UserProfile.filter({ user_email: user.email });
    const profile = profiles[0];
    if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 });

    const now = new Date();
    let views: any[] = [];
    try { views = await svc.entities.ProfileView.filter({ profile_id: profile.id }); } catch (e) { /* empty */ }

    // ── 30-day daily buckets for the sparkline ──
    const days: any[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      days.push({ key: d.toISOString().slice(0, 10), count: 0 });
    }
    const byKey: Record<string, any> = Object.fromEntries(days.map((d) => [d.key, d]));
    const weekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const weekPeople = new Set<string>();
    const weekSchools = new Set<string>();
    for (const v of views) {
      const t = new Date(v.created_date).getTime();
      const key = new Date(v.created_date).toISOString().slice(0, 10);
      if (byKey[key]) byKey[key].count++;
      if (t > weekAgo) {
        weekPeople.add(v.viewer_key);
        if (v.viewer_school_name) weekSchools.add(v.viewer_school_name);
      }
    }

    const total = profile.profile_views || views.length;

    // ── View milestone — notify once per threshold crossed ──
    try {
      const last = profile.last_view_milestone || 0;
      const next = MILESTONES.find((m) => total >= m && last < m);
      if (next) {
        await notifyEvent(svc, {
          to_email: profile.user_email,
          event_type: 'view_milestone',
          title: `${profile.handle ? '@' + profile.handle : 'Your profile'} just hit ${next} views`,
          body: `Your profile has now been viewed ${total} times — every view is someone new seeing your verified achievements.`,
          related_id: `${profile.id}:${next}`,
        });
        await svc.entities.UserProfile.update(profile.id, { last_view_milestone: next });
      }
    } catch (e) { /* best-effort */ }

    // ── Profile-strength inputs (owner-only meter; never public) ──
    let registry: any[] = [];
    try { registry = await svc.entities.BlockWardVerificationRegistry.filter({ student_id: profile.id }); } catch (e) { /* empty */ }
    const visible = registry.filter((r) => r.approval_status === 'approved' && r.visibility !== 'private');
    const hasExternal = visible.some((r) =>
      (r.signer_chain || []).some((s: any) => String(s.role || '').toLowerCase().includes('external'))
    );
    const strength = {
      bio: !!profile.bio,
      handle: !!profile.handle,
      avatar: !!profile.avatar_url,
      pinned: (profile.pinned_achievement_ids || []).filter((id: string) => visible.some((r) => r.id === id)).length,
      achievements: visible.length,
      externally_verified: hasExternal,
    };

    return Response.json({
      ok: true,
      total,
      sparkline: days,
      week: { people: weekPeople.size, schools: weekSchools.size },
      strength,
      opted_in: !profile.views_insight_opt_out,
      handle: profile.handle || null,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}