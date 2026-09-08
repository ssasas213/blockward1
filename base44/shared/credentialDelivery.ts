// Minting path for approved student achievement requests. Mirrors the canonical
// staff-issued delivery (sendToStudentVault): creates the source-of-truth
// StudentRecord, the BlockWard and the public BlockWardVerificationRegistry
// entry — plus the student-requested provenance (student_requested + full
// signer chain). Idempotent: safe to retry if a step fails partway.
import { appUrl, buildSignerChain } from './achievementRequests.ts';
import { ensureTeamCredential, generateTeamSlug } from './teamCredentials.ts';

export async function mintRequestCredential(svc: any, request: any) {
  const now = new Date().toISOString();

  // Canonical terminal state is 'archived' ('minted' is the deprecated legacy
  // name kept only so pre-migration rows still match).
  if (request.status === 'minted' || request.status === 'archived') {
    return { ok: true, idempotent: true, blockWardId: request.blockward_id, verificationId: request.verification_id };
  }
  if (request.status !== 'approved') {
    return { ok: false, error: `Request status must be 'approved' to mint. Current: '${request.status}'` };
  }

  // ── Resolve the student's UserProfile (permanent owner) ──
  let studentProfile: any = null;
  try {
    const rows = await svc.entities.UserProfile.filter({ user_email: request.student_email });
    studentProfile = rows?.[0] || null;
  } catch (_) { /* best-effort */ }
  const studentId = studentProfile?.id || request.student_id;
  const evidenceFile = (request.evidence || []).find((e: any) => e.type === 'file');

  // ── 1. Source-of-truth StudentRecord (origin: student) ──
  let record: any = null;
  if (request.student_record_id) {
    try {
      const rows = await svc.entities.StudentRecord.filter({ id: request.student_record_id });
      record = rows?.[0] || null;
    } catch (_) { /* fall through to create */ }
  }
  if (!record) {
    record = await svc.entities.StudentRecord.create({
      school_id: request.school_id,
      student_id: studentId,
      student_email: request.student_email,
      student_name: request.student_name || null,
      owner_student_id: studentId,
      owner_student_email: request.student_email,
      owner_school_id: request.school_id,
      origin: 'student',
      teacher_id: request.nominated_verifier_id || null,
      teacher_email: request.nominated_verifier_email || null,
      teacher_name: request.nominated_verifier_name || null,
      teacher_signed: true,
      teacher_signed_at: request.verifier_signoff?.signed_at || null,
      admin_id: request.admin_signoff?.signer_id || null,
      admin_email: request.admin_signoff?.signer_email || null,
      admin_name: request.admin_signoff?.signer_name || null,
      admin_signed: !!request.admin_signoff,
      admin_signed_at: request.admin_signoff?.signed_at || null,
      title: request.title,
      category: request.category || 'special',
      description: request.description || null,
      date_achieved: request.date_achieved || null,
      file_url: evidenceFile?.url || null,
      submitted_at: request.submitted_at || null,
      approved_at: request.approved_at || now,
      status: 'approved',
    });
  }

  // ── 2. BlockWard (idempotent by student_record_id) ──
  const existingBws = await svc.entities.BlockWard.filter({ student_record_id: record.id, status: 'active' });
  const bwPayload: any = {
    student_record_id: record.id,
    student_email: request.student_email,
    student_name: request.student_name || null,
    owner_student_id: studentId,
    owner_student_email: request.student_email,
    owner_school_id: request.school_id,
    issuer_email: request.admin_signoff?.signer_email || request.nominated_verifier_email,
    issuer_name: request.admin_signoff?.signer_name || request.nominated_verifier_name,
    teacher_id: request.nominated_verifier_id || null,
    admin_id: request.admin_signoff?.signer_id || null,
    title: request.title,
    description: request.description || null,
    category: request.category || 'special',
    vault_status: 'delivered',
    status: 'active',
  };
  let blockWard: any;
  if (existingBws?.length) {
    blockWard = await svc.entities.BlockWard.update(existingBws[0].id, { ...bwPayload, record_id: record.id, school_id: request.school_id });
  } else {
    blockWard = await svc.entities.BlockWard.create({
      school_id: request.school_id,
      record_id: record.id,
      ...bwPayload,
      issuer_wallet: 'system',
      minted_at: now,
    });
  }

  // ── 3. Public verification registry (idempotent, with signer chain) ──
  const teamSlug = request.is_team ? generateTeamSlug(request.title) : null;
  let verificationId: string = request.verification_id || null;
  let publicVerificationUrl: string | null = null;
  const existingRegs = await svc.entities.BlockWardVerificationRegistry.filter({ student_record_id: record.id });
  if (existingRegs?.length) {
    verificationId = existingRegs[0].verification_id;
    publicVerificationUrl = existingRegs[0].public_verification_url;
    await svc.entities.BlockWardVerificationRegistry.update(existingRegs[0].id, {
      blockward_id: blockWard.id,
      student_requested: true,
      signer_chain: buildSignerChain(request),
      approval_status: 'approved',
      vault_status: 'delivered',
      evidence_file_url: evidenceFile?.url || existingRegs[0].evidence_file_url || null,
      date_delivered: now,
      ...(teamSlug ? {
        team_slug: existingRegs[0].team_slug || teamSlug,
        participant_role: existingRegs[0].participant_role || request.my_team_role || 'Member',
        is_team_credential: true,
      } : {}),
    });
  } else {
    const schools = await svc.entities.School.filter({ id: request.school_id });
    const school = schools?.[0] || null;
    const year = new Date().getFullYear();
    const rand = Math.random().toString(36).substring(2, 10).toUpperCase();
    verificationId = `BW-${year}-${rand}`;
    const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    publicVerificationUrl = `${appUrl()}/verify/${verificationId}`;

    await svc.entities.BlockWardVerificationRegistry.create({
      verification_id: verificationId,
      public_slug: `${slugify(request.title || 'achievement')}-${rand.substring(0, 4).toLowerCase()}`,
      blockward_id: blockWard.id,
      student_record_id: record.id,
      organisation_id: request.school_id,
      organisation_type: school?.org_type || 'school',
      organisation_name: school?.name || request.school_name || null,
      school_id: request.school_id,
      student_id: studentId,
      student_name: request.student_name || null,
      student_email: request.student_email,
      achievement_title: request.title,
      achievement_category: request.category || 'special',
      achievement_description: request.description || null,
      achievement_image: null,
      evidence_file_url: evidenceFile?.url || null,
      date_achieved: request.date_achieved || null,
      date_approved: request.approved_at || now,
      date_delivered: now,
      teacher_id: request.nominated_verifier_id || null,
      teacher_name: request.nominated_verifier_name || null,
      admin_id: request.admin_signoff?.signer_id || null,
      admin_name: request.admin_signoff?.signer_name || null,
      student_requested: true,
      signer_chain: buildSignerChain(request),
      approval_status: 'approved',
      vault_status: 'delivered',
      nft_status: 'pending',
      public_verification_url: publicVerificationUrl,
      is_public: true,
      // Age-derived safety default: under-16s' new credentials start link-only.
      visibility: studentProfile?.default_credential_visibility === 'link_only' ? 'link_only' : 'public',
      ...(teamSlug ? {
        team_slug: teamSlug,
        participant_role: request.my_team_role || 'Member',
        is_team_credential: true,
      } : {}),
    });
  }

  // ── 4. Commit the source record ──
  await svc.entities.StudentRecord.update(record.id, {
    status: 'delivered_to_vault',
    vault_status: 'delivered',
    delivered_to_student_vault: true,
    vault_delivered_at: now,
    blockward_id: blockWard.id,
    verify_id: verificationId,
  });

  // ── 5. Commit the request ──
  await svc.entities.AchievementRequest.update(request.id, {
    status: 'archived',
    minted_at: now,
    blockward_id: blockWard.id,
    verification_id: verificationId,
    student_record_id: record.id,
  });

  // ── 6. Team credential: shared group record + participant claim emails ──
  let team: any = null;
  if (request.is_team) {
    const tc = await ensureTeamCredential(svc, request, { teamSlug, verificationId, requesterProfile: studentProfile });
    team = tc.team || null;
  }

  return {
    ok: true,
    blockWardId: blockWard.id,
    verificationId,
    publicVerificationUrl,
    studentRecordId: record.id,
    teamSlug,
    team,
  };
}