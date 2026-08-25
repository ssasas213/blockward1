import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Provisions a teacher's school_id from an active StaffMembership. Teachers have
// no classes and no admin membership, so this is the teacher-specific path (the
// admin equivalent is switchActiveSchool). school_id/active_school_id/admin_email
// are membership fields, never client-writable.
export default async function(req: Request): Promise<Response> {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const profiles = await base44.asServiceRole.entities.UserProfile.filter({ user_email: user.email });
    const profile = profiles[0];
    if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 });
    if (profile.user_type !== 'teacher') {
      return Response.json({ error: 'Only teachers can provision a school from staff membership' }, { status: 403 });
    }
    if (profile.school_id) return Response.json({ ok: true, already: true, school_id: profile.school_id });

    const staff = await base44.asServiceRole.entities.StaffMembership.filter({ user_email: user.email, status: 'active' });
    const active = staff[0];
    if (!active) return Response.json({ error: 'No active staff membership found' }, { status: 404 });

    const patch: Record<string, any> = { school_id: active.school_id, active_school_id: active.school_id };
    const schools = await base44.asServiceRole.entities.School.filter({ id: active.school_id });
    if (schools.length > 0 && schools[0].admin_email) patch.admin_email = schools[0].admin_email;

    await base44.asServiceRole.entities.UserProfile.update(profile.id, patch);
    return Response.json({ ok: true, school_id: active.school_id });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to provision school' }, { status: 500 });
  }
}