import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// loginSchoolOptions — authed: every school/organisation the signed-in user
// belongs to (owned, membership, or linked on the profile). Called right after
// login: more than one option means a school picker is shown instead of
// silently defaulting to the last active school.
export default async function(req: Request): Promise<Response> {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const svc = base44.asServiceRole;
    const profiles = await svc.entities.UserProfile.filter({ user_email: user.email });
    const profile = profiles[0];
    if (!profile) return Response.json({ ok: true, role: null, schools: [] });

    const email = (user.email || '').toLowerCase();
    const map = new Map(); // school_id -> source
    const add = (id, source) => { if (id && !map.has(id)) map.set(id, source); };

    if (profile.school_id) add(profile.school_id, 'linked');

    if (profile.user_type === 'admin') {
      const owned = await svc.entities.School.filter({ admin_email: user.email });
      owned.forEach(s => add(s.id, 'owner'));
      const memberships = await svc.entities.AdminSchoolMembership.filter({ admin_email: user.email, status: 'active' });
      memberships.forEach(m => add(m.school_id, 'membership'));
    } else if (profile.user_type === 'teacher') {
      const staff = await svc.entities.StaffMembership.filter({ user_email: user.email, status: 'active' });
      staff.forEach(s => add(s.school_id, 'membership'));
    } else if (profile.user_type === 'student') {
      const orgs = await svc.entities.StudentOrgMembership.filter({ student_email: user.email, status: 'active' });
      orgs.forEach(m => add(m.school_id, 'membership'));
    }

    const currentId = profile.active_school_id || profile.school_id;
    const schools = [];
    for (const [id, source] of map.entries()) {
      try {
        const rows = await svc.entities.School.filter({ id });
        const s = rows[0];
        if (!s || s.status === 'suspended' || s.status === 'inactive') continue;
        schools.push({
          id: s.id,
          name: s.name,
          logo_url: s.logo_url || null,
          org_type: s.org_type || 'school',
          city: s.city || null,
          country: s.country || null,
          is_current: s.id === currentId,
          source,
        });
      } catch { /* skip unreadable school */ }
    }

    return Response.json({ ok: true, role: profile.user_type, schools });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to load schools' }, { status: 500 });
  }
}