import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveEffectiveActor } from '../../shared/testMode.ts';

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

    // Identity must match the page the user is looking at: under Test Mode the
    // effective actor is the ACTIVE PERSONA, resolved server-side from the
    // controller's profile (never trusted from the client), so a simulated
    // student saves THEIR profile. A normal user saves their own.
    const actor = await resolveEffectiveActor(base44);
    if (!actor.authorized) {
      return Response.json({ error: actor.reason || 'Unauthorized' }, { status: actor.status || 401 });
    }

    const body = await req.json().catch(() => ({}));
    const updates = body && body.updates ? body.updates : body;

    const clean: Record<string, any> = {};
    for (const key of Object.keys(updates)) {
      if (ALLOWED.has(key)) clean[key] = updates[key];
    }
    if (Object.keys(clean).length === 0) {
      return Response.json({ error: 'No permitted fields to update' }, { status: 400 });
    }

    const svc = base44.asServiceRole;

    // Test persona — the resolver already identified the exact profile row.
    if (actor.is_test_mode) {
      const updated = await svc.entities.UserProfile.update(actor.actor_id, clean);
      // Attribution: the change was really made by the controller through the
      // persona — test mode must never erase who actually acted.
      try {
        await svc.entities.AuditLog.create({
          record_id: actor.actor_id,
          school_id: actor.school_id || 'unassigned',
          actor_email: actor.controller_email,
          actor_name: 'Test Mode controller',
          actor_role: 'test_controller',
          action: 'profile_updated',
          notes: `Test-mode profile write as ${actor.actor_email} (${actor.actor_role})`,
          timestamp: new Date().toISOString(),
        });
      } catch { /* best-effort audit */ }
      return Response.json({ ok: true, profile: updated });
    }

    // Normal user — email matched case-insensitively on both sides, because
    // profiles created before provisioning may store the email with different
    // casing than the auth account.
    const email = (actor.actor_email || '').trim().toLowerCase();
    let profiles: any[] = await svc.entities.UserProfile.filter({ user_email: actor.actor_email });
    if (profiles.length === 0) {
      profiles = await svc.entities.UserProfile.filter({ user_email: email });
    }
    if (profiles.length === 0) {
      const all = await svc.entities.UserProfile.list('-created_date', 1000);
      profiles = all.filter((p) => (p.user_email || '').trim().toLowerCase() === email);
    }
    if (profiles.length === 0) return Response.json({ error: 'Profile not found' }, { status: 404 });

    const updated = await svc.entities.UserProfile.update(profiles[0].id, clean);
    return Response.json({ ok: true, profile: updated });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to update profile' }, { status: 500 });
  }
}