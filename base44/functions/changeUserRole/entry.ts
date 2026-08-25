import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { defaultAdminPermissions } from '../../shared/adminPermissions.ts';

// Changes a user's role. Only a BlockWard admin of the SAME school may call it,
// and the target must belong to that school. Demoting out of admin clears the
// admin grants; promoting to admin seeds the basic_admin defaults (a super
// admin can refine permissions afterwards via setAdminPermissions).
export default async function(req: Request): Promise<Response> {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const targetEmail = String(body.target_email || body.email || '').trim().toLowerCase();
    const newRole = body.new_role || body.role;
    if (!targetEmail) return Response.json({ error: 'target_email is required' }, { status: 400 });
    if (!['student', 'teacher', 'admin'].includes(newRole)) {
      return Response.json({ error: 'Invalid role' }, { status: 400 });
    }

    const callerProfiles = await base44.asServiceRole.entities.UserProfile.filter({ user_email: user.email });
    const caller = callerProfiles[0];
    if (!caller || caller.user_type !== 'admin' || !caller.school_id) {
      return Response.json({ error: 'Only a school administrator can change roles' }, { status: 403 });
    }

    const targetProfiles = await base44.asServiceRole.entities.UserProfile.filter({ user_email: targetEmail });
    const target = targetProfiles[0];
    if (!target) return Response.json({ error: 'Target user not found' }, { status: 404 });
    if (target.school_id !== caller.school_id) {
      return Response.json({ error: 'Target is not in your school' }, { status: 403 });
    }
    if (target.user_email === caller.user_email) {
      return Response.json({ error: 'You cannot change your own role' }, { status: 400 });
    }

    const patch: Record<string, any> = { user_type: newRole };
    if (newRole === 'admin') {
      patch.admin_level = 'basic_admin';
      patch.admin_permissions = defaultAdminPermissions('basic_admin');
    } else {
      patch.admin_level = null;
      patch.admin_permissions = {};
    }

    const updated = await base44.asServiceRole.entities.UserProfile.update(target.id, patch);
    return Response.json({ ok: true, profile: updated });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to change role' }, { status: 500 });
  }
}