import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getCallerProfile, requireStaff, requireSameSchool } from '../../shared/staffAuth.ts';

// Teacher/admin-only signature profile creation. user_email, school_id and
// user_role are forced server-side so a caller cannot create a signature profile
// for someone else or spoof their role.
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
    if (!body.display_name?.trim() || !body.signature_value) {
      return Response.json({ error: 'display_name and signature_value are required' }, { status: 400 });
    }

    const created = await base44.asServiceRole.entities.SignatureProfile.create({
      user_email: user.email,
      school_id: profile.school_id,
      user_role: profile.user_type, // 'teacher' or 'admin'
      display_name: body.display_name.trim(),
      title: body.title || undefined,
      signature_type: body.signature_type || 'typed',
      signature_value: body.signature_value,
      created_at: new Date().toISOString(),
    });

    return Response.json({ ok: true, signature_profile: created });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to create signature profile' }, { status: 500 });
  }
}