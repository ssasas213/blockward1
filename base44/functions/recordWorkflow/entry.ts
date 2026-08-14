/**
 * recordWorkflow — backend state machine for Digital Achievement & NFT Approval System.
 *
 * Status flow:
 *   draft → awaiting_teacher_signature → awaiting_admin_signature → approved → delivered_to_vault
 *
 * Actions:
 *   submitRecord         draft → awaiting_teacher_signature  (student, own record)
 *   teacherSubmitRecord  draft → awaiting_teacher_signature  (teacher, on behalf of student)
 *   teacherSignRecord    awaiting_teacher_signature → awaiting_admin_signature  (teacher)
 *   teacherRejectRecord  awaiting_teacher_signature → rejected  (teacher)
 *   adminSignRecord      awaiting_admin_signature → approved  (admin)
 *   adminRejectRecord    awaiting_admin_signature → rejected  (admin)
 *   sendToVault          approved → delivered_to_vault  (admin — explicit delivery to student vault)
 *
 * Signature identity:
 *   Teacher/admin signatures use the signer's SavedSignatureProfile (display_name, title, signature_value).
 *   signer_name is always the legal display_name from SignatureProfile, never the raw profile name.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { resolveEffectiveActor } from '../../shared/testMode.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'content-type': 'application/json'
};

const VALID_TRANSITIONS = {
  submitRecord:         { fromStatus: 'draft',                       requiredRole: 'student' },
  teacherSubmitRecord:  { fromStatus: 'draft',                       requiredRole: 'teacher' },
  teacherSignRecord:    { fromStatus: 'awaiting_teacher_signature',  requiredRole: 'teacher' },
  teacherRejectRecord:  { fromStatus: 'awaiting_teacher_signature',  requiredRole: 'teacher' },
  adminSignRecord:      { fromStatus: 'awaiting_admin_signature',    requiredRole: 'admin' },
  adminRejectRecord:    { fromStatus: 'awaiting_admin_signature',    requiredRole: 'admin' },
  // sendToVault is deprecated — use sendToStudentVault function instead.
  // Kept for backward compat: redirects to the sendToStudentVault logic.
  sendToVault:          { fromStatus: 'approved',                    requiredRole: 'admin' },
  // Admin requests changes instead of approving/rejecting.
  requestChanges:         { fromStatus: 'awaiting_admin_signature',  requiredRole: 'admin' },
  // Student or teacher edits + resubmits after changes were requested.
  resubmitAfterChanges:   { fromStatus: 'changes_requested',        requiredRole: 'student' },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const base44 = createClientFromRequest(req);

  const authUser = await base44.auth.me();
  if (!authUser) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: CORS });

  // Resolve the effective actor. In Test Mode this is the active test persona
  // (its own role/email/name/id), so workflow authorization follows the selected
  // persona, NOT the controller's admin role. The active persona is loaded
  // server-side from the controller's profile — never trusted from frontend input.
  const actor = await resolveEffectiveActor(base44);
  if (!actor.authorized) return Response.json({ ok: false, error: actor.reason || 'Unauthorized' }, { status: actor.status || 401, headers: CORS });

  // Map the actor onto the existing variable names so the state-machine logic below is unchanged.
  const user = { email: actor.actor_email, id: actor.controller_user_id };
  const profile = { id: actor.actor_id, user_type: actor.actor_role, school_id: actor.school_id, first_name: actor.first_name, last_name: actor.last_name, status: 'active' };

  let body;
  try { body = await req.json(); } catch (e) {
    return Response.json({ ok: false, error: 'Invalid JSON body' }, { status: 400, headers: CORS });
  }
  const { action, recordId, signatureData, rejectionReason } = body;

  if (!action || !recordId) return Response.json({ ok: false, error: 'Missing action or recordId' }, { status: 400, headers: CORS });

  const rule = VALID_TRANSITIONS[action];
  if (!rule) return Response.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400, headers: CORS });

  // Fetch record — return 404, never 500, on bad ID
  let record;
  try {
    const records = await base44.asServiceRole.entities.StudentRecord.filter({ id: recordId });
    if (!records.length) return Response.json({ ok: false, error: 'Record not found' }, { status: 404, headers: CORS });
    record = records[0];
  } catch (e) {
    return Response.json({ ok: false, error: 'Record not found' }, { status: 404, headers: CORS });
  }

  if (profile.school_id !== record.school_id) {
    return Response.json({ ok: false, error: 'Access denied: wrong school' }, { status: 403, headers: CORS });
  }

  // resubmitAfterChanges allows student OR teacher (the handler does its own
  // ownership validation), so it bypasses the strict single-role check.
  if (action !== 'resubmitAfterChanges' && profile.user_type !== rule.requiredRole) {
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
      submitted_at: now,
      origin: 'student'
    });
    await audit(base44, recordId, record.school_id, user.email, actorName, 'student', 'submitted', 'draft', 'awaiting_teacher_signature', 'Student submitted achievement for teacher review');
    return Response.json({ ok: true, newStatus: 'awaiting_teacher_signature' }, { headers: CORS });
  }

  // --- teacherSubmitRecord: teacher creates and submits on behalf of student ---
  if (action === 'teacherSubmitRecord') {
    await base44.asServiceRole.entities.StudentRecord.update(recordId, {
      status: 'awaiting_teacher_signature',
      submitted_at: now,
      origin: 'teacher',
      teacher_id: profile.id,
      teacher_email: user.email,
      teacher_name: actorName,
    });
    await audit(base44, recordId, record.school_id, user.email, actorName, 'teacher', 'submitted', 'draft', 'awaiting_teacher_signature', 'Teacher submitted achievement on behalf of student');
    return Response.json({ ok: true, newStatus: 'awaiting_teacher_signature' }, { headers: CORS });
  }

  // --- teacherSignRecord: teacher endorses and signs ---
  if (action === 'teacherSignRecord') {
    if (!signatureData?.value) return Response.json({ ok: false, error: 'Missing signature data' }, { status: 400, headers: CORS });
    if (record.teacher_signed) return Response.json({ ok: false, error: 'Record already has a teacher signature' }, { status: 409, headers: CORS });

    // Verify the signature profile belongs to the effective actor (Test Mode: persona).
    if (signatureData?.sig_profile_id) {
      const spRows = await base44.asServiceRole.entities.SignatureProfile.filter({ id: signatureData.sig_profile_id });
      const sp = spRows[0];
      if (!sp || sp.user_email !== user.email) {
        return Response.json({ ok: false, error: 'Signature profile does not belong to the current signer' }, { status: 403, headers: CORS });
      }
    }

    const sigDisplayName = signatureData.display_name || actorName;
    const sigTitle = signatureData.title || '';

    const sigRecord = await base44.asServiceRole.entities.DigitalSignature.create({
      record_id: recordId,
      school_id: record.school_id,
      signer_email: user.email,
      signer_name: sigDisplayName,
      signer_title: sigTitle,
      signer_role: 'teacher',
      signature_type: signatureData.type || 'typed',
      signature_value: signatureData.value,
      signed_at: now
    });

    await base44.asServiceRole.entities.StudentRecord.update(recordId, {
      teacher_signed: true,
      teacher_signature_id: sigRecord.id,
      teacher_signed_at: now,
      teacher_id: profile.id,
      teacher_email: user.email,
      teacher_name: sigDisplayName,
      status: 'awaiting_admin_signature'
    });
    await audit(base44, recordId, record.school_id, user.email, sigDisplayName, 'teacher', 'teacher_signed', 'awaiting_teacher_signature', 'awaiting_admin_signature', `Teacher signed: ${sigDisplayName}${sigTitle ? ` (${sigTitle})` : ''}`);
    return Response.json({ ok: true, newStatus: 'awaiting_admin_signature', signatureId: sigRecord.id }, { headers: CORS });
  }

  // --- teacherRejectRecord ---
  if (action === 'teacherRejectRecord') {
    const reason = rejectionReason?.trim() || 'No reason provided';
    await base44.asServiceRole.entities.StudentRecord.update(recordId, {
      status: 'rejected',
      teacher_rejection_reason: reason
    });
    await audit(base44, recordId, record.school_id, user.email, actorName, 'teacher', 'teacher_rejected', 'awaiting_teacher_signature', 'rejected', reason);
    return Response.json({ ok: true, newStatus: 'rejected' }, { headers: CORS });
  }

  // --- adminSignRecord: admin gives final approval → status 'approved' ---
  // The record is approved but NOT yet delivered to the student vault.
  // The admin must explicitly click "Send to Student Vault" (sendToVault action)
  // to create the BlockWard and deliver it to the student.
  if (action === 'adminSignRecord') {
    if (!signatureData?.value) return Response.json({ ok: false, error: 'Missing signature data' }, { status: 400, headers: CORS });
    if (record.admin_signed) return Response.json({ ok: false, error: 'Record already has an admin signature' }, { status: 409, headers: CORS });

    // Verify the signature profile belongs to the effective actor (Test Mode: persona).
    if (signatureData?.sig_profile_id) {
      const spRows = await base44.asServiceRole.entities.SignatureProfile.filter({ id: signatureData.sig_profile_id });
      const sp = spRows[0];
      if (!sp || sp.user_email !== user.email) {
        return Response.json({ ok: false, error: 'Signature profile does not belong to the current signer' }, { status: 403, headers: CORS });
      }
    }

    const sigDisplayName = signatureData.display_name || actorName;
    const sigTitle = signatureData.title || '';
    const verifyId = `${recordId.slice(-8)}-${Date.now().toString(36)}`;

    // STEP 1: Create admin digital signature
    let sigRecord;
    try {
      sigRecord = await base44.asServiceRole.entities.DigitalSignature.create({
        record_id: recordId,
        school_id: record.school_id,
        signer_email: user.email,
        signer_name: sigDisplayName,
        signer_title: sigTitle,
        signer_role: 'admin',
        signature_type: signatureData.type || 'typed',
        signature_value: signatureData.value,
        signed_at: now
      });
    } catch (e) {
      return Response.json({ ok: false, error: 'Failed to create admin signature: ' + e.message }, { status: 500, headers: CORS });
    }

    // STEP 2: Update StudentRecord → 'approved' (awaiting explicit vault delivery)
    try {
      await base44.asServiceRole.entities.StudentRecord.update(recordId, {
        admin_signed: true,
        admin_signature_id: sigRecord.id,
        admin_signed_at: now,
        admin_id: profile.id,
        admin_email: user.email,
        admin_name: sigDisplayName,
        status: 'approved',
        approved_at: now,
        verify_id: verifyId,
        vault_status: 'pending',
        // Ensure permanent ownership is anchored at approval time
        owner_student_id: record.owner_student_id || record.student_id || null,
        owner_student_email: record.owner_student_email || record.student_email,
        owner_school_id: record.owner_school_id || record.school_id,
      });
    } catch (e) {
      // Rollback step 1
      try { await base44.asServiceRole.entities.DigitalSignature.delete(sigRecord.id); } catch (_) {}
      return Response.json({ ok: false, error: 'Failed to approve record: ' + e.message }, { status: 500, headers: CORS });
    }

    // STEP 3: Audit log (best-effort)
    try {
      await audit(base44, recordId, record.school_id, user.email, sigDisplayName, 'admin', 'admin_signed', 'awaiting_admin_signature', 'approved', `Admin approved: ${sigDisplayName}${sigTitle ? ` (${sigTitle})` : ''}. Ready for vault delivery.`);
    } catch (e) { /* best-effort */ }

    // NOTE: No student notification at this stage.
    // The achievement is 'approved' but NOT yet in the student vault.
    // The student will be notified when the admin delivers it to the vault
    // (sendToVault action), at which point the data is verified to exist.

    return Response.json({ ok: true, newStatus: 'approved', signatureId: sigRecord.id, verifyId }, { headers: CORS });
  }

  // --- sendToVault: DEPRECATED — delegates to sendToStudentVault function ---
  // The frontend calls sendToStudentVault directly. This action is kept for
  // backward compatibility only — it delegates to the same function to avoid
  // duplicate BlockWard/verification/notification logic.
  if (action === 'sendToVault') {
    const result = await base44.functions.invoke('sendToStudentVault', { record_id: recordId });
    if (!result.data?.ok) {
      return Response.json({ ok: false, error: result.data?.error || 'Vault delivery failed' }, { status: 500, headers: CORS });
    }
    return Response.json({
      ok: true,
      newStatus: 'delivered_to_vault',
      blockWardId: result.data.blockWardId,
      deliveredAt: result.data.deliveredAt,
      verificationId: result.data.verificationId,
      publicVerificationUrl: result.data.publicVerificationUrl,
    }, { headers: CORS });
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

  // --- requestChanges: admin requests changes (awaiting_admin_signature → changes_requested) ---
  // The same record_id survives. The teacher's existing signature is preserved until
  // the content is actually edited on resubmission.
  if (action === 'requestChanges') {
    const reason = (rejectionReason || '').trim();
    if (!reason) return Response.json({ ok: false, error: 'A reason is required to request changes' }, { status: 400, headers: CORS });

    await base44.asServiceRole.entities.StudentRecord.update(recordId, {
      status: 'changes_requested',
      changes_requested_reason: reason,
      changes_requested_by: user.email,
      changes_requested_by_name: actorName,
      changes_requested_at: now,
    });
    await audit(base44, recordId, record.school_id, user.email, actorName, 'admin', 'changes_requested', 'awaiting_admin_signature', 'changes_requested', `Admin requested changes: ${reason}`);
    return Response.json({ ok: true, newStatus: 'changes_requested' }, { headers: CORS });
  }

  // --- resubmitAfterChanges: student or teacher edits + resubmits (changes_requested → …) ---
  // Protected fields (title/description/category/points/date/evidence) invalidate the
  // teacher's prior signature → record returns to awaiting_teacher_signature for re-sign.
  // Non-protected edits (e.g. teacher_notes) keep the signature → back to awaiting_admin_signature.
  if (action === 'resubmitAfterChanges') {
    if (profile.user_type !== 'student' && profile.user_type !== 'teacher') {
      return Response.json({ ok: false, error: 'Only students or teachers can resubmit after changes' }, { status: 403, headers: CORS });
    }
    // Origin-based ownership: the editor is determined by WHO ORIGINALLY SUBMITTED the
    // achievement, not just by who is assigned. This prevents unrelated students or
    // teachers from editing a record simply because its status is 'changes_requested'.
    //   origin 'student'  → only the owning student may edit
    //   origin 'teacher' → only the issuing teacher may edit
    // Legacy records without an origin fall back to the permissive student-own / teacher-assigned rule.
    const origin = record.origin;
    if (origin === 'student') {
      if (profile.user_type !== 'student' || record.student_email !== user.email) {
        return Response.json({ ok: false, error: 'This student-submitted achievement can only be edited by the student who owns it' }, { status: 403, headers: CORS });
      }
    } else if (origin === 'teacher') {
      if (profile.user_type !== 'teacher' || (record.teacher_email && record.teacher_email !== user.email)) {
        return Response.json({ ok: false, error: 'This teacher-issued achievement can only be edited by the issuing teacher' }, { status: 403, headers: CORS });
      }
    } else {
      // Legacy record (no origin) — keep the original permissive rule.
      if (profile.user_type === 'student' && record.student_email !== user.email) {
        return Response.json({ ok: false, error: 'You can only resubmit your own records' }, { status: 403, headers: CORS });
      }
      if (profile.user_type === 'teacher' && record.teacher_email && record.teacher_email !== user.email) {
        return Response.json({ ok: false, error: 'Only the assigned teacher can resubmit this record' }, { status: 403, headers: CORS });
      }
    }

    const updatedFields = body.updatedFields || {};
    const PROTECTED = ['title', 'description', 'category', 'points', 'date_achieved', 'file_url', 'file_type', 'certificate_url', 'custom_award_icon', 'custom_award_color', 'custom_nft_image_url'];
    const protectedChanged = PROTECTED.some(f => f in updatedFields && String(updatedFields[f] ?? '') !== String(record[f] ?? ''));

    const allowedFields = ['title', 'description', 'category', 'points', 'date_achieved', 'file_url', 'file_type', 'certificate_url', 'teacher_notes', 'custom_award_icon', 'custom_award_color', 'custom_nft_image_url'];
    const update = { resubmitted_at: now };
    for (const f of allowedFields) {
      if (f in updatedFields) update[f] = updatedFields[f];
    }

    let newStatus;
    if (protectedChanged) {
      update.teacher_signed = false;
      update.teacher_signature_id = null;
      update.teacher_signed_at = null;
      newStatus = 'awaiting_teacher_signature';
    } else {
      newStatus = 'awaiting_admin_signature';
    }
    update.status = newStatus;

    await base44.asServiceRole.entities.StudentRecord.update(recordId, update);
    const note = `Resubmitted by ${profile.user_type} (${actorName}). Teacher re-sign ${protectedChanged ? 'required (protected fields changed)' : 'not required'}. Returned to ${newStatus}.`;
    await audit(base44, recordId, record.school_id, user.email, actorName, profile.user_type, 'resubmitted_after_changes', 'changes_requested', newStatus, note);
    return Response.json({ ok: true, newStatus, teacherReSignRequired: protectedChanged }, { headers: CORS });
  }

  return Response.json({ ok: false, error: 'Unhandled action' }, { status: 400, headers: CORS });
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