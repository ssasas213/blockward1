import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { ADMIN_PERMISSION_KEYS } from '../../shared/adminPermissions.ts';

// Sets an admin's admin_level + admin_permissions. Only a super admin (or the
// owner with no level set) may call it, and the target admin must be in the
// caller's school. admin_permissions is a sensitive role field — never
// client-writable.
export default async function(req: Request): Promise<Response> {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const targetEmail = String(body.target_email || '').trim().toLowerCase();
    const adminLevel = body.admin_level;
    const adminPermissions = body.admin_permissions || {};
    if (!targetEmail) return Response.json({ error: 'target_email is required' }, { status: 400 });

    const callerProfiles = await base44.asServiceRole.entities.UserProfile.filter({ user_email: user.email });
    const caller = callerProfiles[0];
    if (!caller || caller.user_type !== 'admin') {
      return Response.json({ error: 'Only administrators can manage permissions' }, { status: 403 });
    }
    // A super admin, or the owner whose level is unset, may manage permissions.
    if (caller.admin_level && caller.admin_level !== 'super_admin') {
      return Response.json({ error: 'Only super admins can manage permissions' }, { status: 403 });
    }

    const targetProfiles = await base44.asServiceRole.entities.UserProfile.filter({ user_email: targetEmail });
    const target = targetProfiles[0];
    if (!target) return Response.json({ error: 'Target user not found' }, { status: 404 });
    if (target.user_type !== 'admin') return Response.json({ error: 'Target is not an admin' }, { status: 400 });
    if (caller.school_id && target.school_id !== caller.school_id) {
      return Response.json({ error: 'Target is not in your school' }, { status: 403 });
    }

    const cleanPerms: Record<string, boolean> = {};
    for (const key of ADMIN_PERMISSION_KEYS) {
      cleanPerms[key] = !!(adminPermissions as any)[key];
    }

    const patch: Record<string, any> = { admin_permissions: cleanPerms };
    const validLevels = ['super_admin', 'head_of_year', 'head_of_department', 'data_manager', 'basic_admin'];
    if (adminLevel && validLevels.includes(adminLevel)) {
      patch.admin_level = adminLevel;
    }

    const updated = await base44.asServiceRole.entities.UserProfile.update(target.id, patch);
    return Response.json({ ok: true, profile: updated });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to set permissions' }, { status: 500 });
  }
}