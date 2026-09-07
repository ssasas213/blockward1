/**
 * socialData — read-side for the activity feed, follows, reactions and
 * organisation leaderboards.
 *
 * The feed is deliberately calm: a fixed slice of recent public achievements
 * (no ranking, reverse chronological) from three circles —
 *   1. people the viewer follows,
 *   2. people in the viewer's organisations (active school + memberships),
 *   3. people at peer organisations (same org type, same country).
 * Private / link-only profile owners never appear in anyone's feed.
 *
 * Also returns the viewer's endorsement budget (for the endorse button),
 * their reaction state, and the weekly/monthly leaderboards for their active
 * organisation, respecting each member's leaderboard opt-out.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { resolveEffectiveActor } from '../../shared/testMode.ts';
import { getOrCreateCurrentTerm, countBudgetUsed } from '../../shared/endorsements.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'content-type': 'application/json',
};

const FEED_LIMIT = 40;

function bad(error: string, status = 400) {
  return Response.json({ ok: false, error }, { status, headers: CORS });
}

function periodStart(period: 'weekly' | 'monthly'): Date {
  const now = new Date();
  if (period === 'weekly') {
    const d = new Date(now);
    const day = (d.getDay() + 6) % 7; // Monday = 0
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

async function buildLeaderboard(svc: any, orgId: string, orgName: string | null) {
  const profiles = await svc.entities.UserProfile.filter({ school_id: orgId });
  const byEmail = new Map<string, any>(profiles.map((p: any) => [p.user_email, p]));
  const hidden = new Set<string>(
    profiles.filter((p: any) => p.leaderboard_opt_out === true).map((p: any) => p.user_email)
  );

  const regRows = await svc.entities.BlockWardVerificationRegistry.filter({ organisation_id: orgId });
  const endoRows = await svc.entities.Endorsement.filter({ school_id: orgId, status: 'active' });

  const boards: any = { organisation_id: orgId, organisation_name: orgName, weekly: {}, monthly: {} };
  for (const period of ['weekly', 'monthly'] as const) {
    const start = periodStart(period);

    const achCount: Record<string, number> = {};
    for (const r of regRows) {
      if ((r.approval_status || 'approved') !== 'approved') continue;
      if (!r.student_email) continue;
      const t = new Date(r.date_delivered || r.date_approved || r.created_date || 0);
      if (t < start) continue;
      achCount[r.student_email] = (achCount[r.student_email] || 0) + 1;
    }

    const endoCount: Record<string, number> = {};
    for (const e of endoRows) {
      if (!e.recipient_email) continue;
      const t = new Date(e.created_date || 0);
      if (t < start) continue;
      endoCount[e.recipient_email] = (endoCount[e.recipient_email] || 0) + 1;
    }

    const toBoard = (counts: Record<string, number>) =>
      Object.entries(counts)
        .filter(([email]) => !hidden.has(email))
        .map(([email, count]) => {
          const p = byEmail.get(email);
          return {
            name: p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() || email : email,
            handle: p?.handle || null,
            count,
          };
        })
        .sort((a: any, b: any) => b.count - a.count)
        .slice(0, 10);

    boards[period] = { achievements: toBoard(achCount), endorsements: toBoard(endoCount) };
  }
  return boards;
}

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  try {
    const base44 = createClientFromRequest(req);
    const actor = await resolveEffectiveActor(base44);
    if (!actor.authorized) return bad(actor.reason || 'Not authorised', actor.status || 403);

    const svc = base44.asServiceRole;
    const profileRows = await svc.entities.UserProfile.filter({ id: actor.actor_id });
    const profile = profileRows?.[0];
    if (!profile) return bad('Profile not found', 404);
    const myEmail = actor.actor_email;

    // ── The viewer's organisations ──
    const myOrgIds = new Set<string>();
    if (profile.school_id) myOrgIds.add(profile.school_id);
    let memberships: any[] = [];
    try {
      memberships = await svc.entities.StudentOrgMembership.filter({ student_email: myEmail });
    } catch { /* none */ }
    memberships.filter((m: any) => m.status === 'active').forEach((m: any) => myOrgIds.add(m.school_id));

    const mySchools: any[] = [];
    for (const id of myOrgIds) {
      try {
        const rows = await svc.entities.School.filter({ id });
        if (rows?.[0]) mySchools.push(rows[0]);
      } catch { /* skip */ }
    }

    // ── Peer organisations: same type + same country (competes / linked circle) ──
    const peerOrgIds = new Set<string>();
    for (const s of mySchools) {
      if (!s.country) continue;
      try {
        const rows = await svc.entities.School.filter({ country: s.country, org_type: s.org_type || 'school' });
        for (const o of rows) {
          if (!myOrgIds.has(o.id)) peerOrgIds.add(o.id);
        }
      } catch { /* skip */ }
    }

    // ── Follows ──
    const follows = await svc.entities.Follow.filter({ follower_email: myEmail });
    const followedIds = new Set<string>(follows.map((f: any) => f.followed_id));

    // ── Recent public achievements across the three circles ──
    const registry = await svc.entities.BlockWardVerificationRegistry.filter({}, '-created_date', 150);
    const candidates = registry.filter((r: any) =>
      r.approval_status === 'approved' &&
      r.is_public !== false &&
      r.visibility !== 'link_only' && r.visibility !== 'private' &&
      r.student_id && r.student_id !== actor.actor_id &&
      (followedIds.has(r.student_id) || myOrgIds.has(r.organisation_id) || peerOrgIds.has(r.organisation_id))
    );

    // Owner profiles — handles, avatars, and privacy gating (private/link-only owners never appear).
    const studentIds = [...new Set(candidates.map((r: any) => r.student_id))];
    const ownerResults = await Promise.allSettled(studentIds.map((id: string) => svc.entities.UserProfile.filter({ id })));
    const ownerById = new Map<string, any>();
    ownerResults.forEach((res: any, i: number) => {
      if (res.status === 'fulfilled' && res.value?.[0]) ownerById.set(studentIds[i], res.value[0]);
    });

    const visible = candidates.filter((r: any) => {
      const owner = ownerById.get(r.student_id);
      return owner && owner.profile_visibility === 'public';
    });

    // ── Endorsement + reaction aggregates over the visible slice ──
    const feedIds = new Set(visible.map((r: any) => r.id));
    let endorsements: any[] = [];
    try { endorsements = await svc.entities.Endorsement.filter({ status: 'active' }, '-created_date', 500); } catch { /* none */ }
    const endoByRegistry: Record<string, number> = {};
    for (const e of endorsements) {
      if (feedIds.has(e.registry_id)) endoByRegistry[e.registry_id] = (endoByRegistry[e.registry_id] || 0) + 1;
    }

    let reactions: any[] = [];
    try { reactions = await svc.entities.Reaction.filter({}, '-created_date', 500); } catch { /* none */ }
    const reactionsByRegistry: Record<string, Record<string, number>> = {};
    const myReactionsByRegistry: Record<string, string[]> = {};
    for (const r of reactions) {
      if (!feedIds.has(r.registry_id)) continue;
      const counts = reactionsByRegistry[r.registry_id] = reactionsByRegistry[r.registry_id] || {};
      counts[r.type] = (counts[r.type] || 0) + 1;
      if (r.reactor_email === myEmail) {
        myReactionsByRegistry[r.registry_id] = [...(myReactionsByRegistry[r.registry_id] || []), r.type];
      }
    }

    const feed = visible.slice(0, FEED_LIMIT).map((r: any) => {
      const owner = ownerById.get(r.student_id);
      return {
        registry_id: r.id,
        verification_id: r.verification_id,
        student_id: r.student_id,
        student_name: r.student_name || `${owner.first_name || ''} ${owner.last_name || ''}`.trim(),
        student_handle: owner.handle || null,
        student_avatar: owner.avatar_url || null,
        title: r.achievement_title,
        category: r.achievement_category || 'special',
        organisation_name: r.organisation_name || null,
        is_team_credential: r.is_team_credential === true,
        participant_role: r.participant_role || null,
        when: r.date_delivered || r.date_approved || r.created_date,
        endorsement_count: endoByRegistry[r.id] || 0,
        reactions: reactionsByRegistry[r.id] || {},
        my_reactions: myReactionsByRegistry[r.id] || [],
        following: followedIds.has(r.student_id),
      };
    });

    // ── Viewer's endorsement budget (drives the feed's endorse button) ──
    let budget: any = null;
    if (profile.school_id) {
      try {
        const term = await getOrCreateCurrentTerm(svc, profile.school_id);
        if (term) {
          const used = await countBudgetUsed(svc, term.id, actor.actor_id);
          budget = { budget: term.budget, remaining: Math.max(0, term.budget - used), term_end: term.end_date };
        }
      } catch { /* no term */ }
    }

    // ── Leaderboards for the active organisation ──
    const lbOrgId = profile.school_id || [...myOrgIds][0] || null;
    let leaderboard = null;
    if (lbOrgId) {
      try {
        const orgName = mySchools.find((s: any) => s.id === lbOrgId)?.name || null;
        leaderboard = await buildLeaderboard(svc, lbOrgId, orgName);
      } catch { /* no leaderboard */ }
    }

    return Response.json({
      ok: true,
      feed,
      following: Object.fromEntries([...followedIds].map((id) => [id, true])),
      budget,
      leaderboard,
      leaderboard_opt_out: profile.leaderboard_opt_out === true,
    }, { headers: CORS });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || String(e) }, { status: 500, headers: CORS });
  }
}