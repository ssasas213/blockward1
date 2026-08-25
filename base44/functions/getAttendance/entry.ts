import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveEffectiveActor } from '../../shared/testMode.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'content-type': 'application/json',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: cors });

  try {
    const base44 = createClientFromRequest(req);
    const actor = await resolveEffectiveActor(base44);
    if (!actor.authorized) {
      return new Response(JSON.stringify({ error: actor.reason || 'Unauthorized' }), { status: actor.status || 401, headers: cors });
    }

    const body = await req.json();
    const { class_id, date } = body;
    if (!class_id || !date) {
      return new Response(JSON.stringify({ error: 'class_id and date are required' }), { status: 400, headers: cors });
    }

    const svc = base44.asServiceRole;
    const classes = await svc.entities.Class.filter({ id: class_id });
    const cls = classes[0];
    if (!cls) return new Response(JSON.stringify({ error: 'Class not found' }), { status: 404, headers: cors });
    if (cls.school_id !== actor.school_id) {
      return new Response(JSON.stringify({ error: 'This class does not belong to your school' }), { status: 403, headers: cors });
    }

    // Teachers may only load registers for classes they teach; admins may view any class in their school.
    if (actor.actor_role === 'teacher') {
      const staff = await svc.entities.StaffMembership.filter({ user_email: actor.actor_email, school_id: actor.school_id });
      const teaches = staff.some(s => (s.class_ids || []).includes(class_id));
      if (!teaches) {
        return new Response(JSON.stringify({ error: 'You do not teach this class' }), { status: 403, headers: cors });
      }
    } else if (actor.actor_role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Only teachers and admins can take registers' }), { status: 403, headers: cors });
    }

    const [enrollments, records] = await Promise.all([
      svc.entities.Enrollment.filter({ class_id, school_id: actor.school_id, status: 'active' }),
      svc.entities.AttendanceRecord.filter({ class_id, date, school_id: actor.school_id }),
    ]);

    const roster = enrollments
      .map(e => ({ student_email: e.student_email, student_name: e.student_name || e.student_email }))
      .sort((a, b) => (a.student_name || '').localeCompare(b.student_name || ''));

    const marks = {};
    for (const r of records) {
      marks[r.student_email] = {
        status: r.status,
        note: r.note || '',
        marked_at: r.marked_at,
        marked_by_name: r.marked_by_name,
      };
    }

    return new Response(JSON.stringify({
      class_name: cls.name,
      school_id: cls.school_id,
      roster,
      marks,
    }), { status: 200, headers: cors });
  } catch (e) {
    console.error('getAttendance error', e);
    return new Response(JSON.stringify({ error: e?.message || 'Failed to load attendance' }), { status: 500, headers: cors });
  }
});