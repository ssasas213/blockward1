import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// A user may only edit their OWN presentational fields. Role, membership,
// status and admin grants are immutable from the client and go through their
// own admin-gated functions (changeUserRole / adminUpdateUser / setAdminPermissions).
const ALLOWED = new Set([
  'first_name', 'last_name', 'avatar_url',
  'theme_preference', 'show_mascot_on_signin',
  'department', 'subjects', 'grade_level', 'student_id',
  'parent_name', 'parent_email', 'parent_phone', 'parent_relationship', 'parent_contact_updated_at',
]);

export default async function(req: Request): Promise<Response> {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const updates = body && body.updates ? body.updates : body;

    const clean: Record<string, any> = {};
    for (const key of Object.keys(updates)) {
      if (ALLOWED.has(key)) clean[key] = updates[key];
    }
    if (Object.keys(clean).length === 0) {
      return Response.json({ error: 'No permitted fields to update' }, { status: 400 });
    }

    const profiles = await base44.asServiceRole.entities.UserProfile.filter({ user_email: user.email });
    if (profiles.length === 0) return Response.json({ error: 'Profile not found' }, { status: 404 });

    const updated = await base44.asServiceRole.entities.UserProfile.update(profiles[0].id, clean);
    return Response.json({ ok: true, profile: updated });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to update profile' }, { status: 500 });
  }
}