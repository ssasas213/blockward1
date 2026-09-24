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

      // ── Work to mark: turned-in submissions in MY classes still awaiting a
      // grade. One school-wide read (service role), filtered to the teacher's
      // classes before anything leaves the server.
      const myClassIds = new Set(classes.map(c => c.id));
      const [submitted, resubmitted] = schoolId ? [
        await svc.entities.Submission.filter({ school_id: schoolId, status: 'submitted' }),
        await svc.entities.Submission.filter({ school_id: schoolId, status: 'resubmitted' }),
      ] : [[], []];
      const toMarkAll = [...submitted, ...resubmitted]
        .filter(s => myClassIds.has(s.class_id))
        .sort((a, b) => new Date(b.submitted_at || b.updated_date || 0) - new Date(a.submitted_at || a.updated_date || 0));
      const to_mark = toMarkAll.slice(0, 6).map(s => ({
        id: s.id,
        class_id: s.class_id,
        class_name: s.class_name || null,
        student_name: s.student_name || s.student_email || 'Student',
        assignment_title: s.assignment_title || null,
        status: s.status,
        submitted_at: s.submitted_at || null,
      }));

      // ── Unread direct messages addressed to the effective teacher.
      const msgs = schoolId ? await svc.entities.Message.filter({ school_id: schoolId, recipient_email: email }) : [];
      const unread_messages = msgs.filter(m => !m.read).length;

      // ── Upcoming events (assemblies, holidays, exam periods, deadlines).
      const now = new Date();
      const evts = schoolId ? await svc.entities.Event.filter({ school_id: schoolId, status: 'scheduled' }) : [];
      const events = evts
        .filter(e => e.start_time && new Date(e.start_time) >= now)
        .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
        .slice(0, 3)
        .map(e => ({
          id: e.id,
          title: e.title,
          event_type: e.event_type || 'event',
          start_time: e.start_time,
          end_time: e.end_time || null,
          location: e.location || null,
          audience: e.audience || 'whole_school',
        }));

      // ── Recent announcements visible to this teacher: school-wide, or
      // scoped to one of their classes, or their own posts.
      const anns = schoolId ? await svc.entities.Announcement.filter({ school_id: schoolId, status: 'sent' }) : [];
      const announcements = anns
        .filter(a => a.scope_type === 'SCHOOL' || myClassIds.has(a.class_id) || a.created_by === email)
        .sort((a, b) => new Date(b.sent_at || b.created_date || 0) - new Date(a.sent_at || a.created_date || 0))
        .slice(0, 3)
        .map(a => ({
          id: a.id,
          title: a.title,
          body_short: a.body_short || (a.body || '').slice(0, 120),
          priority: a.priority || 'normal',
          scope_type: a.scope_type,
          class_name: a.class_name || null,
          sent_at: a.sent_at || a.created_date || null,
        }));

      return Response.json({
        ok: true,
        role,
        identity,
        classes,
        schedule: schedule.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || '')),
        points,
        total_students: totalStudents,
        to_mark,
        to_mark_count: toMarkAll.length,
        unread_messages,
        events,
        announcements,
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