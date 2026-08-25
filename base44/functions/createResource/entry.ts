import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getCallerProfile, requireStaff, requireSameSchool } from '../../shared/staffAuth.ts';

// Teacher/admin-only resource upload. The file is uploaded client-side (UploadFile)
// and only the file_url passed in; teacher_email and school_id are forced server-side.
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
    if (!body.class_id || !body.title || !body.file_url) {
      return Response.json({ error: 'class_id, title and file_url are required' }, { status: 400 });
    }

    const created = await base44.asServiceRole.entities.Resource.create({
      school_id: profile.school_id,
      class_id: body.class_id,
      class_name: body.class_name || undefined,
      teacher_email: user.email,
      title: body.title,
      description: body.description || undefined,
      file_url: body.file_url,
      file_type: body.file_type || 'other',
      file_size: body.file_size || undefined,
      category: body.category || undefined,
      tags: body.tags || undefined,
    });

    return Response.json({ ok: true, resource: created });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to create resource' }, { status: 500 });
  }
}