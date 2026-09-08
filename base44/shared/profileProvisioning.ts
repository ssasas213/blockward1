import { defaultAdminPermissions } from './adminPermissions.ts';

// ============================================================================
// profileProvisioning — the SINGLE server-side path for creating a UserProfile
// and for auditing every role grant. UserProfile create/update are locked to
// the service role, so this module is the only way a profile can come into
// existence. Role and school are derived ENTIRELY server-side:
//
//   - No code and no invitation  → user_type 'pending', no school_id. The user
//     lands on the "join or create a school" screen (JoinSchool).
//   - Join code                   → role read from the SchoolCode RECORD (teacher
//     or student only — never admin). Teachers start pending_approval and are
//     queued for admin approval. Students join immediately.
//   - Invitation token            → role and school read from the SchoolInvitation
//     record. Verified unused and unexpired, and the signed-in email must match.
//   - New school (setupSchool)    → user_type 'admin', admin_level 'super_admin',
//     scoped to the newly created school only.
//
// The request body NEVER carries a role.
// ============================================================================

export function normalizeEmail(e) {
  return (e || '').trim().toLowerCase();
}

// Join codes are shown with dashes and may be typed in any case with stray
// spaces — normalise both the input and the stored code before comparing.
export function normalizeJoinCode(raw) {
  return (raw || '').replace(/[\s-]+/g, '').toUpperCase();
}

// Role a school join code grants — resolved from the code RECORD, never the
// request. Codes can never grant admin.
export function roleFromCode(code) {
  const rt = code.role_type;
  if (rt === 'admin') {
    throw new Error('This code can no longer be used. Administrators are added by email invitation only.');
  }
  return rt === 'teacher' ? 'teacher' : 'student'; // 'student' and 'all' both resolve to student
}

