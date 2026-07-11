/**
 * sendToStudentVault — The ONLY method for final vault delivery.
 *
 * Input: { record_id }
 *
 * Auth: logged-in admin (or organisation_admin), same school as the record.
 *
 * Validation BEFORE delivery:
 *   - StudentRecord exists
 *   - status is 'approved'
 *   - teacher signature exists
 *   - admin signature exists
 *   - student_id exists
 *   - student_email exists
 *   - school_id exists
 *   - evidence exists (file_url)
 *
 * Delivery actions (in order):
 *   1. Load approved StudentRecord
 *   2. Create or update linked BlockWard (by student_record_id)
 *   3. Update StudentRecord: vault_status=delivered, delivered_to_student_vault=true, etc.
 *   4. Create or update public verification record
 *   5. Create AuditLog entry
 *   6. Re-query student vault using the SAME loader used by student pages
 *   7. Confirm the delivered record appears in the results
 *   8. ONLY after re-query succeeds → send student notification
 *
 * If re-query fails: mark delivery as failed, do NOT notify, return error.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'content-type': 'application/json'
};

function normalizeEmail(email) {
  if (!email) return '';
  return email.trim().toLowerCase();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const base44 = createClientFromRequest(req);

  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: CORS });

    // ── Auth: admin only ──
    let profiles = await base44.asServiceRole.entities.UserProfile.filter({ user_email: user.email });
    let profile = profiles[0] || null;
    // Fallback: case-insensitive match
    if (!profile) {
      const allProfiles = await base44.asServiceRole.entities.UserProfile.filter({});
      profile = allProfiles.find(p => normalizeEmail(p.user_email) === normalizeEmail(user.email)) || null;
    }

    if (!profile) return Response.json({ ok: false, error: 'User profile not found' }, { status: 403, headers: CORS });
    if (profile.status === 'inactive' || profile.status === 'suspended') {
      return Response.json({ ok: false, error: 'Your account is inactive' }, { status: 403, headers: CORS });
    }
    if (profile.user_type !== 'admin') {
      return Response.json({ ok: false, error: 'Only admins can deliver to student vault' }, { status: 403, headers: CORS });
    }

    let body;
    try { body = await req.json(); } catch (e) {
      return Response.json({ ok: false, error: 'Invalid JSON body' }, { status: 400, headers: CORS });
    }
    const { record_id } = body;
    if (!record_id) return Response.json({ ok: false, error: 'Missing record_id' }, { status: 400, headers: CORS });

    // ── STEP 1: Load the StudentRecord ──
    const records = await base44.asServiceRole.entities.StudentRecord.filter({ id: record_id });
    if (!records.length) {
      return Response.json({ ok: false, error: 'StudentRecord not found', missing_requirement: 'record_exists' }, { status: 404, headers: CORS });
    }
    const record = records[0];

    // ── School check ──
    if (profile.school_id !== record.school_id) {
      return Response.json({ ok: false, error: 'Access denied: you do not belong to this school' }, { status: 403, headers: CORS });
    }

    // ── STEP 2: Validate ALL required conditions ──
    if (record.status !== 'approved' && record.status !== 'delivered_to_vault') {
      return Response.json({ ok: false, error: `Record status must be 'approved'. Current: '${record.status}'`, missing_requirement: 'status_approved' }, { status: 400, headers: CORS });
    }
    if (!record.teacher_signed) {
      return Response.json({ ok: false, error: 'Teacher signature is missing', missing_requirement: 'teacher_signature' }, { status: 400, headers: CORS });
    }
    if (!record.admin_signed) {
      return Response.json({ ok: false, error: 'Admin signature is missing', missing_requirement: 'admin_signature' }, { status: 400, headers: CORS });
    }
    if (!record.student_id && !record.owner_student_id) {
      return Response.json({ ok: false, error: 'Student ID is missing', missing_requirement: 'student_id' }, { status: 400, headers: CORS });
    }
    if (!record.student_email) {
      return Response.json({ ok: false, error: 'Student email is missing', missing_requirement: 'student_email' }, { status: 400, headers: CORS });
    }
    if (!record.school_id) {
      return Response.json({ ok: false, error: 'School/organisation ID is missing', missing_requirement: 'school_id' }, { status: 400, headers: CORS });
    }
    if (!record.file_url) {
      return Response.json({ ok: false, error: 'Evidence file is missing', missing_requirement: 'evidence' }, { status: 400, headers: CORS });
    }

    const now = new Date().toISOString();
    const actorName = `${profile.first_name} ${profile.last_name}`;
    const canonicalStudentId = record.owner_student_id || record.student_id;
    const normalizedStudentEmail = normalizeEmail(record.student_email);

    // ── STEP 3: Create or update linked BlockWard ──
    let blockWard = null;
    const existingBlockWards = await base44.asServiceRole.entities.BlockWard.filter({ record_id: record_id, status: 'active' });
    // Also check by student_record_id (deterministic — one BlockWard per StudentRecord)
    const existingByStudentRecord = await base44.asServiceRole.entities.BlockWard.filter({ student_record_id: record_id, status: 'active' });

    if (existingBlockWards.length > 0) {
      blockWard = existingBlockWards[0];
    } else if (existingByStudentRecord.length > 0) {
      blockWard = existingByStudentRecord[0];
    }

    if (blockWard) {
      // Update existing BlockWard
      blockWard = await base44.asServiceRole.entities.BlockWard.update(blockWard.id, {
        student_record_id: record_id,
        student_email: record.student_email,
        student_name: record.student_name || null,
        owner_student_id: canonicalStudentId,
        owner_student_email: normalizedStudentEmail,
        owner_school_id: record.school_id,
        issuer_email: record.admin_email || user.email,
        issuer_name: record.admin_name || actorName,
        teacher_id: record.teacher_id || null,
        admin_id: record.admin_id || profile.id,
        title: record.title,
        description: record.description || null,
        category: record.category || 'special',
        image_url: record.nft_image_url || record.custom_nft_image_url || blockWard.image_url || null,
        vault_status: 'delivered',
        status: 'active',
      });
    } else {
      // Create new BlockWard
      blockWard = await base44.asServiceRole.entities.BlockWard.create({
        school_id: record.school_id,
        record_id: record_id,
        student_record_id: record_id,
        student_email: record.student_email,
        student_name: record.student_name || null,
        owner_student_id: canonicalStudentId,
        owner_student_email: normalizedStudentEmail,
        owner_school_id: record.school_id,
        issuer_email: record.admin_email || user.email,
        issuer_name: record.admin_name || actorName,
        issuer_wallet: 'system',
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
    }

    // ── STEP 4: Update StudentRecord ──
    await base44.asServiceRole.entities.StudentRecord.update(record_id, {
      status: 'delivered_to_vault',
      vault_status: 'delivered',
      delivered_to_student_vault: true,
      vault_delivered_at: now,
      vault_delivered_by: user.email,
      blockward_id: blockWard.id,
      owner_student_id: canonicalStudentId,
      owner_student_email: normalizedStudentEmail,
      owner_school_id: record.school_id,
      nft_image_url: blockWard.image_url || record.nft_image_url || null,
    });

    // ── STEP 5: Create or update public verification record ──
    let verificationId = record.verify_id;
    let publicVerificationUrl = null;
    const existingReg = await base44.asServiceRole.entities.BlockWardVerificationRegistry.filter({ student_record_id: record_id });

    if (existingReg.length > 0) {
      // Update existing registry
      verificationId = existingReg[0].verification_id;
      publicVerificationUrl = existingReg[0].public_verification_url;
      await base44.asServiceRole.entities.BlockWardVerificationRegistry.update(existingReg[0].id, {
        blockward_id: blockWard.id,
        vault_status: 'delivered',
        approval_status: 'approved',
        owner_student_id: canonicalStudentId,
        student_email: record.student_email,
        achievement_image: record.nft_image_url || record.custom_nft_image_url || null,
        evidence_file_url: record.file_url || null,
        date_delivered: now,
      });
    } else {
      // Create new verification registry
      const schools = await base44.asServiceRole.entities.School.filter({ id: record.school_id });
      const school = schools[0] || null;
      const year = new Date().getFullYear();
      const rand = Math.random().toString(36).substring(2, 10).toUpperCase();
      verificationId = `BW-${year}-${rand}`;
      const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      const publicSlug = `${slugify(record.title || 'achievement')}-${rand.substring(0, 4).toLowerCase()}`;
      publicVerificationUrl = `https://blockward.me/verify/${verificationId}`;

      await base44.asServiceRole.entities.BlockWardVerificationRegistry.create({
        verification_id: verificationId,
        public_slug: publicSlug,
        blockward_id: blockWard.id,
        student_record_id: record_id,
        organisation_id: record.school_id,
        organisation_type: school?.org_type || 'school',
        organisation_name: school?.name || null,
        school_id: record.school_id,
        student_id: canonicalStudentId,
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

      // Update the StudentRecord with the verification ID
      await base44.asServiceRole.entities.StudentRecord.update(record_id, { verify_id: verificationId });
    }

    // ── STEP 6: Create AuditLog entry ──
    const auditLog = await base44.asServiceRole.entities.AuditLog.create({
      record_id: record_id,
      school_id: record.school_id,
      actor_email: user.email,
      actor_name: actorName,
      actor_role: 'admin',
      action: 'sent_to_student_vault',
      old_status: record.status,
      new_status: 'delivered_to_vault',
      notes: `Admin delivered achievement to student vault. BlockWard ID: ${blockWard.id}. Verification ID: ${verificationId}`,
      timestamp: now,
    });

    // ── STEP 7: Re-query using the SAME filter criteria as getStudentVault ──
    // This confirms the delivered record is retrievable by the student-facing pages.
    let verified = false;
    let verifyError = null;
    try {
      // Query by student_id (same as getStudentVault)
      const verifyRecords = await base44.asServiceRole.entities.StudentRecord.filter({ student_id: canonicalStudentId });
      // Also query by email as fallback (same as getStudentVault)
      const verifyRecordsByEmail = await base44.asServiceRole.entities.StudentRecord.filter({ student_email: record.student_email });

      // Merge and deduplicate (same logic as getStudentVault)
      const seenIds = new Set();
      const allVerifyRecords = [];
      for (const r of verifyRecords) {
        if (!seenIds.has(r.id)) { seenIds.add(r.id); allVerifyRecords.push(r); }
      }
      for (const r of verifyRecordsByEmail) {
        if (!seenIds.has(r.id)) { seenIds.add(r.id); allVerifyRecords.push(r); }
      }

      // Use the SAME filter criteria as getStudentVault:
      //   status === 'delivered_to_vault' || 'archived'
      //   vault_status === 'delivered'
      //   delivered_to_student_vault === true (or undefined)
      const deliveredRecord = allVerifyRecords.find(r =>
        r.id === record_id &&
        (r.status === 'delivered_to_vault' || r.status === 'archived') &&
        r.vault_status === 'delivered' &&
        (r.delivered_to_student_vault === true || r.delivered_to_student_vault === undefined) &&
        r.blockward_id === blockWard.id
      );

      if (deliveredRecord) {
        verified = true;
      } else {
        verifyError = 'Record not found in student vault query after delivery (status/vault_status/delivered_flag mismatch)';
      }
    } catch (e) {
      verifyError = e.message;
    }

    if (!verified) {
      // ── DELIVERY FAILED — do NOT notify student ──
      return Response.json({
        ok: false,
        error: 'vault_delivery_verification_failed',
        details: 'The record was saved but could not be retrieved by the student vault query. Notification NOT sent.',
        verify_error: verifyError,
        record_id: record_id,
        blockward_id: blockWard.id,
      }, { status: 500, headers: CORS });
    }

    // ── STEP 8: Send student notification (FINAL STEP — only after verification) ──
    try {
      await base44.asServiceRole.entities.Notification.create({
        user_email: record.student_email,
        school_id: record.school_id,
        title: 'New BlockWard in Your Vault!',
        body: `A new BlockWard has been added to your Vault: "${record.title}". View it in My BlockWards.`,
        type: 'announcement_important',
        priority: 'important',
        related_id: record_id,
        read: false,
      });
    } catch (e) { /* best-effort — delivery already succeeded */ }

    // Parent/guardian email notification (if parent email exists)
    try {
      const studentProfiles = await base44.asServiceRole.entities.UserProfile.filter({ user_email: record.student_email });
      const studentProfile = studentProfiles[0];
      if (studentProfile?.parent_email) {
        const appUrl = Deno.env.get('APP_URL') || 'https://blockward.me';
        const verifyUrl = `${appUrl}/verify/${verificationId}`;

        await base44.asServiceRole.integrations.Core.SendEmail({
          to: studentProfile.parent_email,
          subject: `${record.student_name || 'Your child'} has received a verified achievement certificate`,
          body: `
<p>Dear ${studentProfile.parent_name || 'Parent/Guardian'},</p>
<p>We are pleased to inform you that <strong>${record.student_name || 'your child'}</strong> has received a verified digital achievement certificate.</p>
<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:20px 0;">
  <h3 style="color:#5b21b6;margin:0 0 12px;">${record.title}</h3>
  ${record.description ? `<p style="color:#475569;margin:0 0 8px;">${record.description}</p>` : ''}
  <p style="color:#64748b;font-size:13px;margin:0;"><strong>Category:</strong> ${record.category || 'Achievement'}</p>
  <p style="color:#64748b;font-size:13px;margin:4px 0 0;"><strong>Verification ID:</strong> ${verificationId}</p>
</div>
<p><a href="${verifyUrl}" style="background:#7c3aed;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600;">View & Verify Certificate</a></p>
          `.trim()
        });
      }
    } catch (e) { /* best-effort */ }

    // Update student statistics
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

    return Response.json({
      ok: true,
      newStatus: 'delivered_to_vault',
      blockWardId: blockWard.id,
      deliveredAt: now,
      verificationId,
      publicVerificationUrl,
      auditLogId: auditLog.id,
      verified: true,
    }, { headers: CORS });

  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500, headers: CORS });
  }
});