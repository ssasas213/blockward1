import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveEffectiveActor } from '../../shared/testMode.ts';

// Persona-aware dashboard data. Dashboards must reflect the EFFECTIVE actor —
// the active test persona in Test Mode, the signed-in user otherwise — exactly
// like the server's resolveEffectiveActor. Client-side entity queries run on
// the controller's token, so RLS blocks another school's records; this
// function reads through the service role scoped to the resolved actor.
export default async function(req: Request): Promise<Response> {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
    const base44 = createClientFromRequest(req);

    const actor = await resolveEffectiveActor(base44);
    if (!actor.authorized) return Response.json({ error: actor.reason || 'Unauthorized' }, { status: actor.status || 401 });

    const body = await req.json().catch(() => ({}));
    const svc = base44.asServiceRole;
    const role = actor.actor_role;
    const email = actor.actor_email;
    const schoolId = actor.school_id || null;
    const identity = {
      first_name: actor.first_name,
      last_name: actor.last_name,
      email,
      role,
      school_id: schoolId,
    };

    if (role === 'teacher') {
      const classes = await svc.entities.Class.filter({ teacher_email: email });
      // Day-of-week comes from the client so "today" follows the viewer's
      // timezone, not the server's (0-6, Monday-first like the old client query).
      const dayIndex = Number.isInteger(body.day_index) ? body.day_index : 0;
      const schedule = await svc.entities.TimetableEntry.filter({ teacher_email: email, day_of_week: dayIndex });
      const points = await svc.entities.PointEntry.filter({ teacher_email: email }, '-created_date', 5);
      let totalStudents = 0;
      classes.forEach(c => { totalStudents += (c.student_emails?.length || 0); });

      return Response.json({
        ok: true,
        role,
        identity,
        classes,
        schedule: schedule.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || '')),
        points,
        total_students: totalStudents,
      });
    }

    if (role === 'admin') {
      const school = schoolId ? (await svc.entities.School.filter({ id: schoolId }))[0] || null : null;
      const [students, teachers, classes, blockWards, pendingArchive] = await Promise.all([
        schoolId ? svc.entities.UserProfile.filter({ user_type: 'student', school_id: schoolId }) : svc.entities.UserProfile.filter({ user_type: 'student' }),
        schoolId ? svc.entities.UserProfile.filter({ user_type: 'teacher', school_id: schoolId }) : svc.entities.UserProfile.filter({ user_type: 'teacher' }),
        schoolId ? svc.entities.Class.filter({ school_id: schoolId }) : svc.entities.Class.list(),
        schoolId ? svc.entities.BlockWard.filter({ school_id: schoolId }, '-created_date') : svc.entities.BlockWard.list('-created_date', 20),
        schoolId ? svc.entities.StudentRecord.filter({ school_id: schoolId, status: 'pending_student_drive' }) : svc.entities.StudentRecord.filter({ status: 'pending_student_drive' }),
      ]);
      const driveConnected = students.filter(s => s.connected_google_email).length;

      return Response.json({
        ok: true,
        role,
        identity,
        school,
        stats: {
          total_students: students.length,
          total_teachers: teachers.length,
          total_classes: classes.length,
          total_blockwards: blockWards.length,
          drive_connected: driveConnected,
          records_pending_archive: pendingArchive.length,
        },
      });
    }

    return Response.json({ ok: true, role, identity });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}