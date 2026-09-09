import { sendResendEmail } from './resendEmail.ts';
import { normalizeEmail, logRoleGrant } from './profileProvisioning.ts';
import { findProfileByEmail } from './profileLookup.ts';

// ============================================================================
// staffApprovals — the single server-side implementation for reviewing
// pending StaffMembership records (teachers who joined with a staff code).
// Used by approveStaffMembership (the admin approval endpoint) and by
// approveJoinRequest's teacher branch (the legacy API shape).
//
// Behaviour contract:
//  - IDEMPOTENT: approving an already-active membership (or rejecting an
//    already-rejected one) is a silent no-op success — no double writes,
//    no duplicate emails, no duplicate audit entries.
//  - APPROVE: StaffMembership → active; the teacher's profile gets
//    user_type 'teacher', status 'active' and the school link — so their
//    next sign-in routes to TeacherDashboard.
//  - REJECT: StaffMembership → rejected (with reason); the account survives
//    as a school-less STUDENT — never deleted.
//  - Both outcomes write an AuditLog entry (approver, target, action,
//    reason, timestamp) and email the teacher.
// ============================================================================

function appUrl() {
  return Deno.env.get('APP_URL') || 'https://blockward.base44.app';
}

function escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const emailShell = (inner) =>
  `<div style="font-family:Inter,system-ui,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">${inner}</div>`;

// Pending staff join requests for one school, enriched with the profile data
// the teacher supplied at signup (department, subjects). RLS cannot serve
// pending teachers' profiles to school admins (the pending profile carries no
// school_id), so this runs service-role from the staffApprovalsData endpoint.
export async function listPendingStaff(svc, school_id) {
  const rows = await svc.entities.StaffMembership.filter({ school_id, status: 'pending' });
  const requests = [];
  for (const m of rows.sort((a, b) => new Date(a.requested_at || 0) - new Date(b.requested_at || 0))) {
    const profile = await findProfileByEmail(svc, m.user_email).catch(() => null);
    requests.push({
      id: m.id,
      teacher_name: m.teacher_name || m.user_email,
      user_email: m.user_email,
      joined_via: m.joined_via_code || null,
      requested_at: m.requested_at || null,
      last_reminder_at: m.last_reminder_at || null,
      department: profile?.department || null,
      subjects: profile?.subjects || [],
    });
  }
  return requests;
}

