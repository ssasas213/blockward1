import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getCallerProfile, requireStaff, requireSameSchool } from '../../shared/staffAuth.ts';

// Teacher/admin-only timetable entry creation. teacher_email and school_id are
// forced server-side.
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
    const schoolErr = requireSameSchool(profile, body.school_id);
    if (schoolErr) return Response.json({ error: schoolErr.error }, { status: schoolErr.status });
    if (!body.class_id || body.day_of_week === undefined || !body.start_time || !body.end_time) {
      return Response.json({ error: 'class_id, day_of_week, start_time and end_time are required' }, { status: 400 });
    }

    const created = await base44.asServiceRole.entities.TimetableEntry.create({
      school_id: profile.school_id,
      class_id: body.class_id,
      teacher_email: user.email,
      day_of_week: body.day_of_week,
      start_time: body.start_time,
      end_time: body.end_time,
      room: body.room || undefined,
      subject: body.subject || undefined,
      class_name: body.class_name || undefined,
      period_number: body.period_number || undefined,
    });

    return Response.json({ ok: true, entry: created });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to create timetable entry' }, { status: 500 });
  }
}