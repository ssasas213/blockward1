/**
 * getStudentVault — Fetches a student's earned achievements from the single
 * source of truth (StudentRecord), joined with BlockWard NFT data.
 *
 * Bypasses RLS by using asServiceRole, but enforces permissions server-side:
 * the caller must be the student themselves or an admin in the same school.
 *
 * Returns a unified array shaped like BlockWard display objects, so the
 * frontend can render them directly without any additional queries.
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

  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: CORS });

    let body;
    try { body = await req.json(); } catch (e) { body = {}; }
    const targetEmail = body.student_email || user.email;

    const profiles = await base44.asServiceRole.entities.UserProfile.filter({ user_email: user.email });
    const profile = profiles[0];
    if (!profile) return Response.json({ ok: false, error: 'User profile not found' }, { status: 403, headers: CORS });

    // Permission: student can only see their own vault; admins can see any student in their school
    if (profile.user_type === 'student' && targetEmail !== user.email) {
      return Response.json({ ok: false, error: 'You can only view your own vault' }, { status: 403, headers: CORS });
    }
    if (profile.user_type === 'teacher' && targetEmail !== user.email) {
      return Response.json({ ok: false, error: 'Teachers cannot view student vaults' }, { status: 403, headers: CORS });
    }

    // Fetch all records for this student (service role bypasses RLS)
    const allRecords = await base44.asServiceRole.entities.StudentRecord.filter({ student_email: targetEmail });

    // School check: if caller is admin, only return records from their school
    let records = allRecords;
    if (profile.user_type === 'admin' && profile.school_id) {
      records = allRecords.filter(r => r.school_id === profile.school_id);
    }

    // Keep only delivered/archived (fully approved) records
    const earned = records.filter(r => r.status === 'delivered_to_vault' || r.status === 'archived');

    // Sort by approved_at descending
    earned.sort((a, b) =>
      new Date(b.approved_at || b.updated_date || b.created_date) -
      new Date(a.approved_at || a.updated_date || a.created_date)
    );

    // Fetch BlockWards for joining (by record_id)
    const blockWards = await base44.asServiceRole.entities.BlockWard.filter({ student_email: targetEmail, status: 'active' });
    const bwByRecordId = {};
    blockWards.forEach(bw => {
      if (bw.record_id) {
        if (!bwByRecordId[bw.record_id]) bwByRecordId[bw.record_id] = bw;
      }
    });

    // Also index BlockWards by student_record_id (newer field)
    blockWards.forEach(bw => {
      if (bw.student_record_id && !bwByRecordId[bw.student_record_id]) {
        bwByRecordId[bw.student_record_id] = bw;
      }
    });

    // Merge into unified view
    const achievements = earned.map(rec => {
      const bw = bwByRecordId[rec.id] || null;
      return {
        id: bw?.id || rec.id,
        record_id: rec.id,
        blockward_id: bw?.id || rec.blockward_id || null,
        school_id: rec.school_id,
        owner_student_id: rec.owner_student_id || rec.student_id || null,
        owner_student_email: rec.owner_student_email || rec.student_email,
        owner_school_id: rec.owner_school_id || rec.school_id,
        student_email: rec.student_email,
        student_name: rec.student_name,
        issuer_email: rec.admin_email || rec.teacher_email,
        issuer_name: rec.admin_name || rec.teacher_name,
        title: rec.title,
        description: rec.description,
        category: rec.category,
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
        teacher_name: rec.teacher_name,
        admin_name: rec.admin_name,
        teacher_signed: rec.teacher_signed,
        admin_signed: rec.admin_signed,
        vault_delivered_at: rec.vault_delivered_at,
      };
    });

    return Response.json({
      ok: true,
      achievements,
      count: achievements.length,
    }, { headers: CORS });

  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500, headers: CORS });
  }
});