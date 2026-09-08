import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { defaultAdminPermissions } from '../../shared/adminPermissions.ts';
import { provisionProfile, logRoleGrant } from '../../shared/profileProvisioning.ts';

const UNSAFE_CHARS = /[O0I1L]/g;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateCode(prefix, roleSuffix) {
  const p = prefix.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4) || 'SCH';
  let random = '';
  for (let i = 0; i < 6; i++) {
    random += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return `${p}-${roleSuffix}-${random}`;
}

// Create a school. The caller becomes the owner-admin of the NEW school only
// (super_admin scoped to it). Schools created here start verification_status
// 'unverified'. Only an existing admin — or an account still in the 'pending'
// holding state (no school yet) — may create a school; a teacher/student
// cannot. Profile creation goes through the shared provisionProfile path.
export default async function(req: Request): Promise<Response> {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204 });
    }
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      name, country, city, school_type, contact_email,
      logo_url, website, address, description, phone,
      admin_full_name, admin_job_title, admin_department, admin_phone
    } = body;

    if (!name?.trim()) return Response.json({ error: 'School name is required' }, { status: 400 });
    if (!contact_email?.trim()) return Response.json({ error: 'Contact email is required' }, { status: 400 });

    const svc = base44.asServiceRole;

    // Check for duplicate school owned by this admin
    const existingSchools = await svc.entities.School.filter({
      admin_email: user.email,
      status: 'active'
    });
    const duplicate = existingSchools.find(s =>
      s.name.trim().toLowerCase() === name.trim().toLowerCase()
    );
    if (duplicate) {
      return Response.json({ error: `You already own a school named "${duplicate.name}"` }, { status: 409 });
    }

    // Resolve the caller's profile through the single provisioning path.
    let profile = null;
    const profiles = await svc.entities.UserProfile.filter({ user_email: user.email });
    if (profiles.length > 0) {
      profile = profiles[0];
      // Only an existing admin or a still-unplaced 'pending' account may
      // create a school — a teacher/student must not.
      if (profile.user_type !== 'admin' && profile.user_type !== 'pending') {
        return Response.json({ error: 'Only administrators can create a school' }, { status: 403 });
      }
    } else {
      const nameParts = (admin_full_name || user.full_name || user.email || 'Admin').trim().split(/\s+/);
      ({ profile } = await provisionProfile(svc, user, {
        first_name: nameParts[0] || 'Admin',
        last_name: nameParts.slice(1).join(' ') || '',
      }));
    }

    // 1. Create School — self-service schools start unverified
    const schoolCode = generateCode(name, 'MAIN');
    const school = await svc.entities.School.create({
      name: name.trim(),
      code: schoolCode,
      school_code: schoolCode,
      org_type: 'school',
      school_type: school_type || 'other',
      country: country?.trim() || undefined,
      city: city?.trim() || undefined,
      website: website?.trim() || undefined,
      contact_email: contact_email.trim(),
      logo_url: logo_url || undefined,
      admin_email: user.email,
      admin_title: admin_job_title?.trim() || undefined,
      address: address?.trim() || [city, country].filter(Boolean).join(', ') || undefined,
      status: 'active',
      verification_status: 'unverified',
      created_by: user.email,
    });

    // 2. Create AdminSchoolMembership (owner)
    await svc.entities.AdminSchoolMembership.create({
      admin_user_id: profile.id,
      admin_email: user.email,
      admin_name: `${profile.first_name} ${profile.last_name}`,
      school_id: school.id,
      school_name: school.name,
      role: 'owner',
      status: 'active',
      is_primary: true,
      joined_at: new Date().toISOString(),
    });

    // 3. Generate join codes — teacher and student only. Admin is
    //    invite-only: a code can never grant it.
    const teacherCode = generateCode(name, 'TEACH');
    const studentCode = generateCode(name, 'STUD');

    const codeRecords = await Promise.all([
      svc.entities.SchoolCode.create({
        school_id: school.id,
        school_name: school.name,
        code: teacherCode,
        role_type: 'teacher',
        status: 'active',
        created_by: user.email,
        label: 'Teacher Join Code',
      }),
      svc.entities.SchoolCode.create({
        school_id: school.id,
        school_name: school.name,
        code: studentCode,
        role_type: 'student',
        status: 'active',
        created_by: user.email,
        label: 'Student Join Code',
      }),
    ]);

    // 4. Update UserProfile — owner-admin scoped to the new school
    const nameParts = (admin_full_name || user.full_name || '').trim().split(/\s+/);
    const oldRole = profile.user_type;
    await svc.entities.UserProfile.update(profile.id, {
      user_type: 'admin',
      school_id: school.id,
      active_school_id: school.id,
      admin_level: profile.admin_level || 'super_admin',
      admin_permissions: (profile.admin_permissions && Object.keys(profile.admin_permissions).length)
        ? profile.admin_permissions
        : defaultAdminPermissions(profile.admin_level || 'super_admin'),
      first_name: nameParts[0] || profile.first_name,
      last_name: nameParts.slice(1).join(' ') || profile.last_name,
      department: admin_department?.trim() || profile.department,
      status: 'active',
    });

    // Audit the role grant: this is what made the caller an admin.
    await logRoleGrant(svc, {
      record_id: profile.id,
      school_id: school.id,
      granted_by_email: user.email,
      granted_to_email: user.email,
      granted_to_name: `${profile.first_name} ${profile.last_name}`.trim(),
      role: 'admin',
      old_role: oldRole,
      mechanism: 'new school creation (owner-admin, school unverified)',
    });

    // 5. Create AuditLog
    await svc.entities.AuditLog.create({
      record_id: school.id,
      school_id: school.id,
      actor_email: user.email,
      actor_name: `${profile.first_name} ${profile.last_name}`,
      actor_role: 'admin',
      action: 'school_created',
      new_status: 'active',
      notes: `School "${school.name}" created by ${user.email}`,
      timestamp: new Date().toISOString(),
    });

    return Response.json({
      success: true,
      school: {
        id: school.id,
        name: school.name,
        logo_url: school.logo_url,
        school_type: school.school_type,
      },
      codes: {
        teacher: teacherCode,
        student: studentCode,
      },
      code_ids: codeRecords.map(c => c.id),
    });
  } catch (error) {
    console.error('setupSchool error:', error);
    return Response.json({ error: error.message || 'Failed to create school' }, { status: 500 });
  }
}