export async function reviewStaffMembership(svc, opts) {
  // opts: { membership_id?, membership?, action: 'approve' | 'reject',
  //         reason?, approver: { email, name }, school_id? (scope guard) }
  const action = opts.action;
  if (action !== 'approve' && action !== 'reject') {
    return { ok: false, status: 400, error: 'action must be "approve" or "reject"' };
  }

  let membership = opts.membership || null;
  if (!membership) {
    const rows = await svc.entities.StaffMembership.filter({ id: opts.membership_id });
    membership = rows[0] || null;
  }
  if (!membership) return { ok: false, status: 404, error: 'Membership not found' };

  if (opts.school_id && membership.school_id !== opts.school_id) {
    return { ok: false, status: 403, error: 'This request belongs to another school' };
  }

  const teacherName = membership.teacher_name || membership.user_email;
  const base = {
    teacher_name: teacherName,
    teacher_email: membership.user_email,
    school_name: membership.school_name,
  };

  // ── Idempotency: reaching the same outcome twice is a silent no-op ──
  if (action === 'approve' && membership.status === 'active') {
    return { ok: true, idempotent: true, action: 'approved', ...base };
  }
  if (action === 'reject' && membership.status === 'rejected') {
    return { ok: true, idempotent: true, action: 'rejected', ...base };
  }
  if (membership.status !== 'pending') {
    return { ok: false, status: 409, error: `Membership is already ${membership.status}` };
  }

  const now = new Date().toISOString();
  const reason = (opts.reason || '').trim();
  const approverName = opts.approver?.name || opts.approver?.email || 'an administrator';
  const joinedVia = membership.joined_via_code && membership.joined_via_code !== 'invitation'
    ? `staff code ${membership.joined_via_code}`
    : 'invitation';

  let profile = null;
  try { profile = await findProfileByEmail(svc, membership.user_email); } catch (e) { /* best-effort */ }

  let emailOut = { delivered: false, error: null };

  if (action === 'approve') {
    await svc.entities.StaffMembership.update(membership.id, {
      status: 'active',
      reviewed_by: opts.approver?.email || null,
      reviewed_at: now,
    });

    if (profile) {
      await svc.entities.UserProfile.update(profile.id, {
        user_type: 'teacher',
        status: 'active',
        school_id: membership.school_id,
        active_school_id: membership.school_id,
      });
    }

    await logRoleGrant(svc, {
      record_id: membership.id,
      school_id: membership.school_id,
      granted_by_email: opts.approver?.email || 'system',
      granted_by_name: approverName,
      granted_to_email: membership.user_email,
      granted_to_name: teacherName,
      role: 'teacher',
      old_role: 'teacher (pending approval)',
      mechanism: `admin approval of a ${joinedVia} request`,
    });

    const approveHtml = emailShell(`
      <p style="font-size:20px;font-weight:700;margin:0 0 16px;">You're approved</p>
      <p style="margin:0 0 12px;">Your request to join <strong>${escHtml(membership.school_name)}</strong> on BlockWard has been approved by ${escHtml(approverName)}.</p>
      <p style="margin:0 0 24px;">Sign in to access your Teacher Dashboard — classes, attendance, achievement sign-offs and points are all unlocked.</p>
      <p style="margin:0 0 24px;">
        <a href="${appUrl()}/TeacherDashboard" style="background:#7c3aed;color:#ffffff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600;display:inline-block;">Open BlockWard</a>
      </p>`);

    emailOut = await sendResendEmail(
      membership.user_email,
      `You're approved — ${membership.school_name} on BlockWard`,
      approveHtml,
    );

    try {
      await svc.entities.Notification.create({
        user_email: membership.user_email,
        school_id: membership.school_id,
        title: 'Teacher access approved',
        body: `Your request to join ${membership.school_name} has been approved. Sign in to access your Teacher Dashboard.`,
        type: 'announcement_important',
        priority: 'important',
        related_id: membership.id,
        read: false,
      });
    } catch (e) { /* best-effort */ }

    await svc.entities.AuditLog.create({
      record_id: membership.id,
      school_id: membership.school_id,
      actor_email: opts.approver?.email || 'system',
      actor_name: approverName,
      actor_role: 'admin',
      action: 'teacher_approved',
      old_status: 'pending',
      new_status: 'active',
      notes: `Teacher ${teacherName} <${membership.user_email}> approved by ${approverName} via ${joinedVia}. Email delivered: ${emailOut.delivered}${emailOut.error ? ` (${emailOut.error})` : ''}`,
      timestamp: now,
    });

    return { ok: true, action: 'approved', ...base, email_delivered: emailOut.delivered };
  }

  // ── Reject: the account survives as a school-less student ──
  await svc.entities.StaffMembership.update(membership.id, {
    status: 'rejected',
    rejection_reason: reason || 'Not specified',
    reviewed_by: opts.approver?.email || null,
    reviewed_at: now,
  });

  if (profile) {
    await svc.entities.UserProfile.update(profile.id, {
      user_type: 'student',
      status: 'active',
      school_id: null,
      active_school_id: null,
    });
  }

  const rejectHtml = emailShell(`
    <p style="font-size:20px;font-weight:700;margin:0 0 16px;">Your request wasn't approved</p>
    <p style="margin:0 0 12px;">Your request to join <strong>${escHtml(membership.school_name)}</strong> on BlockWard was not approved${reason ? ` — reason: ${escHtml(reason)}` : ''}.</p>
    <p style="margin:0 0 12px;">Your account stays active as a school-less student — nothing you've earned on BlockWard is affected.</p>
    <p style="color:#64748b;font-size:13px;margin:0;">You can ask the administrator to send you an email invitation instead, which skips this approval step.</p>`);

  emailOut = await sendResendEmail(
    membership.user_email,
    `Your request to join ${membership.school_name} on BlockWard`,
    rejectHtml,
  );

  try {
    await svc.entities.Notification.create({
      user_email: membership.user_email,
      school_id: membership.school_id,
      title: 'Teacher access update',
      body: `Your request to join ${membership.school_name} was not approved${reason ? ` — ${reason}` : ''}. Your account stays active as a school-less student.`,
      type: 'announcement_important',
      priority: 'important',
      related_id: membership.id,
      read: false,
    });
  } catch (e) { /* best-effort */ }

  await svc.entities.AuditLog.create({
    record_id: membership.id,
    school_id: membership.school_id,
    actor_email: opts.approver?.email || 'system',
    actor_name: approverName,
    actor_role: 'admin',
    action: 'teacher_rejected',
    old_status: 'pending',
    new_status: 'rejected',
    notes: `Teacher ${teacherName} <${membership.user_email}> rejected by ${approverName} via ${joinedVia}. Reason: ${reason || 'Not specified'}. Account kept as a school-less student. Email delivered: ${emailOut.delivered}${emailOut.error ? ` (${emailOut.error})` : ''}`,
    timestamp: now,
  });

  return { ok: true, action: 'rejected', ...base, email_delivered: emailOut.delivered };
}