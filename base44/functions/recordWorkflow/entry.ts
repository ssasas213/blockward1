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
  sendToVault:          { fromStatus: 'approved',                    requiredRole: 'admin' },
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

  // --- teacherSubmitRecord: teacher creates and submits on behalf of student ---
  if (action === 'teacherSubmitRecord') {
    await base44.asServiceRole.entities.StudentRecord.update(recordId, {
      status: 'awaiting_teacher_signature',
      submitted_at: now,
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

  // --- sendToVault: admin explicitly delivers approved record to student vault ---
  // This is the FINAL step. Creates the BlockWard, links it to the StudentRecord,
  // and marks the record as 'delivered_to_vault'. The achievement then appears in
  // the student's My BlockWards, Portfolio Vault, My Achievements, and Dashboard.
  if (action === 'sendToVault') {
    // Safety checks — all required conditions must be met
    if (!record.teacher_signed) return Response.json({ ok: false, error: 'Cannot send to vault: teacher signature missing.' }, { status: 400, headers: CORS });
    if (!record.admin_signed) return Response.json({ ok: false, error: 'Cannot send to vault: admin signature missing.' }, { status: 400, headers: CORS });
    if (!record.file_url) return Response.json({ ok: false, error: 'Cannot send to vault: evidence missing.' }, { status: 400, headers: CORS });

    // Check if a BlockWard already exists for this record (idempotency)
    let existingBlockWard = null;
    try {
      const existing = await base44.asServiceRole.entities.BlockWard.filter({ record_id: recordId, status: 'active' });
      existingBlockWard = existing[0] || null;
    } catch (e) { /* ignore */ }

    let blockWard;
    if (existingBlockWard) {
      blockWard = existingBlockWard;
    } else {
      // Create BlockWard linked to the StudentRecord
      try {
        blockWard = await base44.asServiceRole.entities.BlockWard.create({
          school_id: record.school_id,
          record_id: recordId,
          student_record_id: recordId,
          student_email: record.student_email,
          student_name: record.student_name || null,
          owner_student_id: record.owner_student_id || record.student_id || null,
          owner_student_email: record.owner_student_email || record.student_email,
          owner_school_id: record.owner_school_id || record.school_id,
          issuer_email: record.admin_email || user.email,
          issuer_name: record.admin_name || actorName,
          teacher_id: record.teacher_id || null,
          admin_id: record.admin_id || profile.id,
          title: record.title,
          description: record.description || null,
          category: record.category || 'special',
          image_url: record.nft_image_url || record.custom_nft_image_url || null,
          minted_at: now,
          status: 'active',
          vault_status: 'delivered',
        });
      } catch (e) {
        return Response.json({ ok: false, error: 'Failed to create BlockWard: ' + e.message }, { status: 500, headers: CORS });
      }
    }

    // Update StudentRecord → 'delivered_to_vault'
    try {
      await base44.asServiceRole.entities.StudentRecord.update(recordId, {
        status: 'delivered_to_vault',
        vault_status: 'delivered',
        vault_delivered_at: now,
        vault_delivered_by: user.email,
        blockward_id: blockWard.id,
        nft_image_url: blockWard.image_url || record.nft_image_url || null,
      });
    } catch (e) {
      // Rollback BlockWard creation if it was newly created
      if (!existingBlockWard) {
        try { await base44.asServiceRole.entities.BlockWard.delete(blockWard.id); } catch (_) {}
      }
      return Response.json({ ok: false, error: 'Failed to deliver to vault: ' + e.message }, { status: 500, headers: CORS });
    }

    // Audit log: sent_to_student_vault
    try {
      await audit(base44, recordId, record.school_id, user.email, actorName, 'admin', 'sent_to_student_vault', 'approved', 'delivered_to_vault', `Admin delivered achievement to student vault. BlockWard ID: ${blockWard.id}`);
    } catch (e) { /* best-effort */ }

    // ── CREATE VERIFICATION REGISTRY RECORD ──
    // Permanent public verification record — powers /verify/{verification_id}
    let registryRecord = null;
    try {
      const schools = await base44.asServiceRole.entities.School.filter({ id: record.school_id });
      const school = schools[0] || null;
      const year = new Date().getFullYear();
      const rand = Math.random().toString(36).substring(2, 10).toUpperCase();
      const verificationId = `BW-${year}-${rand}`;
      const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      const publicSlug = `${slugify(record.title || 'achievement')}-${rand.substring(0, 4).toLowerCase()}`;
      const publicVerificationUrl = `https://blockward.me/verify/${verificationId}`;

      const existingReg = await base44.asServiceRole.entities.BlockWardVerificationRegistry.filter({ student_record_id: recordId });
      if (existingReg.length > 0) {
        registryRecord = existingReg[0];
      } else {
        registryRecord = await base44.asServiceRole.entities.BlockWardVerificationRegistry.create({
          verification_id: verificationId,
          public_slug: publicSlug,
          blockward_id: blockWard.id,
          student_record_id: recordId,
          organisation_id: record.school_id,
          organisation_type: school?.org_type || 'school',
          organisation_name: school?.name || null,
          school_id: record.school_id,
          student_id: record.owner_student_id || record.student_id || null,
          student_name: record.student_name || null,
          student_email: record.student_email,
          achievement_title: record.title,
          achievement_category: record.category || 'special',
          achievement_description: record.description || null,
          achievement_image: record.nft_image_url || record.custom_nft_image_url || null,
          evidence_file_url: record.file_url || null,
          date_achieved: record.date_achieved || null,
          date_approved: record.approved_at || null,
          date_delivered: now,
          teacher_id: record.teacher_id || null,
          teacher_name: record.teacher_name || null,
          teacher_signature_id: record.teacher_signature_id || null,
          admin_id: record.admin_id || profile.id,
          admin_name: record.admin_name || actorName,
          admin_signature_id: record.admin_signature_id || null,
          approval_status: 'approved',
          vault_status: 'delivered',
          nft_status: record.nft_token_id ? 'minted' : 'pending',
          blockchain_network: record.nft_token_id ? (Deno.env.get('NETWORK') || 'sepolia') : null,
          contract_address: record.nft_token_id ? (Deno.env.get('CONTRACT_ADDRESS') || null) : null,
          token_id: record.nft_token_id || null,
          transaction_hash: record.nft_transaction_hash || null,
          certificate_url: record.certificate_url || null,
          metadata_url: null,
          public_verification_url: publicVerificationUrl,
          is_public: true,
        });
        await base44.asServiceRole.entities.StudentRecord.update(recordId, { verify_id: verificationId });
      }
    } catch (e) { /* best-effort */ }

    // ── VERIFICATION: Confirm the data actually exists before notifying ──
    // The notification must be the LAST step. If the data is not readable
    // back (RLS, timing, or write failure), do NOT send the notification.
    let verified = false;
    try {
      const [verifyRecords, verifyBlockWards, verifyRegistry] = await Promise.all([
        base44.asServiceRole.entities.StudentRecord.filter({ id: recordId }),
        base44.asServiceRole.entities.BlockWard.filter({ record_id: recordId, status: 'active' }),
        base44.asServiceRole.entities.BlockWardVerificationRegistry.filter({ student_record_id: recordId }),
      ]);
      const vr = verifyRecords[0];
      verified = !!vr
        && vr.status === 'delivered_to_vault'
        && vr.vault_status === 'delivered'
        && vr.blockward_id === blockWard.id
        && verifyBlockWards.length > 0
        && verifyRegistry.length > 0;
    } catch (e) { /* verification failed — do not notify */ }

    if (!verified) {
      return Response.json({ ok: false, error: 'Vault delivery verification failed. Data not found after save. Notification NOT sent.' }, { status: 500, headers: CORS });
    }

    // Notify the student: "A new BlockWard has been added to your Vault."
    try {
      await base44.asServiceRole.entities.Notification.create({
        user_email: record.student_email,
        school_id: record.school_id,
        title: 'New BlockWard in Your Vault!',
        body: `A new BlockWard has been added to your Vault: "${record.title}". View it in My BlockWards.`,
        type: 'announcement_important',
        priority: 'important',
        related_id: recordId,
        read: false,
      });
    } catch (e) { /* best-effort */ }

    // Update student statistics (best-effort)
    if (record.points && record.points > 0) {
      try {
        const studentProfiles = await base44.asServiceRole.entities.UserProfile.filter({ user_email: record.student_email });
        if (studentProfiles.length > 0) {
          const sp = studentProfiles[0];
          const current = sp.total_achievement_points || 0;
          await base44.asServiceRole.entities.UserProfile.update(sp.id, {
            total_achievement_points: current + record.points,
          });
        }
      } catch (e) { /* best-effort */ }
    }

    return Response.json({ ok: true, newStatus: 'delivered_to_vault', blockWardId: blockWard.id, deliveredAt: now, verificationId: registryRecord?.verification_id || null, publicVerificationUrl: registryRecord?.public_verification_url || null }, { headers: CORS });
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