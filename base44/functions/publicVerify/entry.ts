/**
 * publicVerify — Public achievement verification endpoint (no login needed).
 *
 * PHASE 3: every response now carries an explicit `status`:
 *   valid | invalid | private | pending | revoked | superseded | hash_mismatch
 * and a `chain` object — the live on-chain confirmation of the credential's
 * content commitment (see shared/chainAnchor.ts):
 *   confirmed | confirmed_legacy | pending | failed | hash_mismatch |
 *   anchor_invalid | chain_unavailable
 *
 * A green "Blockchain Verified" state is ONLY ever derived from
 * chain.status === 'confirmed' (all six checks passed: network/chain id,
 * contract + credential/version reference, transaction receipt, matching
 * recalculated hash, issuer, current validity). Pending, failed or
 * unreachable checks NEVER verify — they render a clear status instead.
 * Anchors are on the Sepolia TESTNET; every chain payload is labelled testnet.
 *
 * Privacy: never returns student_email, private notes, internal user IDs, or
 * admin emails. Only public-safe fields are returned.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { verifyChainAnchor, getChainConfig } from '../../shared/chainAnchor.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'content-type': 'application/json'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const base44 = createClientFromRequest(req);
  const svc = base44.asServiceRole;

  let body;
  try { body = await req.json(); } catch (e) {
    return Response.json({ ok: false, error: 'Invalid JSON body' }, { status: 400, headers: CORS });
  }

  const verification_id = body.verification_id || body.verify_id;
  if (!verification_id) return Response.json({ ok: false, error: 'Missing verification_id' }, { status: 400, headers: CORS });

  try {
    // ── 1. The permanent public registry ──
    let registryRecords = [];
    try {
      registryRecords = await svc.entities.BlockWardVerificationRegistry.filter({ verification_id });
    } catch (e) { /* entity might not exist yet — fall through to legacy */ }

    if (registryRecords.length > 0) {
      const reg = registryRecords[0];

      // PRIVATE — its own clear message, distinct from not-found.
      if (!reg.is_public) {
        return Response.json({
          ok: true,
          status: 'private',
          isVerified: false,
          message: 'This credential exists, but its owner has made it private. Only they can share it.',
          record: { verification_id: reg.verification_id },
        }, { headers: CORS });
      }

      // Count this public verification check (best-effort — never blocks the check).
      try {
        await svc.entities.VerificationEvent.create({ verification_id: reg.verification_id, source: 'registry' });
      } catch (e) { /* metrics only */ }

      // REVOKED — no longer valid.
      if (reg.approval_status === 'revoked') {
        return Response.json({
          ok: true,
          status: 'revoked',
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

      // SUPERSEDED (safety — the registry normally points at the current
      // version; a superseded source record means a newer version exists).
      let srcRecord = null;
      try {
        const recRows = await svc.entities.StudentRecord.filter({ id: reg.student_record_id });
        srcRecord = recRows?.[0] || null;
      } catch (e) { /* best-effort */ }
      if (srcRecord && (srcRecord.status === 'superseded' || srcRecord.superseded_by_id)) {
        return Response.json({
          ok: true,
          status: 'superseded',
          isVerified: false,
          record: {
            verification_id: reg.verification_id,
            achievement_title: reg.achievement_title,
            student_name: reg.student_name,
            organisation_name: reg.organisation_name,
          },
          message: 'This credential has been corrected — a newer version exists on this same link.'
        }, { headers: CORS });
      }

      // Fetch signatures for display
      let teacherSig = null, adminSig = null;
      try {
        const signatures = await svc.entities.DigitalSignature.filter({ record_id: reg.student_record_id });
        teacherSig = signatures.find(s => s.signer_role === 'teacher') || null;
        adminSig = signatures.find(s => s.signer_role === 'admin') || null;
      } catch (e) { /* best-effort */ }

      // Earned profile badge next to the recipient's name — member/identity
      // tiers only, and only while its organisation stays verified.
      let student_badge = null;
      if (reg.student_id) {
        try {
          const prows = await svc.entities.UserProfile.filter({ id: reg.student_id });
          const p = prows[0];
          if (p && p.badge_tier && p.badge_tier !== 'none' && p.badge_org_id) {
            const srows = await svc.entities.School.filter({ id: p.badge_org_id });
            const borg = srows[0];
            if (borg && borg.verification_status === 'verified') {
              student_badge = { tier: p.badge_tier, org_name: borg.name, granted_at: p.badge_granted_at || null };
            }
          }
        } catch (e) { /* best-effort */ }
      }

      // Organisation admins of the issuing org may moderate the cover image
      // from this page — computed server-side, so no raw school IDs are exposed.
      let can_moderate = false;
      try {
        const viewer = await base44.auth.me();
        if (viewer) {
          const vrows = await svc.entities.UserProfile.filter({ user_email: viewer.email });
          const v = vrows?.[0];
          if (v?.user_type === 'admin' && v.school_id === reg.school_id) can_moderate = true;
        }
      } catch (e) { /* public page — the viewer may not be signed in */ }

      // Issuing organisation verification state (legacy orgs with no
      // verification_status field are treated as verified, per existing rule).
      let org_verified = null;
      if (reg.school_id || reg.organisation_id) {
        try {
          const srows = await svc.entities.School.filter({ id: reg.school_id || reg.organisation_id });
          const orgSchool = srows?.[0] || null;
          org_verified = orgSchool ? orgSchool.verification_status !== 'unverified' : null;
        } catch (e) { /* best-effort */ }
      }

      // ── Live on-chain confirmation of the content commitment ──
      let chain = null;
      try {
        chain = await verifyChainAnchor(svc, { ...reg });
      } catch (e) {
        chain = { status: 'chain_unavailable', reason: 'verification_error', testnet: true, network: 'sepolia' };
      }

      // HASH MISMATCH — the displayed content does not match the on-chain
      // commitment. NEVER shown as verified.
      const status = chain?.status === 'hash_mismatch' ? 'hash_mismatch' : 'valid';

      return Response.json({
        ok: true,
        status,
        isVerified: status === 'valid',
        source: 'registry',
        chain,
        org_verified,
        can_moderate,
        student_badge,
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
          student_requested: reg.student_requested === true,
          verification_mode: reg.verification_mode || 'organisation',
          independent_verifier: reg.independent_verifier || null,
          version: reg.version || 1,
          corrected_at: reg.corrected_at || null,
          correction_history: (reg.correction_history || []).map((c) => ({
            version: c.version,
            corrected_at: c.corrected_at,
            approved_by: c.approved_by || null,
            reason: c.reason || null,
            changes: (c.changes || []).map((ch) => ({
              field: ch.field,
              old_value: ch.old_value ?? null,
              new_value: ch.new_value ?? null,
            })),
          })),
          previous_anchor: reg.previous_anchor || null,
          signer_chain: (reg.signer_chain || []).map((s) => ({
            role: s.role,
            name: s.name,
            method: s.method,
            method_note: s.method_note || null,
            attestation: s.attestation === true,
            ip_country: s.ip_country || null,
            timestamp: s.timestamp,
          })),
          is_team_credential: reg.is_team_credential === true,
          participant_role: reg.participant_role || null,
          team_slug: reg.team_slug || null,
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

    // ── 2. Fallback: legacy StudentRecord by verify_id (backward compat) ──
    const records = await svc.entities.StudentRecord.filter({ verify_id: verification_id });
    if (!records.length) {
      return Response.json({ ok: false, status: 'invalid', error: 'Achievement not found' }, { status: 404, headers: CORS });
    }

    // Corrections create new versions under the same verify_id — prefer the
    // current (delivered) one; only superseded versions remaining = superseded.
    const verifiedStatuses = ['delivered_to_vault', 'archived'];
    const current = records.find(r => r.status !== 'superseded' && verifiedStatuses.includes(r.status));
    const record = current || records[0];
    const onlySuperseded = !current && records.every(r => r.status === 'superseded');

    try {
      await svc.entities.VerificationEvent.create({ verification_id: record.verify_id, source: 'legacy' });
    } catch (e) { /* metrics only */ }

    if (onlySuperseded) {
      return Response.json({
        ok: true,
        status: 'superseded',
        isVerified: false,
        record: {
          verification_id: record.verify_id,
          achievement_title: record.title,
          student_name: record.student_name,
        },
        message: 'This credential has been corrected — a newer version exists on this same link.'
      }, { headers: CORS });
    }

    // PENDING — still in the approval process.
    if (!verifiedStatuses.includes(record.status)) {
      return Response.json({
        ok: true,
        status: 'pending',
        isVerified: false,
        record: {
          achievement_title: record.title,
          student_name: record.student_name,
        },
        message: 'This achievement is still in the approval process.'
      }, { headers: CORS });
    }

    // REVOKED (legacy) — a revoked BlockWard invalidates the credential.
    let revoked = false;
    try {
      const bws = await svc.entities.BlockWard.filter({ student_record_id: record.id });
      revoked = (bws || []).some(bw => bw.status === 'revoked');
    } catch (e) { /* best-effort */ }
    if (revoked) {
      return Response.json({
        ok: true,
        status: 'revoked',
        isVerified: false,
        isRevoked: true,
        record: {
          verification_id: record.verify_id,
          achievement_title: record.title,
          student_name: record.student_name,
        },
        message: 'This achievement has been revoked and is no longer valid.'
      }, { headers: CORS });
    }

    const [signatures, schools] = await Promise.all([
      svc.entities.DigitalSignature.filter({ record_id: record.id }),
      svc.entities.School.filter({ id: record.school_id }),
    ]);
    const school = schools[0] || null;
    const teacherSig = signatures.find(s => s.signer_role === 'teacher') || null;
    const adminSig = signatures.find(s => s.signer_role === 'admin') || null;

    // Legacy orgs with no verification_status field are treated as verified.
    const org_verified = school ? school.verification_status !== 'unverified' : null;

    // Legacy anchors (minted before the V1 content-commitment format) —
    // receipt/contract/issuer/token are still confirmed live, but no content
    // commitment exists, so this can never show as fully "confirmed".
    let chain = { status: 'pending', network: 'sepolia', testnet: true };
    if (record.nft_token_id && record.nft_transaction_hash) {
      try {
        chain = await verifyChainAnchor(svc, {
          verification_id: record.verify_id,
          version: record.version || 1,
          achievement_title: record.title,
          achievement_category: record.category,
          achievement_description: record.description || null,
          date_achieved: record.date_achieved || null,
          token_id: record.nft_token_id,
          transaction_hash: record.nft_transaction_hash,
          contract_address: getChainConfig().contract,
          blockchain_network: Deno.env.get('NETWORK') || 'sepolia',
          credential_hash: null,
          chain_check: null,
        }, { noCache: true });
      } catch (e) {
        chain = { status: 'chain_unavailable', reason: 'verification_error', testnet: true, network: 'sepolia' };
      }
    }

    const status = chain?.status === 'hash_mismatch' ? 'hash_mismatch' : 'valid';

    return Response.json({
      ok: true,
      status,
      isVerified: status === 'valid',
      source: 'legacy',
      chain,
      org_verified,
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