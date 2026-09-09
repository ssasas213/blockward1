import { defaultAdminPermissions } from './adminPermissions.ts';
import { provisionProfile, logRoleGrant } from './profileProvisioning.ts';

// ============================================================================
// schoolSetup — the COMPLETE self-service school-creation path, shared by the
// setupSchool endpoint (real users) and the demo seeding (testing). One code
// path: the creator becomes super_admin of the NEW school only, and the school
// starts verification_status 'unverified' — usable normally, but blockchain-
// anchored credentials stay paused until BlockWard verifies the organisation.
// Join codes generated here are teacher + student only (never admin).
// ============================================================================

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateSchoolCode(prefix, roleSuffix) {
  const p = (prefix || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4) || 'SCH';
  let random = '';
  for (let i = 0; i < 6; i++) {
    random += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return `${p}-${roleSuffix}-${random}`;
}

/**
 * createSchoolForAdmin — provisions the creator's profile when missing (a
 * brand-new account, exactly like the real first-admin signup), creates the
 * School, the owner AdminSchoolMembership, teacher + student join codes,
 * upgrades the profile to super_admin scoped to THIS school, and audits the
 * grant. opts.user needs only { email, full_name }.
 *
 * opts: { user, profile?, name, school_type, country, city, website,
 *         contact_email, logo_url, address, admin_full_name,
 *         admin_job_title, admin_department }
 */
export async function createSchoolForAdmin(svc, opts) {
  const user = opts.user;

  // ── Resolve the creator's profile ──
  // Creating a school makes you its owner-admin. EXISTING teachers/students may
  // not create a school (that would grant them admin); existing admins may
  // create additional schools. A brand-NEW account is provisioned here (as the
  // real first-admin signup does) and then upgraded below — so the guard only
  // applies to profiles that already existed.
  if (opts.profile && !['admin', 'pending'].includes(opts.profile.user_type)) {
    throw new Error('Only administrators can create a school');
  }
  let profile = opts.profile || null;
  if (!profile) {
    const parts = (opts.admin_full_name || user.full_name || user.email || 'Admin').trim().split(/\s+/);
    profile = (await provisionProfile(svc, user, {
      first_name: parts[0],
      last_name: parts.slice(1).join(' '),
    })).profile;
  }

  // 1. Create School — self-service schools start unverified.
  const schoolCode = generateSchoolCode(opts.name, 'MAIN');
  const school = await svc.entities.School.create({
    name: opts.name.trim(),
    code: schoolCode,
    school_code: schoolCode,
    org_type: 'school',
    school_type: opts.school_type || 'other',
    country: opts.country?.trim() || undefined,
    city: opts.city?.trim() || undefined,
    website: opts.website?.trim() || undefined,
    contact_email: opts.contact_email.trim(),
    logo_url: opts.logo_url || undefined,
    admin_email: user.email,
    admin_title: opts.admin_job_title?.trim() || undefined,
    address: opts.address?.trim() || [opts.city, opts.country].filter(Boolean).join(', ') || undefined,
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

  // 3. Generate codes for teacher + student (never admin)
  const teacherCode = generateSchoolCode(opts.name, 'TEACH');
  const studentCode = generateSchoolCode(opts.name, 'STUD');

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

  // 4. Upgrade the profile to super_admin, scoped to THIS school only
  const adminNameParts = (opts.admin_full_name || user.full_name || `${profile.first_name} ${profile.last_name}`).trim().split(/\s+/);
  await svc.entities.UserProfile.update(profile.id, {
    school_id: school.id,
    active_school_id: school.id,
    user_type: 'admin',
    admin_level: 'super_admin',
    admin_permissions: (profile.admin_permissions && Object.keys(profile.admin_permissions).length)
      ? profile.admin_permissions
      : defaultAdminPermissions('super_admin'),
    first_name: adminNameParts[0] || profile.first_name,
    last_name: adminNameParts.slice(1).join(' ') || profile.last_name,
    department: opts.admin_department?.trim() || profile.department,
    status: 'active',
  });
  await logRoleGrant(svc, {
    record_id: profile.id,
    school_id: school.id,
    granted_by_email: user.email,
    granted_to_email: user.email,
    granted_to_name: `${profile.first_name} ${profile.last_name}`.trim(),
    role: 'admin',
    old_role: profile.user_type !== 'admin' ? profile.user_type : null,
    mechanism: `new school creation (owner of ${school.name})`,
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
    notes: `School "${school.name}" created by ${user.email} (verification_status: unverified)`,
    timestamp: new Date().toISOString(),
  });

  return {
    school,
    profile,
    codes: { teacher: teacherCode, student: studentCode },
    code_ids: codeRecords.map(c => c.id),
  };
}