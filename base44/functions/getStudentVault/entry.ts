/**
 * getStudentVault — Shared student vault loader.
 *
 * This is the SINGLE source of truth for all student-facing pages:
 *   - Student Dashboard
 *   - My BlockWards
 *   - My Achievements (StudentMyRecords — delivered portion)
 *   - Portfolio Vault
 *
 * Identity resolution:
 *   1. Get auth user email
 *   2. Look up UserProfile by email (case-insensitive, trimmed)
 *   3. Use UserProfile.id as the canonical student_id
 *   4. Query StudentRecords by student_id (primary) OR student_email (fallback)
 *
 * Returns only records that have been DELIVERED to the student vault:
 *   - status === 'delivered_to_vault' OR status === 'approved' with vault_status === 'delivered'
 *   - vault_status === 'delivered'
 *   - delivered_to_student_vault === true (if the field exists on the record)
 *
 * Joins linked BlockWard data by student_record_id.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { resolveEffectiveActor } from '../../shared/testMode.ts';
import { findProfileByEmail } from '../../shared/profileLookup.ts';

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
    const authUser = await base44.auth.me();
    if (!authUser) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: CORS });

    let body;
    try { body = await req.json(); } catch (e) { body = {}; }

    // Resolve the effective actor. In Test Mode this is the active persona, so the
    // vault loads for the student persona (persona email/id), not the controller.
    const actor = await resolveEffectiveActor(base44);
    if (!actor.authorized) return Response.json({ ok: false, error: actor.reason || 'Unauthorized' }, { status: actor.status || 401, headers: CORS });

    if (actor.actor_role === 'teacher') {
      return Response.json({ ok: false, error: 'Teachers cannot view student vaults' }, { status: 403, headers: CORS });
    }

    // The canonical student identity is the effective actor's email. (An admin may
    // optionally pass body.student_email to view a specific student's vault.)
    const targetEmail = actor.actor_role === 'admin' && body.student_email
      ? normalizeEmail(body.student_email)
      : normalizeEmail(actor.actor_email);

    // ── STEP 1: Resolve the canonical student identity ──
    // Targeted lookup (exact + case variants of the normalised email) — never
    // a full-table scan, which loaded every profile in the database to find
    // one and degraded as the user base grew.
    const profile = await findProfileByEmail(base44.asServiceRole, targetEmail);
    if (!profile) {
      return Response.json({ ok: false, error: 'Student profile not found for email: ' + targetEmail }, { status: 403, headers: CORS });
    }

    // Cross-school guard: an admin may only view vaults for students in their own
    // school. Without this check, an admin could pass any student_email — including
    // one belonging to a different school — and read that student's full vault.
    if (actor.actor_role === 'admin' && targetEmail !== normalizeEmail(actor.actor_email)) {
      if (!profile.school_id || profile.school_id !== actor.school_id) {
        return Response.json({ ok: false, error: 'wrong_school', message: 'This student belongs to a different organisation.' }, { status: 403, headers: CORS });
      }
    }

    const canonicalStudentId = profile.id;

    // ── STEP 2: Query delivered StudentRecords ──
    // Use student_id (primary) and student_email (fallback) to catch all records
    // regardless of how the email was stored at creation time.
    const [recordsByStudentId, recordsByEmail] = await Promise.all([
      base44.asServiceRole.entities.StudentRecord.filter({ student_id: canonicalStudentId }),
      base44.asServiceRole.entities.StudentRecord.filter({ student_email: profile.user_email }),
    ]);

    // Merge and deduplicate by record ID
    const seenIds = new Set();
    let records = [];
    for (const r of recordsByStudentId) {
      if (!seenIds.has(r.id)) { seenIds.add(r.id); records.push(r); }
    }
    for (const r of recordsByEmail) {
      // Include any record where the email matches — don't require owner_student_id
      // to also match, since owner_student_id may not have been set correctly at creation.
      if (!seenIds.has(r.id) && normalizeEmail(r.student_email) === targetEmail) {
        seenIds.add(r.id);
        records.push(r);
      }
    }

    // School check: if caller is admin, only return records from their school
    if (profile.user_type === 'admin' && profile.school_id) {
      records = records.filter(r => r.school_id === profile.school_id);
    }

    // ── STEP 3: Keep only DELIVERED records ──
    // A record is "delivered" when:
    //   - vault_status === 'delivered' AND
    //   - (status === 'delivered_to_vault' OR status === 'approved' OR status === 'archived')
    //   - delivered_to_student_vault === true (if the field exists)
    const earned = records.filter(r => {
      // Soft-deleted duplicates never appear in the vault.
      if (r.deleted === true) return false;
      // Only 'delivered_to_vault' and legacy 'archived' count as delivered.
      // 'approved' alone is NOT delivered — the admin must explicitly send to vault.
      const isDeliveredStatus = r.status === 'delivered_to_vault' || r.status === 'archived';
      const isVaultDelivered = r.vault_status === 'delivered';
      const hasDeliveredFlag = r.delivered_to_student_vault === true || r.delivered_to_student_vault === undefined;
      return isDeliveredStatus && isVaultDelivered && hasDeliveredFlag;
    });

    // Sort by delivered date descending, fallback to approved_at, then created_date
    earned.sort((a, b) =>
      new Date(b.vault_delivered_at || b.approved_at || b.updated_date || b.created_date) -
      new Date(a.vault_delivered_at || a.approved_at || a.updated_date || a.created_date)
    );

    // ── STEP 4: Join linked BlockWard data ──
    // Query by both student_email and owner_student_email to catch all BlockWards
    // regardless of how the email was stored at creation time.
    const [blockWardsByEmail, blockWardsByOwnerId] = await Promise.all([
      base44.asServiceRole.entities.BlockWard.filter({ student_email: profile.user_email, status: 'active' }),
      base44.asServiceRole.entities.BlockWard.filter({ owner_student_email: normalizeEmail(profile.user_email), status: 'active' }),
    ]);
    // Deduplicate by BlockWard id — the email and owner_email lookups can
    // return the same BlockWard, and merging blindly duplicated cards.
    const bwSeenIds = new Set();
    const blockWards = [...blockWardsByEmail, ...blockWardsByOwnerId].filter(bw => {
      if (bwSeenIds.has(bw.id)) return false;
      bwSeenIds.add(bw.id);
      return true;
    });
    const bwByRecordId = {};
    blockWards.forEach(bw => {
      const key = bw.student_record_id || bw.record_id;
      if (key && !bwByRecordId[key]) {
        bwByRecordId[key] = bw;
      }
    });

    // Issuing organisation name/logo — resolved once per school so every
    // achievement card shows who issued it (subtitle hierarchy: org name
    // when org-issued, category otherwise).
    // Distinct issuing schools, fetched concurrently — never one awaited
    // query per school inside a loop.
    const orgById = {};
    const schoolIds = [...new Set(earned.map(r => r.school_id).filter(Boolean))];
    const schoolLists = await Promise.all(schoolIds.map(sid =>
      base44.asServiceRole.entities.School.filter({ id: sid }).catch(() => [])
    ));
    for (const list of schoolLists) {
      const s = list?.[0];
      if (s) orgById[s.id] = { name: s.name, logo_url: s.logo_url || null };
    }

    // ── STEP 5: Return unified result ──
    const achievements = earned.map(rec => {
      const bw = bwByRecordId[rec.id] || null;
      const org = orgById[rec.school_id] || null;
      return {
        id: bw?.id || rec.id,
        record_id: rec.id,
        blockward_id: bw?.id || rec.blockward_id || null,
        school_id: rec.school_id,
        owner_student_id: rec.owner_student_id || rec.student_id || canonicalStudentId,
        owner_student_email: rec.owner_student_email || rec.student_email || profile.user_email,
        owner_school_id: rec.owner_school_id || rec.school_id,
        student_email: rec.student_email,
        student_name: rec.student_name,
        issuer_email: rec.admin_email || rec.teacher_email,
        issuer_name: rec.admin_name || rec.teacher_name,
        title: rec.title,
        description: rec.description,
        category: rec.category,
        organisation_name: org?.name || null,
        organisation_logo: org?.logo_url || null,
        image_url: bw?.image_url || rec.nft_image_url || rec.custom_nft_image_url || null,
        token_id: bw?.token_id || rec.nft_token_id || null,
        transaction_hash: bw?.transaction_hash || rec.nft_transaction_hash || null,
        minted_at: rec.approved_at || bw?.minted_at || rec.updated_date,
        status: 'active',
        verify_id: rec.verify_id,
        points: rec.points || 0,
        date_achieved: rec.date_achieved,
        is_custom_award: rec.is_custom_award || false,
        custom_award_icon: rec.custom_award_icon || null,
        custom_award_color: rec.custom_award_color || null,
        file_url: rec.file_url || null,
        certificate_url: rec.certificate_url || null,
        nft_token_id: bw?.token_id || rec.nft_token_id || null,
        nft_image_url: rec.nft_image_url || null,
        nft_transaction_hash: bw?.transaction_hash || rec.nft_transaction_hash || null,
        teacher_name: rec.teacher_name,
        admin_name: rec.admin_name,
        teacher_signed: rec.teacher_signed,
        admin_signed: rec.admin_signed,
        teacher_signature_id: rec.teacher_signature_id || null,
        admin_signature_id: rec.admin_signature_id || null,
        vault_delivered_at: rec.vault_delivered_at,
        delivered_to_student_vault: true,
        vault_status: 'delivered',
      };
    });

    return Response.json({
      ok: true,
      achievements,
      count: achievements.length,
      canonical_student_id: canonicalStudentId,
      query_used: {
        method: 'student_id + student_email merge',
        student_id: canonicalStudentId,
        student_email: profile.user_email,
        filter_criteria: 'vault_status === delivered AND status IN (delivered_to_vault, archived)',
      },
    }, { headers: CORS });

  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500, headers: CORS });
  }
});