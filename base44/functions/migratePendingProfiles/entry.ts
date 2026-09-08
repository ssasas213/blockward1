import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';

/**
 * migratePendingProfiles — ONE-OFF migration.
 *
 * Since profileProvisioning assigns 'student' for a no-code signup, a
 * 'pending' profile with no pending teacher/admin grant is simply a
 * school-less student created before that change. This converts them to
 * 'student' so the route guard never traps them on a join screen.
 *
 * Genuinely pending role grants (teacher/admin awaiting approval) KEEP
 * user_type 'pending' — their holding screen is the login page, never
 * JoinSchool. Accounts mid-approval, awaiting guardian consent, or
 * suspended are left untouched.
 *
 * Invoked once by the test controller; idempotent (re-running is a no-op).
 */
export default async function(req: Request): Promise<Response> {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
    if (req.method !== 'POST') return Response.json({ ok: false, error: 'Method not allowed' }, { status: 405 });

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    // Platform maintenance — the test controller only, never per-school admins.
    const controllerEmail = (secrets.get('TEST_SUPER_USER_EMAIL') || '').trim().toLowerCase();
    if (!controllerEmail || (user.email || '').trim().toLowerCase() !== controllerEmail) {
      return Response.json({ ok: false, error: 'Forbidden — test controller only' }, { status: 403 });
    }

    const svc = base44.asServiceRole;
    const pendingProfiles = await svc.entities.UserProfile.filter({ user_type: 'pending' });
    const converted = [];
    const kept = [];

    for (const p of pendingProfiles) {
      // Accounts mid-approval / awaiting consent / suspended are not plain students.
      if (p.status && p.status !== 'active') {
        kept.push({ id: p.id, email: p.user_email, reason: `status: ${p.status}` });
        continue;
      }
      const email = p.user_email;

      // A genuinely pending role grant keeps the 'pending' type.
      let pendingGrant = null;
      try {
        const staff = await svc.entities.StaffMembership.filter({ user_email: email });
        if (staff.some(s => s.status === 'pending')) pendingGrant = 'teacher join approval in progress';
      } catch { /* ignore */ }
      if (!pendingGrant) {
        try {
          const adminM = await svc.entities.AdminSchoolMembership.filter({ admin_email: email });
          if (adminM.some(m => m.status === 'pending')) pendingGrant = 'admin membership approval in progress';
        } catch { /* ignore */ }
      }
      if (pendingGrant) {
        kept.push({ id: p.id, email: p.user_email, reason: pendingGrant });
        continue;
      }

      try {
        await svc.entities.UserProfile.update(p.id, { user_type: 'student' });
        converted.push({ id: p.id, email: p.user_email });
      } catch (e) {
        kept.push({ id: p.id, email: p.user_email, reason: `update failed: ${e.message}` });
      }
    }

    return Response.json({
      ok: true,
      checked: pendingProfiles.length,
      converted: converted.length,
      kept_pending: kept.length,
      converted_profiles: converted,
      kept_profiles: kept,
    });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}