// AuditLog entry for every role grant / role change: who granted it, to whom,
// by what mechanism, and when.
export async function logRoleGrant(svc, grant) {
  // grant: { record_id, school_id, granted_by_email, granted_by_name,
  //          granted_to_email, granted_to_name, role, old_role, mechanism, notes }
  try {
    await svc.entities.AuditLog.create({
      record_id: grant.record_id || 'role_grant',
      school_id: grant.school_id || 'unassigned',
      actor_email: grant.granted_by_email || 'system',
      actor_name: grant.granted_by_name || grant.granted_by_email || 'system',
      actor_role: 'admin',
      action: 'status_changed',
      old_status: grant.old_role || null,
      new_status: grant.role,
      notes: `ROLE GRANT — ${grant.granted_to_email} → ${grant.role}` +
        (grant.old_role ? ` (was ${grant.old_role})` : '') +
        ` via ${grant.mechanism}` +
        (grant.notes ? ` — ${grant.notes}` : ''),
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error('logRoleGrant failed:', e?.message || e);
  }
}

// Queue a teacher for admin approval. Idempotent: returns 'already_active' or
// 'already_pending' when a membership already exists, re-queues a rejected one,
// and creates the pending StaffMembership (with audit trail) otherwise.
export async function ensureTeacherMembership(svc, opts) {
  // opts: { user, profile, school, code, mechanism }
  const existing = await svc.entities.StaffMembership.filter({
    user_email: opts.user.email, school_id: opts.school.id,
  });
  if (existing.length > 0) {
    const mem = existing[0];
    if (mem.status === 'active') return 'already_active';
    if (mem.status === 'pending') return 'already_pending';
    // rejected — allow re-request
    await svc.entities.StaffMembership.update(mem.id, {
      status: 'pending',
      joined_via_code: opts.code || 'invitation',
      requested_at: new Date().toISOString(),
      reviewed_by: null,
      reviewed_at: null,
      rejection_reason: null,
    });
    return 'pending';
  }
  await svc.entities.StaffMembership.create({
    school_id: opts.school.id,
    school_name: opts.school.name,
    user_email: opts.user.email,
    user_id: opts.profile.id,
    teacher_name: `${opts.profile.first_name} ${opts.profile.last_name}`.trim(),
    role: 'TEACHER',
    class_ids: [],
    status: 'pending',
    joined_via_code: opts.code || opts.mechanism || 'invitation',
    requested_at: new Date().toISOString(),
  });
  await svc.entities.AuditLog.create({
    record_id: opts.profile.id,
    school_id: opts.school.id,
    actor_email: opts.user.email,
    actor_name: `${opts.profile.first_name} ${opts.profile.last_name}`.trim(),
    actor_role: 'teacher',
    action: 'join_request_submitted',
    new_status: 'pending',
    notes: `Teacher requested to join ${opts.school.name}${opts.code ? ` via code ${opts.code}` : ''}`,
    timestamp: new Date().toISOString(),
  });
  return 'pending';
}

// THE profile creation path. svc must be a service-role client.
export async function provisionProfile(svc, user, opts) {
  const existing = await svc.entities.UserProfile.filter({ user_email: user.email });
  if (existing.length > 0) return { profile: existing[0], already_exists: true };

  const fallbackParts = (user.full_name || user.email || 'User').trim().split(/\s+/);
  const first_name = (opts.first_name || fallbackParts[0] || 'User').trim();
  const last_name = (opts.last_name || fallbackParts.slice(1).join(' ') || '').trim();

  let grant = {
    role: 'pending',
    status: 'active',
    school_id: null,
    school: null,
    mechanism: 'self-signup (no school linked yet)',
    granted_by_email: user.email,
  };
  let teacher_membership = null;

  if (opts.invitation_token) {
    const invites = await svc.entities.SchoolInvitation.filter({ token: opts.invitation_token });
    const invitation = invites[0];
    if (!invitation) throw new Error('This invitation could not be found.');
    if (invitation.status === 'accepted') throw new Error('This invitation has already been used.');
    if (invitation.status === 'revoked') throw new Error('This invitation has been cancelled by the administrator.');
    if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
      throw new Error('This invitation has expired. Please ask your administrator to send a new one.');
    }
    if (normalizeEmail(invitation.invited_email) !== normalizeEmail(user.email)) {
      throw new Error(`This invitation belongs to ${invitation.invited_email}. Please sign in using the invited account.`);
    }
    const schools = await svc.entities.School.filter({ id: invitation.school_id });
    const school = schools[0];
    if (!school || school.status === 'suspended' || school.status === 'inactive') {
      throw new Error('This school is no longer available.');
    }
    grant = {
      role: invitation.role,
      status: 'active',
      school_id: school.id,
      school,
      mechanism: `email invitation from ${invitation.invited_by}`,
      granted_by_email: invitation.invited_by,
    };
  } else if (opts.join_code) {
    const normalized = normalizeJoinCode(opts.join_code);
    const codes = await svc.entities.SchoolCode.filter({ status: 'active' });
    const code = codes.find(c => normalizeJoinCode(c.code) === normalized);
    if (!code) throw new Error('Invalid school code. No school found with that code.');
    if (code.expires_at && new Date(code.expires_at) < new Date()) {
      throw new Error('This code has expired. Contact the school administrator.');
    }
    if (code.max_uses && (code.use_count || 0) >= code.max_uses) {
      throw new Error('This code has reached its usage limit.');
    }
    const role = roleFromCode(code); // teacher | student — never admin
    const schools = await svc.entities.School.filter({ id: code.school_id });
    const school = schools[0];
    if (!school) throw new Error('School no longer exists.');
    if (school.status !== 'active') throw new Error('This school is no longer active.');
    grant = {
      role,
      // Teachers joining with a code need admin approval before they get access.
      status: role === 'teacher' ? 'pending_approval' : 'active',
      // Students are linked immediately; teachers are scoped to the school only
      // after an admin approves their StaffMembership.
      school_id: role === 'student' ? school.id : null,
      school,
      mechanism: `school join code ${code.code}`,
      granted_by_email: code.created_by || user.email,
    };
  }

  const data = {
    user_email: user.email,
    user_type: grant.role,
    first_name,
    last_name,
    status: grant.status,
    total_achievement_points: 0,
    total_behaviour_points: 0,
  };
  if (grant.school_id) {
    data.school_id = grant.school_id;
    data.active_school_id = grant.school_id;
    if (grant.role === 'student' && grant.school && grant.school.admin_email) {
      data.admin_email = grant.school.admin_email;
    }
  }
  if (grant.role === 'admin') {
    data.admin_level = 'basic_admin';
    data.admin_permissions = defaultAdminPermissions('basic_admin');
  }

  const profile = await svc.entities.UserProfile.create(data);

  // Teachers joining via code are queued for admin approval immediately, so
  // the school's admins see the request as soon as the account exists.
  if (grant.role === 'teacher' && opts.join_code) {
    teacher_membership = await ensureTeacherMembership(svc, {
      user, profile, school: grant.school, code: opts.join_code,
      mechanism: 'school join code',
    });
  }

  // Audit every role grant (the 'pending' holding state is not a grant).
  if (grant.role !== 'pending') {
    await logRoleGrant(svc, {
      record_id: profile.id,
      school_id: grant.school_id,
      granted_by_email: grant.granted_by_email,
      granted_to_email: user.email,
      granted_to_name: `${first_name} ${last_name}`.trim(),
      role: grant.role,
      mechanism: grant.mechanism,
    });
  }

  return {
    profile,
    already_exists: false,
    role: grant.role,
    status: grant.status,
    school_id: grant.school_id,
    school_name: grant.school ? grant.school.name : null,
    mechanism: grant.mechanism,
    teacher_membership,
  };
}