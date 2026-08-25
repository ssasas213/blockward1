import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// An admin editing another user's presentational fields + status. Role and
// membership fields are NOT editable here — those go through changeUserRole /
// switchActiveSchool. Caller must be an admin of the target's school.
const ALLOWED = new Set(['first_name', 'last_name', 'department', 'grade_level', 'student_id', 'status']);

export default async function(req: Request): Promise<Response> {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const targetEmail = String(body.target_email || '').trim().toLowerCase();
    const updates = body.updates || {};
    if (!targetEmail) return Response.json({ error: 'target_email is required' }, { status: 400 });

    const callerProfiles = await base44.asServiceRole.entities.UserProfile.filter({ user_email: user.email });
    const caller = callerProfiles[0];
    if (!caller || caller.user_type !== 'admin' || !caller.school_id) {
      return Response.json({ error: 'Only a school administrator can update users' }, { status: 403 });
    }

    const targetProfiles = await base44.asServiceRole.entities.UserProfile.filter({ user_email: targetEmail });
    const target = targetProfiles[0];
    if (!target) return Response.json({ error: 'Target user not found' }, { status: 404 });
    if (target.school_id !== caller.school_id) {
      return Response.json({ error: 'Target is not in your school' }, { status: 403 });
    }

    const clean: Record<string, any> = {};
    for (const key of Object.keys(updates)) {
      if (ALLOWED.has(key)) clean[key] = updates[key];
    }
    if (Object.keys(clean).length === 0) {
      return Response.json({ error: 'No permitted fields to update' }, { status: 400 });
    }

    const updated = await base44.asServiceRole.entities.UserProfile.update(target.id, clean);
    return Response.json({ ok: true, profile: updated });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to update user' }, { status: 500 });
  }
}