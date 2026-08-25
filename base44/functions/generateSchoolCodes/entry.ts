import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getCallerProfile, requireStaff, requireSameSchool } from '../../shared/staffAuth.ts';

// Sole write path for SchoolCode (entity create/update/delete locked to
// __service_role_only__). RLS `user_condition: { role: "admin" }` checks the
// platform role, not UserProfile.user_type, so a real BlockWard school admin
// (platform "user") was denied. This function verifies user_type === 'admin'
// and school scope in server code.
//
// Actions:
//   generate  — ensure a teacher and an admin code exist (no student code;
//               students join classes with a class code). Returns the codes.
//   regenerate — deactivate code_id, create a fresh active code of the same role.
//   toggle    — flip code_id status active <-> disabled.
export default async function(req: Request): Promise<Response> {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

    const base44 = createClientFromRequest(req);
    const { user, profile, error } = await getCallerProfile(base44);
    if (error) return Response.json({ error: error.error }, { status: error.status });
    const staffErr = requireStaff(profile, ['admin']);
    if (staffErr) return Response.json({ error: staffErr.error }, { status: staffErr.status });
    if (!profile.school_id) return Response.json({ error: 'No school linked to your account' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'generate';
    const svc = base44.asServiceRole;

    const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    function makeCode(prefix, roleSuffix) {
      const p = (prefix || 'SCH').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4) || 'SCH';
      let random = '';
      for (let i = 0; i < 6; i++) random += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
      return `${p}-${roleSuffix}-${random}`;
    }
    const ROLE_DEFS = [
      { role_type: 'teacher', suffix: 'TEACH', label: 'Teacher Join Code' },
      { role_type: 'admin', suffix: 'ADMIN', label: 'Admin Join Code' },
    ];
    const order = { teacher: 0, admin: 1 };
    const sortByRole = (a, b) => (order[a.role_type] ?? 9) - (order[b.role_type] ?? 9);

    const schools = await svc.entities.School.filter({ id: profile.school_id });
    const schoolName = schools[0]?.name || 'School';

    if (action === 'generate') {
      const out = [];
      for (const def of ROLE_DEFS) {
        const existing = await svc.entities.SchoolCode.filter({
          school_id: profile.school_id, role_type: def.role_type, status: 'active',
        });
        if (existing.length > 0) { out.push(existing[0]); continue; }
        out.push(await svc.entities.SchoolCode.create({
          school_id: profile.school_id, school_name: schoolName,
          code: makeCode(schoolName, def.suffix), role_type: def.role_type,
          status: 'active', created_by: user.email, label: def.label,
        }));
      }
      out.sort(sortByRole);
      return Response.json({ ok: true, codes: out });
    }

    if (action === 'regenerate' || action === 'toggle') {
      if (!body.code_id) return Response.json({ error: 'code_id is required' }, { status: 400 });
      const found = await svc.entities.SchoolCode.filter({ id: body.code_id });
      const code = found[0];
      if (!code) return Response.json({ error: 'Code not found' }, { status: 404 });
      const sameErr = requireSameSchool(profile, code.school_id);
      if (sameErr) return Response.json({ error: sameErr.error }, { status: sameErr.status });

      if (action === 'toggle') {
        const newStatus = code.status === 'active' ? 'disabled' : 'active';
        await svc.entities.SchoolCode.update(code.id, { status: newStatus });
        return Response.json({ ok: true, code: { ...code, status: newStatus } });
      }

      // regenerate
      await svc.entities.SchoolCode.update(code.id, { status: 'disabled' });
      const suffix = code.role_type === 'teacher' ? 'TEACH' : 'ADMIN';
      const newCode = await svc.entities.SchoolCode.create({
        school_id: code.school_id, school_name: code.school_name || schoolName,
        code: makeCode(schoolName, suffix), role_type: code.role_type,
        status: 'active', created_by: user.email, label: code.label || `${code.role_type} Join Code`,
      });
      return Response.json({ ok: true, code: newCode });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to manage codes' }, { status: 500 });
  }
}