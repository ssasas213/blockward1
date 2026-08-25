import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getCallerProfile, requireStaff } from '../../shared/staffAuth.ts';
import { fetchStudentProfilesByEmails } from '../../shared/classRoster.ts';

// Returns ONLY the student profiles enrolled in a given class — scoped to the
// caller's own school and to a class the caller actually teaches (or, for
// admins, any class in their school). Replaces the old client-side pattern of
// UserProfile.list() -> browser-side .filter(), which either exposed every
// profile RLS allowed (admins) or returned nothing (teachers, whose UserProfile
// read RLS only permits their own row). The browser now receives only the rows
// it will actually display.
export default async function(req: Request): Promise<Response> {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

    const base44 = createClientFromRequest(req);
    const { user, profile, error } = await getCallerProfile(base44);
    if (error) return Response.json({ error: error.error }, { status: error.status });
    const staffErr = requireStaff(profile);
    if (staffErr) return Response.json({ error: staffErr.error }, { status: staffErr.status });
    if (!profile.school_id) return Response.json({ error: 'You are not associated with a school' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const classId = String(body.class_id || '').trim();
    if (!classId) return Response.json({ error: 'class_id is required' }, { status: 400 });

    // Fetch the class as service role (RLS read for teachers only returns
    // classes they teach, but we also need it for admins and to read school_id).
    const cls = await base44.asServiceRole.entities.Class.get(classId).catch(() => null);
    if (!cls) return Response.json({ error: 'Class not found' }, { status: 404 });
    if (cls.school_id !== profile.school_id) {
      return Response.json({ error: 'You can only act within your own school' }, { status: 403 });
    }

    // Teachers (non-admins) may only fetch students for a class they teach.
    if (profile.user_type !== 'admin') {
      const isTeacherOfClass =
        cls.teacher_email === user.email ||
        (Array.isArray(cls.co_teachers) && cls.co_teachers.includes(user.email));
      let viaMembership = isTeacherOfClass;
      if (!isTeacherOfClass) {
        const memberships = await base44.asServiceRole.entities.StaffMembership.filter({ user_email: user.email });
        const m = memberships[0];
        viaMembership = !!(m && Array.isArray(m.class_ids) && m.class_ids.includes(classId));
      }
      if (!viaMembership) return Response.json({ error: 'You can only view students in your own classes' }, { status: 403 });
    }

    // Resolve the roster: prefer active enrollments, fall back to the class's
    // denormalized student_emails list.
    const enrollments = await base44.asServiceRole.entities.Enrollment.filter({ class_id: classId, status: 'active' });
    const rosterEmails = enrollments.length > 0
      ? enrollments.map(e => e.student_email).filter(Boolean)
      : (Array.isArray(cls.student_emails) ? cls.student_emails : []);
    if (rosterEmails.length === 0) return Response.json({ ok: true, students: [] });

    // Fetch only this class's student profiles, scoped to the caller's school.
    const schoolStudents = await fetchStudentProfilesByEmails(base44, profile.school_id, rosterEmails);
    const students = schoolStudents
      .map(p => ({
        id: p.id,
        user_email: p.user_email,
        first_name: p.first_name,
        last_name: p.last_name,
        avatar_url: p.avatar_url || null,
        total_achievement_points: p.total_achievement_points || 0,
        total_behaviour_points: p.total_behaviour_points || 0,
      }));

    return Response.json({ ok: true, students });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to load class students' }, { status: 500 });
  }
}