/**
 * adminReportsData — authorised reports & exports for organisation admins:
 * published grades, assignment completion, classroom attendance, register
 * completion, points and verified achievements — every dataset scoped to the
 * admin's OWN organisation, enforced server-side (this is the authorisation
 * boundary for exports, not just a UI filter).
 *
 * Optional body: { from: 'yyyy-MM-dd', to: 'yyyy-MM-dd' } — default last 30
 * days. Detail rows are capped (200–300) to keep payloads bounded; summaries
 * are computed over the full range.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveEffectiveActor } from '../../shared/testMode.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'content-type': 'application/json',
};

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDate(s) { const d = new Date(s + 'T00:00:00Z'); return isNaN(d.getTime()) ? null : d; }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  try {
    const base44 = createClientFromRequest(req);
    const actor = await resolveEffectiveActor(base44);
    if (!actor.authorized) {
      return Response.json({ ok: false, error: actor.reason || 'Unauthorized' }, { status: actor.status || 401, headers: CORS });
    }
    if (actor.actor_role !== 'admin') {
      return Response.json({ ok: false, error: 'Only organisation admins can run reports' }, { status: 403, headers: CORS });
    }
    const schoolId = actor.school_id;
    if (!schoolId) {
      return Response.json({ ok: false, error: 'You are not associated with an organisation' }, { status: 403, headers: CORS });
    }

    const body = await req.json().catch(() => ({}));
    const to = parseDate(body.to) || new Date();
    const from = parseDate(body.from) || new Date(to.getTime() - 30 * DAY_MS);
    const fromIso = from.toISOString();
    const toIso = to.toISOString();
    const inRange = (d) => {
      if (!d) return false;
      const t = new Date(d).getTime();
      return t >= from.getTime() && t <= to.getTime() + DAY_MS;
    };
    const svc = base44.asServiceRole;

    // ── Grades (published only — drafts are teacher-private) ──
    const gradeRows = (await svc.entities.StudentGrade.filter({ school_id: schoolId }))
      .filter(g => g.status === 'published' && inRange(g.published_at || g.created_date));
    const grades = {
      summary: Object.values(gradeRows.reduce((acc, g) => {
        const key = g.subject || g.class_name || 'Unspecified';
        acc[key] = acc[key] || { subject: key, assessments: 0, avg_percentage: 0 };
        acc[key].assessments++;
        acc[key].avg_percentage += Number(g.percentage) || 0;
        return acc;
      }, {})).map(s => ({ ...s, avg_percentage: Math.round(s.avg_percentage / Math.max(1, s.assessments)) })),
      rows: gradeRows.slice(0, 300).map(g => ({
        student_name: g.student_name, student_email: g.student_email, class_name: g.class_name,
        subject: g.subject, assessment_title: g.assessment_title, term_name: g.term_name,
        grade_value: g.grade_value, percentage: g.percentage, published_at: g.published_at,
      })),
    };

    // ── Assignment completion ──
    const assignments = (await svc.entities.Assignment.filter({ school_id: schoolId }))
      .filter(a => a.status === 'published' || a.status === 'archived');
    const submissions = await svc.entities.Submission.filter({ school_id: schoolId });
    const subsByAssignment = submissions.reduce((acc, s) => {
      acc[s.assignment_id] = acc[s.assignment_id] || { assigned: 0, submitted: 0, returned: 0, turned_in: 0 };
      const g = acc[s.assignment_id];
      g.assigned++;
      if (s.status === 'submitted' || s.status === 'resubmitted') { g.submitted++; g.turned_in++; }
      if (s.status === 'returned') { g.returned++; g.turned_in++; }
      return acc;
    }, {});
    const assignment_completion = assignments.slice(0, 200).map(a => {
      const g = subsByAssignment[a.id] || { assigned: 0, submitted: 0, returned: 0, turned_in: 0 };
      return {
        class_name: a.class_name, title: a.title, type: a.type, due_at: a.due_at || null,
        assigned: g.assigned, submitted: g.submitted, returned: g.returned,
        completion_rate: g.assigned ? Math.round((g.turned_in / g.assigned) * 100) : null,
      };
    });

    // ── Classroom attendance (BlockWard classroom records, not statutory MIS) ──
    const sessions = (await svc.entities.AttendanceSession.filter({ school_id: schoolId }))
      .filter(s => inRange(s.date));
    const attendanceByClass = sessions.reduce((acc, s) => {
      const key = s.class_name || s.class_id;
      acc[key] = acc[key] || { class_name: key, sessions: 0, present: 0, absent: 0, late: 0, excused: 0, marks: 0 };
      const c = acc[key];
      c.sessions++;
      c.present += s.present_count || 0;
      c.absent += s.absent_count || 0;
      c.late += s.late_count || 0;
      c.excused += s.excused_count || 0;
      c.marks += s.marks_count || 0;
      return acc;
    }, {});
    const attendance = Object.values(attendanceByClass).map(c => ({
      ...c,
      attendance_rate: c.marks ? Math.round(((c.present + c.late) / c.marks) * 100) : null,
    }));

    // ── Register completion vs timetable ──
    const timetable = await svc.entities.TimetableEntry.filter({ school_id: schoolId });
    const dayCount = [0, 1, 2, 3, 4, 5, 6].map(dow => {
      let n = 0;
      for (let t = new Date(from); t <= to; t = new Date(t.getTime() + DAY_MS)) {
        // TimetableEntry uses 0=Monday … 6=Sunday
        if ((t.getUTCDay() + 6) % 7 === dow) n++;
      }
      return n;
    });
    const expectedByClass = timetable.reduce((acc, t) => {
      const key = t.class_name || t.class_id;
      acc[key] = (acc[key] || 0) + (dayCount[t.day_of_week] || 0);
      return acc;
    }, {});
    const register_completion = Object.keys(expectedByClass).map(key => {
      const expected = expectedByClass[key];
      const held = attendanceByClass[key]?.sessions || 0;
      return { class_name: key, expected_sessions: expected, sessions_held: held, completion_rate: expected ? Math.min(100, Math.round((held / expected) * 100)) : null };
    });

    // ── Points ──
    const pointRows = (await svc.entities.PointEntry.filter({ school_id: schoolId }))
      .filter(p => inRange(p.created_date));
    const pointsByCategory = Object.values(pointRows.reduce((acc, p) => {
      const key = `${p.category_name || 'Other'} (${p.type})`;
      acc[key] = acc[key] || { category: p.category_name || 'Other', type: p.type, entries: 0, total: 0 };
      acc[key].entries++;
      acc[key].total += Math.abs(p.points || 0);
      return acc;
    }, {}));
    const pointsByStudent = Object.values(pointRows.reduce((acc, p) => {
      acc[p.student_email] = acc[p.student_email] || { student_name: p.student_name, student_email: p.student_email, achievement: 0, behaviour: 0 };
      if (p.type === 'achievement') acc[p.student_email].achievement += p.points || 0;
      else acc[p.student_email].behaviour += Math.abs(p.points || 0);
      return acc;
    }, {})).sort((a, b) => (b.achievement - b.behaviour) - (a.achievement - a.behaviour)).slice(0, 50);
    const points = { by_category: pointsByCategory, by_student: pointsByStudent, total_entries: pointRows.length };

    // ── Verified achievements (the permanent registry) ──
    const registry = await svc.entities.BlockWardVerificationRegistry.filter({ school_id: schoolId });
    const verified_achievements = {
      total: registry.length,
      by_category: Object.values(registry.reduce((acc, r) => {
        acc[r.achievement_category] = acc[r.achievement_category] || { category: r.achievement_category, count: 0 };
        acc[r.achievement_category].count++;
        return acc;
      }, {})),
      by_anchor_status: Object.values(registry.reduce((acc, r) => {
        const k = r.nft_status || 'pending';
        acc[k] = acc[k] || { anchor_status: k, count: 0 };
        acc[k].count++;
        return acc;
      }, {})),
      revoked: registry.filter(r => r.approval_status === 'revoked').length,
      chain_mismatch: registry.filter(r => r.chain_check?.status === 'hash_mismatch').length,
    };

    return Response.json({
      ok: true,
      range: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
      grades,
      assignment_completion,
      attendance,
      register_completion,
      points,
      verified_achievements,
    }, { headers: CORS });
  } catch (e) {
    return Response.json({ ok: false, error: e?.message || String(e) }, { status: 500, headers: CORS });
  }
});