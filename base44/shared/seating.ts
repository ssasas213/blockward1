// Shared helpers for the seating-plan + attendance-session backend functions.
// All authorization is performed server-side against the resolved effective actor
// (Test Mode aware), never trusting client-supplied school_id/class_id.

// Resolves a class within the actor's school and verifies the actor may manage it:
//   - admin → any class in their school
//   - teacher → only classes they own (teacher_email), co-teach (co_teachers),
//     or are assigned to via StaffMembership.class_ids
// Throws an Error with a clear message on any failure (caller maps to HTTP).
export async function authorizeClassForActor(svc, actor, class_id) {
  if (!class_id) throw new Error('class_id is required');
  const classes = await svc.entities.Class.filter({ id: class_id });
  const cls = classes[0];
  if (!cls) { const e = new Error('Class not found'); e.status = 404; throw e; }
  if (cls.school_id !== actor.school_id) {
    const e = new Error('This class does not belong to your school'); e.status = 403; throw e;
  }
  if (actor.actor_role === 'admin') return cls;
  if (actor.actor_role === 'teacher') {
    if (cls.teacher_email === actor.actor_email) return cls;
    if (Array.isArray(cls.co_teachers) && cls.co_teachers.includes(actor.actor_email)) return cls;
    const staff = await svc.entities.StaffMembership.filter({ user_email: actor.actor_email, school_id: actor.school_id });
    const teaches = staff.some(s => Array.isArray(s.class_ids) && s.class_ids.includes(class_id));
    if (teaches) return cls;
    const e = new Error('You do not teach this class'); e.status = 403; throw e;
  }
  const e = new Error('Only teachers and admins can manage seating plans'); e.status = 403; throw e;
}

// Builds the roster of enrolled students for a class (id + name + email),
// scoped to the actor's school.
export async function buildClassRoster(svc, school_id, class_id) {
  const enrollments = await svc.entities.Enrollment.filter({ class_id, school_id, status: 'active' });
  return enrollments
    .map(e => ({ student_email: e.student_email, student_name: e.student_name || e.student_email }))
    .sort((a, b) => (a.student_name || '').localeCompare(b.student_name || ''));
}

// Finds the active academic term for a date (yyyy-MM-dd), or null.
export async function findTermForDate(svc, school_id, dateStr) {
  if (!dateStr) return null;
  const terms = await svc.entities.AcademicTerm.filter({ school_id, status: 'active' });
  return terms.find(t => t.start_date && t.end_date && dateStr >= t.start_date && dateStr <= t.end_date) || null;
}

// Ensures exactly one AttendanceSession exists for (class_id, date) and returns it.
// Creates or updates session rollup counts from the provided marks map.
export async function ensureAttendanceSession(svc, actor, cls, dateStr, marksMap, opts = {}) {
  const sessions = await svc.entities.AttendanceSession.filter({ class_id: cls.id, date: dateStr, school_id: actor.school_id });
  const term = await findTermForDate(svc, actor.school_id, dateStr);
  const counts = { present: 0, absent: 0, late: 0, excused: 0 };
  for (const s of Object.values(marksMap)) { if (counts[s] != null) counts[s]++; }
  const payload = {
    school_id: actor.school_id,
    class_id: cls.id,
    class_name: cls.name,
    teacher_email: actor.actor_email,
    date: dateStr,
    timetable_entry_id: opts.timetable_entry_id || null,
    session_start_time: opts.session_start_time || null,
    session_end_time: opts.session_end_time || null,
    academic_term_id: term?.id || null,
    academic_term_name: term?.name || null,
    marks_count: Object.keys(marksMap).length,
    present_count: counts.present,
    absent_count: counts.absent,
    late_count: counts.late,
    excused_count: counts.excused,
  };
  if (sessions[0]) {
    await svc.entities.AttendanceSession.update(sessions[0].id, payload);
    return { id: sessions[0].id, ...payload, created_at: sessions[0].created_at, created_by_email: sessions[0].created_by_email };
  }
  payload.created_at = new Date().toISOString();
  payload.created_by_email = actor.actor_email;
  const created = await svc.entities.AttendanceSession.create(payload);
  return created;
}

export async function writeAudit(svc, actor, entry) {
  await svc.entities.AttendanceAuditLog.create({
    school_id: actor.school_id,
    actor_email: actor.actor_email,
    actor_name: `${actor.first_name || ''} ${actor.last_name || ''}`.trim() || actor.actor_email,
    actor_role: actor.actor_role,
    timestamp: new Date().toISOString(),
    ...entry,
  });
}