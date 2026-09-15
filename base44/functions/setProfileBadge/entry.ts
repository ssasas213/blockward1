/**
 * setProfileBadge — the ONLY entry point for writing the earned profile
 * verification badge (UserProfile.badge_*). All writes run as the service
 * role; a student can never write their own badge.
 *
 * Actions:
 *  - 'sweep'            : maintenance (scheduled daily by the "Profile Badge
 *                         Maintenance" workflow). Recomputes every student
 *                         who holds a badge or an active membership, so tier 2
 *                         grants/revocations from membership and
 *                         organisation-verification changes are automatic.
 *  - 'recompute'        : recompute one student (student_email or profile_id).
 *                         Idempotent and safe — it can only move a profile to
 *                         the tier its live data earns.
 *  - 'confirm_identity' : (admin of a VERIFIED org, REAL caller identity —
 *                         Test Mode personas are never honoured) confirm a
 *                         student profile is a real enrolled student on the
 *                         roster → tier 'identity'. Idempotent.
 *  - 'revoke_identity'  : (admin of the organisation that granted it) revoke
 *                         with a required reason. Logged and the student
 *                         notified.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import {
  isVerifiedOrg,
  schoolById,
  connectedOrgIds,
  recomputeStudentBadge,
  grantIdentityBadge,
  revokeIdentityBadge,
} from '../../shared/profileBadges.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'content-type': 'application/json',
};

const bad = (msg, status = 400) => Response.json({ ok: false, error: msg }, { status, headers: CORS });

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const action = body.action;

    // ── Daily sweep: keep every badge in step with live data ──────────────
    if (action === 'sweep') {
      const seen = new Set();
      let checked = 0;
      let changed = 0;
      const run = async (profiles) => {
        for (const p of profiles) {
          if (!p || p.user_type !== 'student' || seen.has(p.id)) continue;
          seen.add(p.id);
          checked++;
          try {
            const res = await recomputeStudentBadge(svc, p);
            if (res.changed) changed++;
          } catch (e) { /* keep sweeping */ }
        }
      };
      // Every active cross-org membership (membership changes drive tier 2)…
      let memberships = [];
      try { memberships = await svc.entities.StudentOrgMembership.filter({ status: 'active' }, '-created_date', 500); } catch (e) { /* empty */ }
      for (const m of memberships) {
        try {
          const rows = await svc.entities.UserProfile.filter({ user_email: m.student_email });
          await run(rows);
        } catch (e) { /* ignore */ }
      }
      // …plus every profile that already holds a badge (catches organisation
      // verification changes and ended home-school memberships).
      for (const tier of ['member', 'identity']) {
        try {
          const rows = await svc.entities.UserProfile.filter({ badge_tier: tier }, '-updated_date', 500);
          await run(rows);
        } catch (e) { /* ignore */ }
      }
      return Response.json({ ok: true, checked, changed }, { headers: CORS });
    }

    // ── Recompute one student (idempotent, safe) ───────────────────────────
    if (action === 'recompute') {
      const target = await findStudent(svc, body);
      if (!target) return bad('Student profile not found', 404);
      const res = await recomputeStudentBadge(svc, target, { actor_email: body.actor_email });
      return Response.json({ ok: true, ...res }, { headers: CORS });
    }

    // ── Explicit tier-3 actions — REAL admin identity, never a persona ─────
    if (action === 'confirm_identity' || action === 'revoke_identity') {
      const user = await base44.auth.me();
      if (!user) return bad('Sign in as an organisation admin to manage identity badges', 401);
      const adminRows = await svc.entities.UserProfile.filter({ user_email: user.email });
      const admin = adminRows.find((r) => r.user_type === 'admin') || null;
      if (!admin || !admin.school_id) return bad('Only organisation admins can manage identity badges', 403);
      const school = await schoolById(svc, admin.school_id);
      if (!isVerifiedOrg(school)) {
        return bad('Identity confirmation requires a BlockWard-verified organisation', 403);
      }

      const target = await findStudent(svc, body);
      if (!target) return bad('Student not found', 404);

      // The student must be on THIS organisation's roster: home school or an
      // active cross-org membership.
      const connected = await connectedOrgIds(svc, target);
      if (!connected.includes(school.id)) {
        return bad('This student is not a member of your organisation', 403);
      }

      const actorName = `${admin.first_name || ''} ${admin.last_name || ''}`.trim() || user.email;

      if (action === 'confirm_identity') {
        const res = await grantIdentityBadge(svc, {
          profile: target,
          school,
          actorEmail: user.email,
          actorName,
        });
        return Response.json({ ok: true, tier: 'identity', changed: res.changed }, { headers: CORS });
      }

      // revoke_identity — only the organisation that granted it can revoke.
      if ((target.badge_tier || 'none') !== 'identity') {
        return bad('This student does not hold an identity badge');
      }
      if (target.badge_org_id !== school.id) {
        return bad('Only the organisation that confirmed this identity can revoke it', 403);
      }
      const reason = String(body.reason || '').trim();
      if (!reason) return bad('A reason is required to revoke an identity badge');
      const res = await revokeIdentityBadge(svc, {
        profile: target,
        school,
        actorEmail: user.email,
        actorName,
        reason,
      });
      return Response.json({ ok: true, tier: res.tier, changed: true }, { headers: CORS });
    }

    return bad('Unknown action');
  } catch (e) {
    return Response.json({ ok: false, error: e?.message || String(e) }, { status: 500, headers: CORS });
  }
}

async function findStudent(svc, body) {
  if (body.profile_id) {
    try {
      const rows = await svc.entities.UserProfile.filter({ id: body.profile_id });
      return rows.find((r) => r.user_type === 'student') || null;
    } catch (e) { return null; }
  }
  const email = String(body.student_email || '').toLowerCase();
  if (email) {
    try {
      const rows = await svc.entities.UserProfile.filter({ user_email: email });
      return rows.find((r) => r.user_type === 'student') || null;
    } catch (e) { return null; }
  }
  return null;
}