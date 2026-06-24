/**
 * publicVerify — Public achievement verification endpoint.
 * Anyone can verify an achievement by its verification_id without logging in.
 *
 * Queries BlockWardVerificationRegistry (the permanent public registry).
 * Falls back to StudentRecord.verify_id for legacy records.
 *
 * Privacy: never returns student_email, private notes, internal user IDs,
 * or admin emails. Only public-safe fields are returned.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'content-type': 'application/json'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const base44 = createClientFromRequest(req);

  let body;
  try { body = await req.json(); } catch (e) {
    return Response.json({ ok: false, error: 'Invalid JSON body' }, { status: 400, headers: CORS });
  }

  const verification_id = body.verification_id || body.verify_id;
  if (!verification_id) return Response.json({ ok: false, error: 'Missing verification_id' }, { status: 400, headers: CORS });

  try {
    // 1. Try the new BlockWardVerificationRegistry
    let registryRecords = [];
    try {
      registryRecords = await base44.asServiceRole.entities.BlockWardVerificationRegistry.filter({ verification_id });
    } catch (e) { /* entity might not exist yet — fall through to legacy */ }

    if (registryRecords.length > 0) {
      const reg = registryRecords[0];

      if (!reg.is_public) {
        return Response.json({ ok: false, error: 'This achievement is not publicly available' }, { status: 403, headers: CORS });
      }

      if (reg.approval_status === 'revoked') {
        return Response.json({
          ok: true,
          isVerified: false,
          isRevoked: true,
          record: {
            verification_id: reg.verification_id,
            achievement_title: reg.achievement_title,
            student_name: reg.student_name,
            organisation_name: reg.organisation_name,
          },
          message: 'This achievement has been revoked and is no longer valid.'
        }, { headers: CORS });
      }

      // Fetch signatures for display
      let teacherSig = null, adminSig = null;
      try {
        const signatures = await base44.asServiceRole.entities.DigitalSignature.filter({ record_id: reg.student_record_id });
        teacherSig = signatures.find(s => s.signer_role === 'teacher') || null;
        adminSig = signatures.find(s => s.signer_role === 'admin') || null;
      } catch (e) { /* best-effort */ }

      return Response.json({
        ok: true,
        isVerified: true,
        source: 'registry',
        record: {
          verification_id: reg.verification_id,
          public_slug: reg.public_slug,
          achievement_title: reg.achievement_title,
          achievement_description: reg.achievement_description,
          achievement_category: reg.achievement_category,
          achievement_image: reg.achievement_image,
          evidence_file_url: reg.evidence_file_url,
          date_achieved: reg.date_achieved,
          date_approved: reg.date_approved,
          date_delivered: reg.date_delivered,
          student_name: reg.student_name,
          organisation_name: reg.organisation_name,
          organisation_type: reg.organisation_type,
          teacher_name: reg.teacher_name,
          admin_name: reg.admin_name,
          approval_status: reg.approval_status,
          vault_status: reg.vault_status,
          nft_status: reg.nft_status,
          blockchain_network: reg.blockchain_network,
          contract_address: reg.contract_address,
          token_id: reg.token_id,
          transaction_hash: reg.transaction_hash,
          certificate_url: reg.certificate_url,
          public_verification_url: reg.public_verification_url,
        },
        teacherSignature: teacherSig ? {
          signer_name: teacherSig.signer_name,
          signer_title: teacherSig.signer_title || null,
          signature_type: teacherSig.signature_type,
          signature_value: teacherSig.signature_value,
          signed_at: teacherSig.signed_at,
        } : null,
        adminSignature: adminSig ? {
          signer_name: adminSig.signer_name,
          signer_title: adminSig.signer_title || null,
          signature_type: adminSig.signature_type,
          signature_value: adminSig.signature_value,
          signed_at: adminSig.signed_at,
        } : null,
      }, { headers: CORS });
    }

    // 2. Fallback: legacy StudentRecord by verify_id (backward compat)
    const records = await base44.asServiceRole.entities.StudentRecord.filter({ verify_id: verification_id });
    if (!records.length) {
      return Response.json({ ok: false, error: 'Achievement not found' }, { status: 404, headers: CORS });
    }

    const record = records[0];
    const verifiedStatuses = ['delivered_to_vault', 'minted', 'archived'];
    if (!verifiedStatuses.includes(record.status)) {
      return Response.json({
        ok: true,
        isVerified: false,
        record: {
          achievement_title: record.title,
          student_name: record.student_name,
        },
        message: 'This achievement is still in the approval process.'
      }, { headers: CORS });
    }

    const [signatures, schools] = await Promise.all([
      base44.asServiceRole.entities.DigitalSignature.filter({ record_id: record.id }),
      base44.asServiceRole.entities.School.filter({ id: record.school_id }),
    ]);
    const school = schools[0] || null;
    const teacherSig = signatures.find(s => s.signer_role === 'teacher') || null;
    const adminSig = signatures.find(s => s.signer_role === 'admin') || null;

    return Response.json({
      ok: true,
      isVerified: true,
      source: 'legacy',
      record: {
        verification_id: record.verify_id,
        achievement_title: record.title,
        achievement_description: record.description || null,
        achievement_category: record.category,
        achievement_image: record.nft_image_url || null,
        evidence_file_url: record.file_url || null,
        date_achieved: record.date_achieved || null,
        date_approved: record.approved_at || null,
        date_delivered: record.vault_delivered_at || null,
        student_name: record.student_name,
        organisation_name: school?.name || null,
        organisation_type: school?.org_type || 'school',
        teacher_name: record.teacher_name || null,
        admin_name: record.admin_name || null,
        approval_status: 'approved',
        vault_status: record.vault_status,
        nft_status: record.nft_token_id ? 'minted' : 'pending',
        blockchain_network: record.nft_token_id ? (Deno.env.get('NETWORK') || 'sepolia') : null,
        contract_address: record.nft_token_id ? (Deno.env.get('CONTRACT_ADDRESS') || null) : null,
        token_id: record.nft_token_id || null,
        transaction_hash: record.nft_transaction_hash || null,
        certificate_url: record.certificate_url || null,
        public_verification_url: `https://blockward.me/verify/${record.verify_id}`,
      },
      teacherSignature: teacherSig ? {
        signer_name: teacherSig.signer_name,
        signer_title: teacherSig.signer_title || null,
        signature_type: teacherSig.signature_type,
        signature_value: teacherSig.signature_value,
        signed_at: teacherSig.signed_at,
      } : null,
      adminSignature: adminSig ? {
        signer_name: adminSig.signer_name,
        signer_title: adminSig.signer_title || null,
        signature_type: adminSig.signature_type,
        signature_value: adminSig.signature_value,
        signed_at: adminSig.signed_at,
      } : null,
    }, { headers: CORS });

  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500, headers: CORS });
  }
});