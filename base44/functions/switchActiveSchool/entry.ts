import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveEffectiveActor } from '../../shared/testMode.ts';

// Switches an admin's active school. The caller must own the school or hold an
// active AdminSchoolMembership for it. Updates both school_id (RLS scope) and
// active_school_id — these are membership fields, never client-writable.
export default async function(req: Request): Promise<Response> {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

    const base44 = createClientFromRequest(req);

    // Effective actor: under Test Mode the active persona switches school, and
    // the authorisation below runs against the persona's role and memberships.
    const actor = await resolveEffectiveActor(base44);
    if (!actor.authorized) return Response.json({ error: actor.reason || 'Unauthorized' }, { status: actor.status || 401 });

    const body = await req.json().catch(() => ({}));
    const schoolId = body.school_id;
    if (!schoolId) return Response.json({ error: 'school_id is required' }, { status: 400 });

    const svc = base44.asServiceRole;
    const caller = { id: actor.actor_id, user_type: actor.actor_role, school_id: actor.school_id };
    if (!['admin', 'teacher', 'student'].includes(caller.user_type)) {
      return Response.json({ error: 'Account not active' }, { status: 403 });
    }

    // Authorization per role — switching is only allowed to a school the user
    // actually belongs to (owned, active membership, or currently linked).
    let authorized = false;
    if (caller.user_type === 'admin') {
      const [owned, memberships] = await Promise.all([
        svc.entities.School.filter({ id: schoolId, admin_email: actor.actor_email }),
        svc.entities.AdminSchoolMembership.filter({ school_id: schoolId, admin_email: actor.actor_email, status: 'active' }),
      ]);
      authorized = owned.length > 0 || memberships.length > 0;
    } else if (caller.user_type === 'teacher') {
      const staff = await svc.entities.StaffMembership.filter({ school_id: schoolId, user_email: actor.actor_email, status: 'active' });
      authorized = staff.length > 0;
    } else if (caller.user_type === 'student') {
      const orgs = await svc.entities.StudentOrgMembership.filter({ school_id: schoolId, student_email: actor.actor_email, status: 'active' });
      authorized = orgs.length > 0 || caller.school_id === schoolId;
    }
    if (!authorized) {
      return Response.json({ error: 'You do not have access to that school' }, { status: 403 });
    }

    await svc.entities.UserProfile.update(caller.id, {
      school_id: schoolId,
      active_school_id: schoolId,
    });
    return Response.json({ ok: true, school_id: schoolId });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to switch school' }, { status: 500 });
  }
}