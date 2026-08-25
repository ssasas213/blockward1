// Shared server-side helpers for resolving a teacher's class roster and
// student profiles, scoped to the caller's school. Used by getClassStudents
// and getMyStudents so the browser only receives the rows it will display —
// replacing the old UserProfile.list() -> client-side .filter() pattern.

// Returns the classes a teacher is associated with (primary teacher_email,
// co-teacher, or via StaffMembership.class_ids), within a single school.
export async function resolveTeacherClasses(base44, schoolId, teacherEmail) {
  if (!schoolId || !teacherEmail) return [];
  const schoolClasses = await base44.asServiceRole.entities.Class.filter({ school_id: schoolId });
  const byEmailOrCo = schoolClasses.filter(c =>
    c.teacher_email === teacherEmail ||
    (Array.isArray(c.co_teachers) && c.co_teachers.includes(teacherEmail))
  );
  if (byEmailOrCo.length > 0) return byEmailOrCo;
  const memberships = await base44.asServiceRole.entities.StaffMembership.filter({ user_email: teacherEmail });
  const m = memberships[0];
  if (m && Array.isArray(m.class_ids) && m.class_ids.length > 0) {
    return schoolClasses.filter(c => m.class_ids.includes(c.id));
  }
  return [];
}

// Returns only the student profiles (in the given school) whose email is in
// `emails`. Runs as service role so it works for teachers (whose UserProfile
// read RLS only permits their own row).
export async function fetchStudentProfilesByEmails(base44, schoolId, emails) {
  if (!schoolId || !Array.isArray(emails) || emails.length === 0) return [];
  const schoolStudents = await base44.asServiceRole.entities.UserProfile.filter({
    school_id: schoolId,
    user_type: 'student',
  });
  const emailSet = new Set(emails.map(e => e.toLowerCase()));
  return schoolStudents.filter(p => p.user_email && emailSet.has(p.user_email.toLowerCase()));
}