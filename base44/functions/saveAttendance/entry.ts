import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveEffectiveActor } from '../../shared/testMode.ts';
import { ensureAttendanceSession, writeAudit } from '../../shared/seating.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'content-type': 'application/json',
};

const VALID = new Set(['present', 'absent', 'late', 'excused']);

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
    const { class_id, date, marks, reason } = body;
    if (!class_id || !date || !Array.isArray(marks)) {
      return new Response(JSON.stringify({ error: 'class_id, date and marks[] are required' }), { status: 400, headers: cors });
    }

    const svc = base44.asServiceRole;
    const classes = await svc.entities.Class.filter({ id: class_id });
    const cls = classes[0];
    if (!cls) return new Response(JSON.stringify({ error: 'Class not found' }), { status: 404, headers: cors });
    if (cls.school_id !== actor.school_id) {
      return new Response(JSON.stringify({ error: 'This class does not belong to your school' }), { status: 403, headers: cors });
    }

    if (actor.actor_role === 'teacher') {
      const staff = await svc.entities.StaffMembership.filter({ user_email: actor.actor_email, school_id: actor.school_id });
      const teaches = staff.some(s => (s.class_ids || []).includes(class_id)) || cls.teacher_email === actor.actor_email || (cls.co_teachers || []).includes(actor.actor_email);
      if (!teaches) {
        return new Response(JSON.stringify({ error: 'You do not teach this class' }), { status: 403, headers: cors });
      }
    } else if (actor.actor_role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Only teachers and admins can save attendance' }), { status: 403, headers: cors });
    }

    const markedBy = `${actor.first_name || ''} ${actor.last_name || ''}`.trim() || actor.actor_email;
    const now = new Date().toISOString();

    // Load existing marks to detect edits (status changes after a prior save).
    const existing = await svc.entities.AttendanceRecord.filter({ class_id, date, school_id: actor.school_id });
    const existingMap = {};
    for (const r of existing) existingMap[r.student_email] = r;

    const marksMap = {};
    for (const m of marks) { if (m && m.student_email && VALID.has(m.status)) marksMap[m.student_email] = m.status; }

    // Ensure a canonical AttendanceSession exists for (class, date) and stamp records with it.
    const session = await ensureAttendanceSession(svc, actor, cls, date, marksMap);

    const editedEntries = [];
    let saved = 0;
    for (const m of marks) {
      if (!m || !m.student_email || !VALID.has(m.status)) continue;
      const prev = existingMap[m.student_email];
      const payload = {
        school_id: actor.school_id,
        class_id,
        class_name: cls.name,
        student_email: m.student_email,
        student_name: m.student_name || m.student_email,
        date,
        status: m.status,
        note: m.note || '',
        marked_by_email: actor.actor_email,
        marked_by_name: markedBy,
        marked_at: now,
        attendance_session_id: session.id,
        academic_term_id: session.academic_term_id || null,
      };
      if (prev) {
        await svc.entities.AttendanceRecord.update(prev.id, payload);
        if (prev.status && prev.status !== m.status) {
          editedEntries.push({ student_email: m.student_email, student_name: payload.student_name, old_status: prev.status, new_status: m.status });
        }
      } else {
        await svc.entities.AttendanceRecord.create(payload);
      }
      saved++;
    }

    // Audit: a single "saved" entry for an initial register; per-student "edited" entries for corrections.
    const isInitial = existing.length === 0;
    if (isInitial) {
      await writeAudit(svc, actor, { class_id, session_id: session.id, action: 'attendance_saved', new_status: `${saved} marks` });
    }
    for (const e of editedEntries) {
      await writeAudit(svc, actor, {
        class_id, session_id: session.id,
        student_email: e.student_email, student_name: e.student_name,
        action: actor.actor_role === 'admin' ? 'admin_override' : 'attendance_edited',
        old_status: e.old_status, new_status: e.new_status,
        reason: reason || null,
      });
    }

    return new Response(JSON.stringify({ saved, session_id: session.id, edits: editedEntries.length }), { status: 200, headers: cors });
  } catch (e) {
    console.error('saveAttendance error', e);
    return new Response(JSON.stringify({ error: e?.message || 'Failed to save attendance' }), { status: 500, headers: cors });
  }
});