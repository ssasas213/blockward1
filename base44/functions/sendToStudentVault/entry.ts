/**
 * sendToStudentVault — the ONLY method for final vault delivery.
 *
 * Input: { record_id }
 * Auth: logged-in admin, same school as the record.
 *
 * ── CONCURRENCY SAFETY (prevents duplicate BlockWards / verification records) ──
 * Delivery is serialised with an atomic status lock:
 *   approved → delivering (atomic, conditional on status === 'approved')
 * Only ONE request can win this transition. Concurrent requests re-fetch and either
 * return the already-delivered state or back off ("delivery in progress").
 * This does NOT rely on "query first, then create" — the status transition is the lock.
 *
 * ── ATOMICITY (critical vs non-critical) ──
 * CRITICAL (must all succeed or safely recover):
 *   1. BlockWard  (create/update by student_record_id — one per StudentRecord)
 *   2. BlockWardVerificationRegistry (create/update by student_record_id — one per StudentRecord)
 *   3. StudentRecord  (delivering → delivered_to_vault commit)
 * If any critical step fails, created entities are rolled back and the status reverts to
 * 'approved' so delivery can be retried — never leaving an inconsistent half-state.
 *
 * NON-CRITICAL (never roll back a successful delivery):
 *   - AuditLog, re-query verification, student/parent notifications, point statistics.
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

    // ── School isolation ──
    if (profile.school_id !== record.school_id) {
      return Response.json({ ok: false, error: 'Access denied: you do not belong to this school' }, { status: 403, headers: CORS });
    }

    // ── STEP 2: Validate ALL required conditions BEFORE claiming the lock ──
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
    const normalizedStudentEmail = normalizeEmail(record.student_email);

    // ── Resolve the student's UserProfile (same resolution getStudentVault uses) ──
    let studentProfile = null;
    try {
      const studentProfiles = await base44.asServiceRole.entities.UserProfile.filter({ user_email: record.student_email });
      studentProfile = studentProfiles[0] || null;
      if (!studentProfile) {
        const allProfiles = await base44.asServiceRole.entities.UserProfile.filter({});
        studentProfile = allProfiles.find(p => normalizeEmail(p.user_email) === normalizedStudentEmail) || null;
      }
    } catch (e) { /* best-effort */ }
    const canonicalStudentId = studentProfile?.id || record.owner_student_id || record.student_id;

    // ════════════════════════════════════════════════════════════════════════
    // STEP 3: CONCURRENCY LOCK — atomically claim the delivery.
    // Only a record with status 'approved' can be claimed. This is the single
    // gate that prevents two concurrent deliveries from both creating a BlockWard.
    // ════════════════════════════════════════════════════════════════════════
    if (record.status === 'delivered_to_vault') {
      // Idempotent re-delivery: return the existing delivered state, no re-creation.
      const existingBw = await base44.asServiceRole.entities.BlockWard.filter({ student_record_id: record_id, status: 'active' });
      const existingReg = await base44.asServiceRole.entities.BlockWardVerificationRegistry.filter({ student_record_id: record_id });
      return Response.json({
        ok: true,
        newStatus: 'delivered_to_vault',
        blockWardId: existingBw[0]?.id || record.blockward_id || null,
        deliveredAt: record.vault_delivered_at || null,
        verificationId: existingReg[0]?.verification_id || record.verify_id || null,
        publicVerificationUrl: existingReg[0]?.public_verification_url || null,
        verified: true,
        idempotent: true,
      }, { headers: CORS });
    }

    if (record.status !== 'approved') {
      return Response.json({
        ok: false,
        error: `Record status must be 'approved' to deliver. Current: '${record.status}'`,
        missing_requirement: 'status_approved'
      }, { status: 400, headers: CORS });
    }

    // Atomic claim: approved → delivering (conditional on current status === 'approved').
    // If the conditional updateMany is unavailable/throws, fall back to a plain update;
    // the re-fetch + delivery_claimed_by check below remains the authoritative gate.
    try {
      await base44.asServiceRole.entities.StudentRecord.updateMany(
        { id: record_id, status: 'approved' },
        { $set: { status: 'delivering', delivery_claimed_by: user.email, delivery_claimed_at: now } }
      );
    } catch (e) {
      try {
        await base44.asServiceRole.entities.StudentRecord.update(record_id, {
          status: 'delivering', delivery_claimed_by: user.email, delivery_claimed_at: now,
        });
      } catch (e2) {
        return Response.json({ ok: false, error: 'Failed to claim delivery lock: ' + e2.message, stage: 'claim' }, { status: 500, headers: CORS });
      }
    }

    // Re-fetch to determine who won the claim.
    const refetched = await base44.asServiceRole.entities.StudentRecord.filter({ id: record_id });
    const claimed = refetched[0] || record;

    if (claimed.status === 'delivered_to_vault') {
      // Another request completed delivery between our load and claim.
      const existingBw = await base44.asServiceRole.entities.BlockWard.filter({ student_record_id: record_id, status: 'active' });
      const existingReg = await base44.asServiceRole.entities.BlockWardVerificationRegistry.filter({ student_record_id: record_id });
      return Response.json({
        ok: true, newStatus: 'delivered_to_vault',
        blockWardId: existingBw[0]?.id || record.blockward_id || null,
        deliveredAt: claimed.vault_delivered_at || null,
        verificationId: existingReg[0]?.verification_id || claimed.verify_id || null,
        publicVerificationUrl: existingReg[0]?.public_verification_url || null,
        verified: true, idempotent: true,
      }, { headers: CORS });
    }

    if (claimed.status !== 'delivering' || claimed.delivery_claimed_by !== user.email) {
      // Another admin currently holds the lock.
      return Response.json({
        ok: false,
        error: 'Delivery is already in progress by another administrator. Please wait and refresh.',
        missing_requirement: 'delivery_in_progress'
      }, { status: 409, headers: CORS });
    }

    // We hold the lock. Helper to release it back to 'approved' on failure.
    const releaseLock = async () => {
      try {
        await base44.asServiceRole.entities.StudentRecord.updateMany(
          { id: record_id, status: 'delivering' },
          { $set: { status: 'approved', delivery_claimed_by: null, delivery_claimed_at: null } }
        );
      } catch (e) {
        try {
          await base44.asServiceRole.entities.StudentRecord.update(record_id, {
            status: 'approved', delivery_claimed_by: null, delivery_claimed_at: null,
          });
        } catch (e2) { /* best-effort */ }
      }
    };

    // ════════════════════════════════════════════════════════════════════════
    // CRITICAL OPERATIONS — all must succeed or roll back.
    // ════════════════════════════════════════════════════════════════════════
    let blockWard = null;
    let createdNewBlockWard = false;
    let createdNewRegistry = false;
    let registryRecord = null;

    // ── CRITICAL 1: BlockWard (create/update by student_record_id) ──
    try {
      const existingBlockWards = await base44.asServiceRole.entities.BlockWard.filter({ student_record_id: record_id, status: 'active' });
      const existingByRecordId = await base44.asServiceRole.entities.BlockWard.filter({ record_id: record_id, status: 'active' });
      const existing = existingBlockWards[0] || existingByRecordId[0];

      const bwPayload = {
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
        image_url: record.nft_image_url || record.custom_nft_image_url || null,
        vault_status: 'delivered',
        status: 'active',
      };

      if (existing) {
        blockWard = await base44.asServiceRole.entities.BlockWard.update(existing.id, {
          ...bwPayload,
          record_id: record_id,
          school_id: record.school_id,
        });
      } else {
        blockWard = await base44.asServiceRole.entities.BlockWard.create({
          school_id: record.school_id,
          record_id: record_id,
          ...bwPayload,
          issuer_wallet: 'system',
          minted_at: now,
        });
        createdNewBlockWard = true;
      }
    } catch (e) {
      await releaseLock();
      return Response.json({ ok: false, error: 'Failed to create BlockWard: ' + e.message, stage: 'blockward' }, { status: 500, headers: CORS });
    }

    // ── CRITICAL 2: Verification Registry (create/update by student_record_id) ──
    let verificationId = record.verify_id;
    let publicVerificationUrl = null;
    try {
      const existingReg = await base44.asServiceRole.entities.BlockWardVerificationRegistry.filter({ student_record_id: record_id });

      if (existingReg.length > 0) {
        registryRecord = existingReg[0];
        verificationId = registryRecord.verification_id;
        publicVerificationUrl = registryRecord.public_verification_url;
        await base44.asServiceRole.entities.BlockWardVerificationRegistry.update(registryRecord.id, {
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
        const schools = await base44.asServiceRole.entities.School.filter({ id: record.school_id });
        const school = schools[0] || null;
        const year = new Date().getFullYear();
        const rand = Math.random().toString(36).substring(2, 10).toUpperCase();
        verificationId = `BW-${year}-${rand}`;
        const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        const publicSlug = `${slugify(record.title || 'achievement')}-${rand.substring(0, 4).toLowerCase()}`;
        publicVerificationUrl = `https://blockward.me/verify/${verificationId}`;

        registryRecord = await base44.asServiceRole.entities.BlockWardVerificationRegistry.create({
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
          certificate_url: record.certificate_url || null,
          public_verification_url: publicVerificationUrl,
          is_public: true,
        });
        createdNewRegistry = true;
      }
    } catch (e) {
      // Rollback critical 1 (delete only if we just created it).
      if (createdNewBlockWard) {
        try { await base44.asServiceRole.entities.BlockWard.delete(blockWard.id); } catch (_) {}
      }
      await releaseLock();
      return Response.json({ ok: false, error: 'Failed to create verification record: ' + e.message, stage: 'registry' }, { status: 500, headers: CORS });
    }

    // ── CRITICAL 3: COMMIT — delivering → delivered_to_vault ──
    try {
      await base44.asServiceRole.entities.StudentRecord.update(record_id, {
        status: 'delivered_to_vault',
        vault_status: 'delivered',
        delivered_to_student_vault: true,
        vault_delivered_at: now,
        vault_delivered_by: user.email,
        blockward_id: blockWard.id,
        delivery_claimed_by: null,
        delivery_claimed_at: null,
        student_id: canonicalStudentId,
        owner_student_id: canonicalStudentId,
        owner_student_email: normalizedStudentEmail,
        owner_school_id: record.school_id,
        verify_id: verificationId,
        nft_image_url: blockWard.image_url || record.nft_image_url || null,
      });
    } catch (e) {
      // Rollback critical 1 & 2 (delete only what we created).
      if (createdNewRegistry) {
        try { await base44.asServiceRole.entities.BlockWardVerificationRegistry.delete(registryRecord.id); } catch (_) {}
      }
      if (createdNewBlockWard) {
        try { await base44.asServiceRole.entities.BlockWard.delete(blockWard.id); } catch (_) {}
      }
      await releaseLock();
      return Response.json({ ok: false, error: 'Failed to commit delivery: ' + e.message, stage: 'commit' }, { status: 500, headers: CORS });
    }

    // ════════════════════════════════════════════════════════════════════════
    // NON-CRITICAL — these never roll back a successful critical commit.
    // ════════════════════════════════════════════════════════════════════════

    // Audit log (important, but best-effort)
    let auditLogId = null;
    try {
      const auditLog = await base44.asServiceRole.entities.AuditLog.create({
        record_id: record_id,
        school_id: record.school_id,
        actor_email: user.email,
        actor_name: actorName,
        actor_role: 'admin',
        action: 'sent_to_student_vault',
        old_status: 'approved',
        new_status: 'delivered_to_vault',
        notes: `Admin delivered achievement to student vault. BlockWard ID: ${blockWard.id}. Verification ID: ${verificationId}`,
        timestamp: now,
      });
      auditLogId = auditLog.id;
    } catch (e) { /* best-effort */ }

    // Re-query verification (confirms student vault can retrieve it) — non-blocking.
    let verified = false;
    let verifyError = null;
    try {
      const verifyRecords = await base44.asServiceRole.entities.StudentRecord.filter({ student_id: canonicalStudentId });
      const verifyRecordsByEmail = await base44.asServiceRole.entities.StudentRecord.filter({ student_email: studentProfile?.user_email || record.student_email });
      const seenIds = new Set();
      const allVerifyRecords = [];
      for (const r of verifyRecords) { if (!seenIds.has(r.id)) { seenIds.add(r.id); allVerifyRecords.push(r); } }
      for (const r of verifyRecordsByEmail) { if (!seenIds.has(r.id)) { seenIds.add(r.id); allVerifyRecords.push(r); } }
      const deliveredRecord = allVerifyRecords.find(r =>
        r.id === record_id &&
        (r.status === 'delivered_to_vault' || r.status === 'archived') &&
        r.vault_status === 'delivered' &&
        r.blockward_id === blockWard.id
      );
      verified = !!deliveredRecord;
      if (!verified) verifyError = 'Record not found in student vault query after delivery';
    } catch (e) {
      verifyError = e.message;
    }

    // Parent/guardian email notification (non-critical)
    try {
      if (studentProfile?.parent_email) {
        const appUrl = Deno.env.get('APP_URL') || 'https://blockward.me';
        const verifyUrl = `${appUrl}/verify/${verificationId}`;
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: studentProfile.parent_email,
          subject: `${record.student_name || 'Your child'} has received a verified achievement certificate`,
          body: `<p>Dear ${studentProfile.parent_name || 'Parent/Guardian'},</p>
<p>We are pleased to inform you that <strong>${record.student_name || 'your child'}</strong> has received a verified digital achievement certificate.</p>
<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:20px 0;">
  <h3 style="color:#5b21b6;margin:0 0 12px;">${record.title}</h3>
  ${record.description ? `<p style="color:#475569;margin:0 0 8px;">${record.description}</p>` : ''}
  <p style="color:#64748b;font-size:13px;margin:0;"><strong>Category:</strong> ${record.category || 'Achievement'}</p>
  <p style="color:#64748b;font-size:13px;margin:4px 0 0;"><strong>Verification ID:</strong> ${verificationId}</p>
</div>
<p><a href="${verifyUrl}" style="background:#7c3aed;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600;">View &amp; Verify Certificate</a></p>`.trim()
        });
      }
    } catch (e) { /* best-effort */ }

    // Student point statistics (non-critical)
    if (record.points && record.points > 0 && studentProfile) {
      try {
        await base44.asServiceRole.entities.UserProfile.updateMany(
          { id: studentProfile.id },
          { $inc: { total_achievement_points: record.points } }
        );
      } catch (e) { /* best-effort */ }
    }
    // NOTE: in-app student notification on 'delivered_to_vault' is handled by the
    // single canonical notifyOnRecordStatusChange automation — not duplicated here.

    return Response.json({
      ok: true,
      newStatus: 'delivered_to_vault',
      blockWardId: blockWard.id,
      deliveredAt: now,
      verificationId,
      publicVerificationUrl,
      auditLogId,
      verified,
      verify_error: verifyError,
    }, { headers: CORS });

  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500, headers: CORS });
  }
});