import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Switches an admin's active school. The caller must own the school or hold an
// active AdminSchoolMembership for it. Updates both school_id (RLS scope) and
// active_school_id — these are membership fields, never client-writable.
export default async function(req: Request): Promise<Response> {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const schoolId = body.school_id;
    if (!schoolId) return Response.json({ error: 'school_id is required' }, { status: 400 });

    const callerProfiles = await base44.asServiceRole.entities.UserProfile.filter({ user_email: user.email });
    const caller = callerProfiles[0];
    if (!caller || caller.user_type !== 'admin') {
      return Response.json({ error: 'Only administrators can switch schools' }, { status: 403 });
    }

    const [owned, memberships] = await Promise.all([
      base44.asServiceRole.entities.School.filter({ id: schoolId, admin_email: user.email }),
      base44.asServiceRole.entities.AdminSchoolMembership.filter({ school_id: schoolId, admin_email: user.email, status: 'active' }),
    ]);
    if (owned.length === 0 && memberships.length === 0) {
      return Response.json({ error: 'You do not have access to that school' }, { status: 403 });
    }

    await base44.asServiceRole.entities.UserProfile.update(caller.id, {
      school_id: schoolId,
      active_school_id: schoolId,
    });
    return Response.json({ ok: true, school_id: schoolId });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to switch school' }, { status: 500 });
  }
}