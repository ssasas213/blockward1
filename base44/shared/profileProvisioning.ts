import { defaultAdminPermissions } from './adminPermissions.ts';
import { sendResendEmail } from './resendEmail.ts';

// ============================================================================
// profileProvisioning — the SINGLE server-side path for creating a UserProfile
// and for auditing every role grant. UserProfile create is locked to the
// service role, so this module is the only way a profile can come into
// existence. Role and school are derived ENTIRELY server-side:
//
//   - No code and no invitation  → user_type 'pending', no school_id.
//   - Join code                   → role read from the SchoolCode RECORD (teacher
//     or student only). Teachers start pending_approval, students join immediately.
//   - Invitation token            → role and school read from the SchoolInvitation
//     record, verified unused/unexpired, signed-in email must match.
//   - New school (setupSchool)    → user_type 'admin', admin_level 'super_admin',
//     scoped to the newly created school only.
//
// AGE HANDLING (compliance): when date_of_birth is provided, age is DERIVED
// here — never asked or trusted from the client:
//   - Under 13: a parent/guardian email is REQUIRED. The account is created
//     'awaiting_guardian_consent' and stays inactive until the guardian
//     consents via the emailed link (guardianConsentAction records the
//     timestamped consent event).
//   - Under 16: safe defaults — profile 'private', new credentials
//     'link_only'. The student can change both later.
//   - 16+: normal defaults.
//
// The request body NEVER carries a role, status or age.
// ============================================================================

export function normalizeEmail(e) {
  return (e || '').trim().toLowerCase();
}

function appUrl() {
  return Deno.env.get('APP_URL') || 'https://blockward.base44.app';
}

// Derive age in whole years from a yyyy-MM-dd date of birth. Returns null when
// the value is not a real, past date.
export function computeAge(dob) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob || '');
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  if (d.getTime() > todayUtc) return null; // future date
  let age = now.getFullYear() - +m[1];
  const beforeBirthday = now.getMonth() < +m[2] - 1 ||
    (now.getMonth() === +m[2] - 1 && now.getDate() < +m[3]);
  if (beforeBirthday) age--;
  return age;
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

function guardianEmailHtml(firstName, link) {
  return `<div style="font-family:Inter,system-ui,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
    <p style="font-size:20px;font-weight:700;margin:0 0 16px;">Confirm ${firstName}'s BlockWard account</p>
    <p style="margin:0 0 12px;">${firstName} used this email address to sign up for <strong>BlockWard</strong> — a platform where students collect verified school achievements that are permanently recorded.</p>
    <p style="margin:0 0 24px;">Because they are under 13, the account stays inactive until a parent or guardian consents. If you are ${firstName}'s parent or guardian, please confirm:</p>
    <p style="margin:0 0 24px;">
      <a href="${link}" style="background:#7c3aed;color:#ffffff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600;display:inline-block;">I consent to ${firstName} using BlockWard</a>
    </p>
    <p style="color:#64748b;font-size:13px;margin:0 0 8px;">If you did not expect this email, you can ignore it — nothing is activated without your confirmation.</p>
    <p style="color:#64748b;font-size:13px;margin:0;">Your consent is recorded with the date and time you confirm.</p>
  </div>`;
}

// THE profile creation path. svc must be a service-role client.
export async function provisionProfile(svc, user, opts) {
  const existing = await svc.entities.UserProfile.filter({ user_email: user.email });
  if (existing.length > 0) return { profile: existing[0], already_exists: true };

  const now = new Date().toISOString();
  const fallbackParts = (user.full_name || user.email || 'User').trim().split(/\s+/);
  const first_name = (opts.first_name || fallbackParts[0] || 'User').trim();
  const last_name = (opts.last_name || fallbackParts.slice(1).join(' ') || '').trim();

  // ── Age derivation (compliance) ──
  let age = null;
  if (opts.date_of_birth) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(opts.date_of_birth)) {
      throw new Error('Please enter a valid date of birth.');
    }
    age = computeAge(opts.date_of_birth);
    if (age === null || age > 120) throw new Error('Please enter a valid date of birth.');
  }

  // Under 13: guardian email REQUIRED — the account cannot activate without consent.
  let guardianEmail = null;
  let consentToken = null;
  if (age !== null && age < 13) {
    guardianEmail = normalizeEmail(opts.guardian_email);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(guardianEmail)) {
      throw new Error("Students under 13 need a parent or guardian's email address — we'll email them a consent link to activate the account.");
    }
    consentToken = crypto.randomUUID().replace(/-/g, '');
  }

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
    // Public portfolio ID exists from the moment the profile does, so shared
    // links never contain the internal profile id.
    portfolio_public_id: 'prt-' + Math.random().toString(36).substring(2, 10),
    total_achievement_points: 0,
    total_behaviour_points: 0,
  };

  // Under-13 consent gate overrides the normal status (a pending-approval
  // teacher becomes pending_approval again automatically when consent is
  // recorded — guardianConsentAction resolves the follow-on status).
  data.status = guardianEmail ? 'awaiting_guardian_consent' : grant.status;

  if (opts.date_of_birth) data.date_of_birth = opts.date_of_birth;

  // Under-16 safe defaults: private profile, link-only credentials.
  if (age !== null && age < 16) {
    data.profile_visibility = 'private';
    data.default_credential_visibility = 'link_only';
  }

  if (guardianEmail) {
    // The guardian email IS the parent contact field managed on the student
    // dashboard — one field, never a separate one.
    data.parent_email = guardianEmail;
    data.guardian_consent = {
      status: 'pending',
      guardian_email: guardianEmail,
      token: consentToken,
      requested_at: now,
      granted_at: null,
      granted_via: null,
    };
    data.guardian_consent_token = consentToken;
  }

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

  // Under-13: email the guardian the consent link. Delivery is best-effort —
  // the student can resend from the sign-in screen — but the request itself is
  // always audited.
  if (guardianEmail && consentToken) {
    const link = `${appUrl()}/guardian-consent/${consentToken}`;
    const mail = await sendResendEmail(
      guardianEmail,
      `Confirm ${first_name}'s BlockWard account`,
      guardianEmailHtml(first_name, link),
    );
    await svc.entities.AuditLog.create({
      record_id: profile.id,
      school_id: grant.school_id || 'unassigned',
      actor_email: user.email,
      actor_name: `${first_name} ${last_name}`.trim(),
      actor_role: 'system',
      action: 'guardian_consent_requested',
      old_status: null,
      new_status: 'awaiting_guardian_consent',
      notes: `Consent link emailed to ${guardianEmail} for under-13 account (derived age ${age}). Delivered: ${mail.delivered}${mail.error ? ' — ' + mail.error : ''}`,
      timestamp: now,
    });
  }

  return {
    profile,
    already_exists: false,
    role: grant.role,
    status: data.status,
    school_id: grant.school_id,
    school_name: grant.school ? grant.school.name : null,
    mechanism: grant.mechanism,
    teacher_membership,
    age,
    guardian_consent_pending: !!(guardianEmail && consentToken),
  };
}