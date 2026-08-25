import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getCallerProfile, requireStaff } from '../../shared/staffAuth.ts';
import { resolveTeacherClasses, fetchStudentProfilesByEmails } from '../../shared/classRoster.ts';

// Returns the students across ALL of the caller's classes (teachers) — scoped
// to the caller's own school and resolved server-side, so the browser only
// receives the rows it will display. Replaces IssueBlockWard/ParentComms' old
// UserProfile.list() -> client-side .filter() (which over-exposed for admins
// and returned nothing for teachers under RLS). The test super user may pass
// teacher_email to impersonate a teacher persona.
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
    const effectiveEmail = (profile.test_super_user && body.teacher_email)
      ? String(body.teacher_email)
      : user.email;

    const myClasses = await resolveTeacherClasses(base44, profile.school_id, effectiveEmail);

    // Collect student emails across the teacher's classes (first class wins
    // for the display className/classId, matching the prior client behaviour).
    const emailToClass = {};
    const allEmails = [];
    for (const cls of myClasses) {
      for (const email of (Array.isArray(cls.student_emails) ? cls.student_emails : [])) {
        if (!email) continue;
        const key = email.toLowerCase();
        if (!emailToClass[key]) emailToClass[key] = { class_id: cls.id, class_name: cls.name };
        allEmails.push(email);
      }
    }

    const profiles = await fetchStudentProfilesByEmails(base44, profile.school_id, allEmails);
    const students = profiles.map(p => {
      const c = emailToClass[p.user_email.toLowerCase()] || {};
      return {
        id: p.id,
        user_email: p.user_email,
        first_name: p.first_name,
        last_name: p.last_name,
        avatar_url: p.avatar_url || null,
        student_id: p.student_id || null,
        parent_email: p.parent_email || null,
        parent_name: p.parent_name || null,
        parent_relationship: p.parent_relationship || null,
        total_achievement_points: p.total_achievement_points || 0,
        total_behaviour_points: p.total_behaviour_points || 0,
        class_id: c.class_id || null,
        class_name: c.class_name || null,
      };
    });
    const classes = myClasses.map(c => ({ id: c.id, name: c.name }));

    return Response.json({ ok: true, students, classes });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to load students' }, { status: 500 });
  }
}