import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getCallerProfile, requireStaff, requireSameSchool } from '../../shared/staffAuth.ts';

// Teacher/admin-only announcement creation. created_by, school_id and sent_at
// are forced server-side so a caller cannot spoof them.
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
    if (!body.title?.trim() || !body.body?.trim()) {
      return Response.json({ error: 'Title and body are required' }, { status: 400 });
    }

    const created = await base44.asServiceRole.entities.Announcement.create({
      title: body.title,
      body: body.body,
      body_short: body.body_short || (body.body || '').slice(0, 200),
      priority: body.priority || 'normal',
      scope_type: body.scope_type || 'SCHOOL',
      year_group_id: body.year_group_id || undefined,
      year_group_name: body.year_group_name || undefined,
      class_id: body.class_id || undefined,
      class_name: body.class_name || undefined,
      team_name: body.team_name || undefined,
      student_emails: body.student_emails || undefined,
      student_names: body.student_names || undefined,
      status: body.status || 'draft',
      created_by: user.email,
      school_id: profile.school_id,
      sent_at: body.status === 'sent' ? new Date().toISOString() : undefined,
      scheduled_at: body.status === 'scheduled' ? body.scheduled_at : undefined,
    });

    return Response.json({ ok: true, announcement: created });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to create announcement' }, { status: 500 });
  }
}