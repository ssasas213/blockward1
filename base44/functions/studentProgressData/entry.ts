import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveEffectiveActor } from '../../shared/testMode.ts';
import { resolveTeacherClasses } from '../../shared/classRoster.ts';

// studentProgressData — the authorised teacher's view of ONE student:
// grades, classwork, classroom attendance, points (including private behaviour
// points — staff-only data) and verified achievements.
//
// Authorisation is enforced server-side, never by hiding UI:
//   - teacher: must teach at least one class the student is enrolled in
//     (primary teacher, co-teacher, or via StaffMembership.class_ids);
//   - admin: any student in their school;
//   - everyone else: 403.
// Behaviour points never appear on any public endpoint — this view is the
// staff-side record only.
export default async function (req: Request): Promise<Response> {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

    const base44 = createClientFromRequest(req);
    const actor = await resolveEffectiveActor(base44);
    if (!actor.authorized) {
      return Response.json({ error: actor.reason || 'Unauthorized' }, { status: actor.status || 401 });
    }
    if (actor.actor_role !== 'teacher' && actor.actor_role !== 'admin') {
      return Response.json({ error: 'Only teachers and admins can view student progress' }, { status: 403 });
    }
    const schoolId = actor.school_id;
    if (!schoolId) return Response.json({ error: 'You are not associated with a school' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const studentEmail = String(body.student_email || '').trim().toLowerCase();
    if (!studentEmail) return Response.json({ error: 'student_email is required' }, { status: 400 });

    const svc = base44.asServiceRole;
    const students = await svc.entities.UserProfile.filter({ user_email: studentEmail });
    const student = students[0];
    if (!student) return Response.json({ error: 'Student not found' }, { status: 404 });
    if (student.user_type !== 'student') return Response.json({ error: 'Target is not a student' }, { status: 400 });
    if (student.school_id !== schoolId) {
      return Response.json({ error: 'Student is not in your school' }, { status: 403 });
    }

    // Which of the caller's classes is this student in? (admins: every school
    // class containing the student.)
    let scopeClasses;
    if (actor.actor_role === 'teacher') {
      const myClasses = await resolveTeacherClasses(base44, schoolId, actor.actor_email);
      scopeClasses = myClasses.filter(c =>
        (Array.isArray(c.student_emails) ? c.student_emails : []).some(
          e => (e || '').toLowerCase() === studentEmail
        )
      );
      if (scopeClasses.length === 0) {
        return Response.json({ error: 'You do not teach this student' }, { status: 403 });
      }
    } else {
      const schoolClasses = await svc.entities.Class.filter({ school_id: schoolId });
      scopeClasses = schoolClasses.filter(c =>
        (Array.isArray(c.student_emails) ? c.student_emails : []).some(
          e => (e || '').toLowerCase() === studentEmail
        )
      );
    }
    const scopeIds = new Set(scopeClasses.map(c => c.id));

    // Grades — published only. A draft grade is the teacher's work-in-progress
    // and never leaves the gradebook until published.
    const gradeRows = await svc.entities.StudentGrade.filter({ student_email: student.user_email, school_id: schoolId })
      .catch(() => []);
    const grades = (gradeRows || [])
      .filter(g => g.status === 'published')
      .sort((a, b) => new Date(b.published_at || b.updated_date || 0) - new Date(a.published_at || a.updated_date || 0))
      .slice(0, 20)
      .map(g => ({
        subject: g.subject || null,
        assessment_title: g.assessment_title || null,
        grade: g.grade_value || null,
        percentage: typeof g.percentage === 'number' ? Math.round(g.percentage) : null,
        term: g.term_name || null,
        published_at: g.published_at || null,
      }));

    // Work — this student's submissions in the CALLER'S classes only.
    const workRows = await svc.entities.Submission.filter({ student_email: student.user_email, school_id: schoolId })
      .catch(() => []);
    const work = (workRows || [])
      .filter(s => scopeIds.has(s.class_id))
      .sort((a, b) => new Date(b.updated_date || 0) - new Date(a.updated_date || 0))
      .slice(0, 15)
      .map(s => ({
        assignment_title: s.assignment_title || null,
        class_name: s.class_name || null,
        status: s.status,
        grade: typeof s.grade === 'number' ? s.grade : null,
        submitted_at: s.submitted_at || null,
        is_late: !!s.is_late,
        returned_at: s.returned_at || null,
      }));

    // Classroom attendance — registers taken in the caller's classes.
    const attRows = await svc.entities.AttendanceRecord.filter({ student_email: student.user_email, school_id: schoolId })
      .catch(() => []);
    const attendance = (attRows || []).filter(r => scopeIds.has(r.class_id));
    const counts = { present: 0, absent: 0, late: 0, excused: 0 };
    for (const r of attendance) if (counts[r.status] !== undefined) counts[r.status]++;
    const totalMarks = attendance.length;
    const rate = totalMarks > 0
      ? Math.round(((counts.present + counts.late) / totalMarks) * 100)
      : null;
    const recentAttendance = attendance
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
      .slice(0, 8)
      .map(r => ({ date: r.date, class_name: r.class_name || null, status: r.status }));

    // Points — staff view: achievement AND behaviour. Behaviour points are
    // private school data; they are never returned by any public endpoint.
    const pointRows = await svc.entities.PointEntry.filter({ student_email: student.user_email })
      .catch(() => []);
    const points = (pointRows || [])
      .sort((a, b) => new Date(b.timestamp || b.created_date || 0) - new Date(a.timestamp || a.created_date || 0))
      .slice(0, 10)
      .map(p => ({
        type: p.type,
        points: p.points,
        category_name: p.category_name || null,
        reason: p.reason || null,
        teacher_name: p.teacher_name || null,
        timestamp: p.timestamp || p.created_date || null,
      }));

    // Verified achievements — public-safe registry fields only.
    const registry = await svc.entities.BlockWardVerificationRegistry.filter({ student_id: student.id })
      .catch(() => []);
    const achievements = (registry || [])
      .filter(r => r.approval_status === 'approved')
      .sort((a, b) => new Date(b.date_delivered || b.date_approved || 0) - new Date(a.date_delivered || a.date_approved || 0))
      .slice(0, 12)
      .map(r => ({
        verification_id: r.verification_id,
        title: r.achievement_title,
        category: r.achievement_category,
        organisation_name: r.organisation_name || null,
        date_achieved: r.date_achieved || null,
      }));

    return Response.json({
      ok: true,
      student: {
        first_name: student.first_name,
        last_name: student.last_name,
        avatar_url: student.avatar_url || null,
        grade_level: student.grade_level || null,
        student_id: student.student_id || null,
        total_achievement_points: student.total_achievement_points || 0,
        total_behaviour_points: student.total_behaviour_points || 0,
      },
      classes: scopeClasses.map(c => ({ id: c.id, name: c.name })),
      grades,
      work,
      attendance: { counts, rate, total: totalMarks, recent: recentAttendance },
      points,
      achievements,
    });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to load student progress' }, { status: 500 });
  }
}