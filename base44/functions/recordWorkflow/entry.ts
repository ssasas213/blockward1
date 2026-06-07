/**
 * recordWorkflow — backend state machine for Digital Achievement & NFT Approval System.
 *
 * Status flow:
 *   draft → submitted → awaiting_teacher_signature → awaiting_admin_signature → approved → minted → archived
 *
 * Actions:
 *   submitRecord         draft → awaiting_teacher_signature  (student, own record)
 *   teacherSignRecord    awaiting_teacher_signature → awaiting_admin_signature  (teacher)
 *   teacherRejectRecord  awaiting_teacher_signature → rejected  (teacher)
 *   adminSignRecord      awaiting_admin_signature → approved  (admin)
 *   adminRejectRecord    awaiting_admin_signature → rejected  (admin)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'content-type': 'application/json'
};

const VALID_TRANSITIONS = {
  submitRecord:         { fromStatus: 'draft',                       requiredRole: 'student' },
  teacherSignRecord:    { fromStatus: 'awaiting_teacher_signature',  requiredRole: 'teacher' },
  teacherRejectRecord:  { fromStatus: 'awaiting_teacher_signature',  requiredRole: 'teacher' },
  adminSignRecord:      { fromStatus: 'awaiting_admin_signature',    requiredRole: 'admin' },
  adminRejectRecord:    { fromStatus: 'awaiting_admin_signature',    requiredRole: 'admin' },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const base44 = createClientFromRequest(req);

  const user = await base44.auth.me();
  if (!user) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: CORS });

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

  const records = await base44.asServiceRole.entities.StudentRecord.filter({ id: recordId });
  if (!records.length) return Response.json({ ok: false, error: 'Record not found' }, { status: 404, headers: CORS });
  const record = records[0];

  if (profile.school_id !== record.school_id) {
    return Response.json({ ok: false, error: 'Access denied: wrong school' }, { status: 403, headers: CORS });
  }

  if (profile.user_type !== rule.requiredRole) {
    return Response.json({ ok: false, error: `Action '${action}' requires role '${rule.requiredRole}', you are '${profile.user_type}'` }, { status: 403, headers: CORS });
  }

  if (record.status !== rule.fromStatus) {
    return Response.json({ ok: false, error: `Cannot '${action}' a record with status '${record.status}'. Expected '${rule.fromStatus}'.` }, { status: 409, headers: CORS });
  }

  const now = new Date().toISOString();
  const actorName = `${profile.first_name} ${profile.last_name}`;

  // --- submitRecord: student submits their own achievement ---
  if (action === 'submitRecord') {
    if (record.student_email !== user.email) {
      return Response.json({ ok: false, error: 'You can only submit your own records' }, { status: 403, headers: CORS });
    }
    await base44.asServiceRole.entities.StudentRecord.update(recordId, {
      status: 'awaiting_teacher_signature',
      submitted_at: now
    });
    await audit(base44, recordId, record.school_id, user.email, actorName, 'student', 'submitted', 'draft', 'awaiting_teacher_signature', 'Student submitted achievement for teacher review');
    return Response.json({ ok: true, newStatus: 'awaiting_teacher_signature' }, { headers: CORS });
  }

  // --- teacherSignRecord: teacher endorses and signs ---
  if (action === 'teacherSignRecord') {
    if (!signatureData?.value) return Response.json({ ok: false, error: 'Missing signature data' }, { headers: CORS });
    if (record.teacher_signed) return Response.json({ ok: false, error: 'Record already has a teacher signature' }, { status: 409, headers: CORS });

    const sigRecord = await base44.asServiceRole.entities.DigitalSignature.create({
      record_id: recordId,
      school_id: record.school_id,
      signer_email: user.email,
      signer_name: actorName,
      signer_role: 'teacher',
      signature_type: signatureData.type,
      signature_value: signatureData.value,
      signed_at: now
    });

    await base44.asServiceRole.entities.StudentRecord.update(recordId, {
      teacher_signed: true,
      teacher_signature_id: sigRecord.id,
      teacher_signed_at: now,
      teacher_id: profile.id,
      teacher_email: user.email,
      teacher_name: actorName,
      status: 'awaiting_admin_signature'
    });
    await audit(base44, recordId, record.school_id, user.email, actorName, 'teacher', 'teacher_signed', 'awaiting_teacher_signature', 'awaiting_admin_signature', 'Teacher approved and signed');
    return Response.json({ ok: true, newStatus: 'awaiting_admin_signature', signatureId: sigRecord.id }, { headers: CORS });
  }

  // --- teacherRejectRecord ---
  if (action === 'teacherRejectRecord') {
    const reason = rejectionReason?.trim() || 'No reason provided';
    await base44.asServiceRole.entities.StudentRecord.update(recordId, {
      status: 'rejected',
      teacher_rejection_reason: reason
    });
    await audit(base44, recordId, record.school_id, user.email, actorName, 'teacher', 'admin_rejected', 'awaiting_teacher_signature', 'rejected', reason);
    return Response.json({ ok: true, newStatus: 'rejected' }, { headers: CORS });
  }

  // --- adminSignRecord: admin gives final approval ---
  if (action === 'adminSignRecord') {
    if (!signatureData?.value) return Response.json({ ok: false, error: 'Missing signature data' }, { headers: CORS });
    if (record.admin_signed) return Response.json({ ok: false, error: 'Record already has an admin signature' }, { status: 409, headers: CORS });

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

    // Generate a unique verify ID
    const verifyId = `${recordId.slice(-8)}-${Date.now().toString(36)}`;

    await base44.asServiceRole.entities.StudentRecord.update(recordId, {
      admin_signed: true,
      admin_signature_id: sigRecord.id,
      admin_signed_at: now,
      admin_id: profile.id,
      admin_email: user.email,
      admin_name: actorName,
      status: 'approved',
      approved_at: now,
      verify_id: verifyId
    });
    await audit(base44, recordId, record.school_id, user.email, actorName, 'admin', 'admin_signed', 'awaiting_admin_signature', 'approved', 'Admin approved and signed — ready to mint NFT');
    return Response.json({ ok: true, newStatus: 'approved', signatureId: sigRecord.id, verifyId }, { headers: CORS });
  }

  // --- adminRejectRecord ---
  if (action === 'adminRejectRecord') {
    const reason = rejectionReason?.trim() || 'No reason provided';
    await base44.asServiceRole.entities.StudentRecord.update(recordId, {
      status: 'rejected',
      rejection_reason: reason
    });
    await audit(base44, recordId, record.school_id, user.email, actorName, 'admin', 'admin_rejected', 'awaiting_admin_signature', 'rejected', reason);
    return Response.json({ ok: true, newStatus: 'rejected' }, { headers: CORS });
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