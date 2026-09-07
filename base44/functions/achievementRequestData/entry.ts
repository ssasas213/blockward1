// achievementRequestData — read model for the student achievement request flow.
// mode 'student': orgs the student belongs to, credential templates, staff
// directory for verifier nomination, their own requests, and cap usage.
// mode 'reviewer': the reviewer's Pending Sign-offs queue with counts and
// rejection-rate flags (admins).
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { resolveEffectiveActor } from '../../shared/testMode.ts';
import {
  OPEN_STATUSES, VERIFIER_ACTIONABLE, ADMIN_ACTIONABLE,
  OPEN_REQUEST_LIMIT, WEEKLY_PER_ORG_LIMIT, DAY_MS, rejectionStatsFor,
} from '../../shared/achievementRequests.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'content-type': 'application/json',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const mode = body.mode || 'student';

    const actor = await resolveEffectiveActor(base44);
    if (!actor.authorized) {
      return Response.json({ ok: false, error: actor.reason || 'Unauthorized' }, { status: actor.status || 401, headers: CORS });
    }
    const svc = base44.asServiceRole;
    const email = actor.actor_email;
    const role = actor.actor_role;
    const schoolId = actor.school_id;
    const actorName = `${actor.first_name || ''} ${actor.last_name || ''}`.trim() || email;

    if (mode === 'student') {
      if (role !== 'student') {
        return Response.json({ ok: false, error: 'Only students have achievement requests' }, { status: 403, headers: CORS });
      }
      const schoolRows = await svc.entities.School.filter({ id: schoolId });
      const school = schoolRows?.[0] || null;

      // Every organisation the student belongs to: home school + approved
      // cross-org memberships. Requests can target any of them.
      let memberships: any[] = [];
      try { memberships = await svc.entities.StudentOrgMembership.filter({ student_email: email }); } catch (e) { /* empty */ }
      const orgIds = [schoolId, ...memberships.filter((m) => m.status === 'active').map((m) => m.school_id)]
        .filter(Boolean)
        .filter((id, i, arr) => arr.indexOf(id) === i);

      const orgs: any[] = [];
      const templates: any[] = [];
      const staff: any[] = [];
      for (const oid of orgIds) {
        let org = null;
        try { const rows = await svc.entities.School.filter({ id: oid }); org = rows?.[0] || null; } catch (e) { /* ignore */ }
        if (!org) continue;
        orgs.push(org);
        try {
          const t = await svc.entities.AwardTypes.filter({ school_id: oid });
          for (const x of t) {
            if (x.is_active !== false) {
              templates.push({ id: x.id, title: x.title, category: x.category, verification_tier: x.verification_tier || 1, school_id: oid });
            }
          }
        } catch (e) { /* ignore */ }
        try {
          const rows = await svc.entities.UserProfile.filter({ school_id: oid });
          for (const p of rows.filter((x) => ['teacher', 'admin'].includes(x.user_type) && x.status !== 'suspended')) {
            staff.push({
              id: p.id,
              email: p.user_email,
              name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.user_email,
              user_type: p.user_type,
              school_id: oid,
            });
          }
        } catch (e) { /* ignore */ }
      }
      const myRequests = await svc.entities.AchievementRequest.filter({ student_email: email }, '-created_date', 100);

      const now = Date.now();
      const weekAgo = new Date(now - 7 * DAY_MS).toISOString();
      const openCount = myRequests.filter((r) => OPEN_STATUSES.includes(r.status)).length;
      const weeklyCount = myRequests.filter(
        (r) => r.school_id === schoolId && r.submitted_at && r.submitted_at >= weekAgo && r.status !== 'draft'
      ).length;

      return Response.json({
        ok: true,
        mode: 'student',
        student: { email, name: actorName },
        orgs: orgs.map((o) => ({ id: o.id, name: o.name, org_type: o.org_type })),
        templates: templates
          .filter((t) => t.is_active !== false)
          .map((t) => ({ id: t.id, title: t.title, category: t.category, verification_tier: t.verification_tier || 1 })),
        staff,
        requests: myRequests,
        caps: {
          open_count: openCount,
          open_limit: OPEN_REQUEST_LIMIT,
          weekly_count: weeklyCount,
          weekly_limit: WEEKLY_PER_ORG_LIMIT,
          can_submit: openCount < OPEN_REQUEST_LIMIT && weeklyCount < WEEKLY_PER_ORG_LIMIT,
        },
      }, { headers: CORS });
    }

    if (mode === 'reviewer') {
      if (role !== 'teacher' && role !== 'admin') {
        return Response.json({ ok: false, error: 'Only organisation staff can review requests' }, { status: 403, headers: CORS });
      }
      let queue = [];
      let flagged = [];
      if (role === 'teacher') {
        const mine = await svc.entities.AchievementRequest.filter({ nominated_verifier_email: email }, '-created_date', 100);
        queue = mine.filter((r) => VERIFIER_ACTIONABLE.includes(r.status));
      } else {
        const schoolRequests = await svc.entities.AchievementRequest.filter({ school_id: schoolId }, '-created_date', 200);
        queue = schoolRequests.filter((r) => ADMIN_ACTIONABLE.includes(r.status));
        flagged = schoolRequests
          .filter((r) => r.student_flagged === true)
          .map((r) => ({ student_email: r.student_email, student_name: r.student_name }));
      }

      return Response.json({
        ok: true,
        mode: 'reviewer',
        reviewer: { email, name: actorName, role },
        queue,
        count: queue.length,
        flagged_students: flagged,
      }, { headers: CORS });
    }

    return Response.json({ ok: false, error: 'Unknown mode' }, { status: 400, headers: CORS });
  } catch (e) {
    return Response.json({ ok: false, error: e?.message || String(e) }, { status: 500, headers: CORS });
  }
});