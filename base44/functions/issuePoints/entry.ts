import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getCallerProfile, requireStaff } from '../../shared/staffAuth.ts';

// Creates a PointEntry AND updates the student's aggregate point totals in one
// server-side operation. Only a teacher/admin of the student's school may call it.
// (RLS cannot gate by user_type, so the entity create is service-role-only and
// this function enforces the role in code — same pattern as saveAttendance.)
export default async function(req: Request): Promise<Response> {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

    const base44 = createClientFromRequest(req);
    const { user, profile, error } = await getCallerProfile(base44);
    if (error) return Response.json({ error: error.error }, { status: error.status });
    const staffErr = requireStaff(profile);
    if (staffErr) return Response.json({ error: staffErr.error }, { status: staffErr.status });

    const body = await req.json().catch(() => ({}));
    const studentEmail = String(body.student_email || '').trim().toLowerCase();
    if (!studentEmail) return Response.json({ error: 'student_email is required' }, { status: 400 });
    if (!['achievement', 'behaviour'].includes(body.type)) {
      return Response.json({ error: 'Invalid type' }, { status: 400 });
    }
    const points = Number(body.points);
    if (!Number.isFinite(points)) return Response.json({ error: 'points must be a number' }, { status: 400 });

    // Student must be a student in the caller's school.
    const studentProfiles = await base44.asServiceRole.entities.UserProfile.filter({ user_email: studentEmail });
    const student = studentProfiles[0];
    if (!student) return Response.json({ error: 'Student not found' }, { status: 404 });
    if (student.user_type !== 'student') return Response.json({ error: 'Target is not a student' }, { status: 400 });
    if (student.school_id !== profile.school_id) {
      return Response.json({ error: 'Student is not in your school' }, { status: 403 });
    }

    const signedPoints = body.type === 'achievement' ? Math.abs(points) : -Math.abs(points);
    const entry = await base44.asServiceRole.entities.PointEntry.create({
      school_id: profile.school_id,
      student_email: student.user_email,
      student_name: body.student_name || `${student.first_name} ${student.last_name}`,
      teacher_email: user.email,
      teacher_name: `${profile.first_name} ${profile.last_name}`,
      class_id: body.class_id || undefined,
      class_name: body.class_name || undefined,
      category_id: body.category_id || undefined,
      category_name: body.category_name || undefined,
      type: body.type,
      points: signedPoints,
      reason: body.reason || '',
      timestamp: new Date().toISOString(),
    });

    const delta = Math.abs(points);
    const incField = body.type === 'achievement' ? 'total_achievement_points' : 'total_behaviour_points';
    const current = (student[incField] || 0);
    const updatedStudent = await base44.asServiceRole.entities.UserProfile.update(student.id, {
      [incField]: current + delta,
    });

    return Response.json({ ok: true, entry, student: updatedStudent });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to issue points' }, { status: 500 });
  }
}