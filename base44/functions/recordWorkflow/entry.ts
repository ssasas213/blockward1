/**
 * recordWorkflow — backend state machine for all StudentRecord transitions.
 *
 * Actions:
 *   submitRecord        draft → awaiting_admin_signature  (teacher only)
 *   adminSignRecord     awaiting_admin_signature → awaiting_student_signature | pending_drive_save  (admin only)
 *   adminRejectRecord   awaiting_admin_signature → rejected  (admin only)
 *   studentSignRecord   awaiting_student_signature → pending_drive_save  (student, own record only)
 *
 * Every action validates: auth, user active, school_id match, role, current status.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'content-type': 'application/json'
};

const VALID_TRANSITIONS = {
  submitRecord:       { fromStatus: 'draft',                      requiredRole: 'teacher' },
  adminSignRecord:    { fromStatus: 'awaiting_admin_signature',   requiredRole: 'admin' },
  adminRejectRecord:  { fromStatus: 'awaiting_admin_signature',   requiredRole: 'admin' },
  studentSignRecord:  { fromStatus: 'awaiting_student_signature', requiredRole: 'student' },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const base44 = createClientFromRequest(req);

  // --- Auth ---
  const user = await base44.auth.me();
  if (!user) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: CORS });

  // --- Load caller profile ---
  const profiles = await base44.asServiceRole.entities.UserProfile.filter({ user_email: user.email });
  const profile = profiles[0];
  if (!profile) return Response.json({ ok: false, error: 'User profile not found' }, { status: 403, headers: CORS });
  if (profile.status === 'inactive' || profile.status === 'suspended') {
    return Response.json({ ok: false, error: 'Your account is inactive. Contact your administrator.' }, { status: 403, headers: CORS });
  }

  const body = await req.json();
  const { action, recordId, signatureData, rejectionReason } = body;

  if (!action || !recordId) return Response.json({ ok: false, error: 'Missing action or recordId' }, { headers: CORS });

  const rule = VALID_TRANSITIONS[action];
  if (!rule) return Response.json({ ok: false, error: `Unknown action: ${action}` }, { headers: CORS });

  // --- Load record ---
  const records = await base44.asServiceRole.entities.StudentRecord.filter({ id: recordId });
  if (!records.length) return Response.json({ ok: false, error: 'Record not found' }, { status: 404, headers: CORS });
  const record = records[0];

  // --- School isolation ---
  if (profile.school_id !== record.school_id) {
    return Response.json({ ok: false, error: 'Access denied: wrong school' }, { status: 403, headers: CORS });
  }

  // --- Role check ---
  if (profile.user_type !== rule.requiredRole) {
    return Response.json({ ok: false, error: `Action '${action}' requires role '${rule.requiredRole}', you are '${profile.user_type}'` }, { status: 403, headers: CORS });
  }

  // --- Status check ---
  if (record.status !== rule.fromStatus) {
    return Response.json({ ok: false, error: `Cannot '${action}' a record with status '${record.status}'. Expected '${rule.fromStatus}'.` }, { status: 409, headers: CORS });
  }

  const now = new Date().toISOString();
  const actorName = `${profile.first_name} ${profile.last_name}`;

  // --- Execute action ---
  if (action === 'submitRecord') {
    // Teacher ownership check
    if (record.teacher_email !== user.email) {
      return Response.json({ ok: false, error: 'Only the creating teacher can submit this record' }, { status: 403, headers: CORS });
    }
    await base44.asServiceRole.entities.StudentRecord.update(recordId, {
      status: 'awaiting_admin_signature',
      submitted_at: now
    });
    await audit(base44, recordId, record.school_id, user.email, actorName, 'teacher', 'submitted', 'draft', 'awaiting_admin_signature', 'Submitted for admin review');
    return Response.json({ ok: true, newStatus: 'awaiting_admin_signature' }, { headers: CORS });
  }

  if (action === 'adminSignRecord') {
    if (!signatureData?.value) return Response.json({ ok: false, error: 'Missing signature data' }, { headers: CORS });
    if (record.admin_signed) return Response.json({ ok: false, error: 'Record already has an admin signature' }, { status: 409, headers: CORS });

    // Check no existing admin signature in DigitalSignature table
    const existingSigs = await base44.asServiceRole.entities.DigitalSignature.filter({ record_id: recordId, signer_role: 'admin' });
    if (existingSigs.length > 0) return Response.json({ ok: false, error: 'Admin signature already exists' }, { status: 409, headers: CORS });

    const sigRecord = await base44.asServiceRole.entities.DigitalSignature.create({
      record_id: recordId,
      school_id: record.school_id,
      signer_email: user.email,
      signer_name: actorName,
      signer_role: 'admin',
      signature_type: signatureData.type,
      signature_value: signatureData.value,
      signed_at: now
    });

    const newStatus = record.student_signed ? 'pending_drive_save' : 'awaiting_student_signature';
    await base44.asServiceRole.entities.StudentRecord.update(recordId, {
      admin_signed: true,
      admin_signature_id: sigRecord.id,
      admin_signed_at: now,
      admin_id: profile.id,
      admin_email: user.email,
      admin_name: actorName,
      status: newStatus
    });
    await audit(base44, recordId, record.school_id, user.email, actorName, 'admin', 'admin_signed', record.status, newStatus, 'Admin signature added');
    return Response.json({ ok: true, newStatus, signatureId: sigRecord.id }, { headers: CORS });
  }

  if (action === 'adminRejectRecord') {
    const reason = rejectionReason?.trim() || 'No reason provided';
    await base44.asServiceRole.entities.StudentRecord.update(recordId, {
      status: 'rejected',
      rejection_reason: reason
    });
    await audit(base44, recordId, record.school_id, user.email, actorName, 'admin', 'admin_rejected', 'awaiting_admin_signature', 'rejected', reason);
    return Response.json({ ok: true, newStatus: 'rejected' }, { headers: CORS });
  }

  if (action === 'studentSignRecord') {
    // Student can only sign their own record
    if (record.student_email !== user.email) {
      return Response.json({ ok: false, error: 'You can only sign your own records' }, { status: 403, headers: CORS });
    }
    if (record.student_signed) return Response.json({ ok: false, error: 'Record already has a student signature' }, { status: 409, headers: CORS });

    // Check no existing student signature
    const existingSigs = await base44.asServiceRole.entities.DigitalSignature.filter({ record_id: recordId, signer_role: 'student' });
    if (existingSigs.length > 0) return Response.json({ ok: false, error: 'Student signature already exists' }, { status: 409, headers: CORS });

    if (!signatureData?.value) return Response.json({ ok: false, error: 'Missing signature data' }, { headers: CORS });

    const sigRecord = await base44.asServiceRole.entities.DigitalSignature.create({
      record_id: recordId,
      school_id: record.school_id,
      signer_email: user.email,
      signer_name: actorName,
      signer_role: 'student',
      signature_type: signatureData.type,
      signature_value: signatureData.value,
      signed_at: now
    });

    const newStatus = record.admin_signed ? 'pending_drive_save' : 'awaiting_admin_signature';
    await base44.asServiceRole.entities.StudentRecord.update(recordId, {
      student_signed: true,
      student_signature_id: sigRecord.id,
      student_signed_at: now,
      status: newStatus
    });
    await audit(base44, recordId, record.school_id, user.email, actorName, 'student', 'student_signed', record.status, newStatus, 'Student signature added');
    return Response.json({ ok: true, newStatus, signatureId: sigRecord.id }, { headers: CORS });
  }

  return Response.json({ ok: false, error: 'Unhandled action' }, { headers: CORS });
});

async function audit(base44, recordId, schoolId, actorEmail, actorName, actorRole, action, oldStatus, newStatus, notes) {
  await base44.asServiceRole.entities.AuditLog.create({
    record_id: recordId,
    school_id: schoolId,
    actor_email: actorEmail,
    actor_name: actorName,
    actor_role: actorRole,
    action,
    old_status: oldStatus,
    new_status: newStatus,
    notes,
    timestamp: new Date().toISOString()
  });
}