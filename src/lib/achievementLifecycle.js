/**
 * Achievement Lifecycle — Single Source of Truth
 *
 * StudentRecord is the ONE source of truth for all achievements.
 *   status: 'archived'  = fully approved (teacher + admin signed) + BlockWard minted
 *
 * BlockWard is a linked projection (joined by record_id) that holds NFT-specific
 * data (image, token_id, transaction_hash). It is created atomically with the
 * record's transition to 'archived' by the recordWorkflow backend function.
 *
 * This module provides the canonical loader that ALL student-facing pages should
 * use to display earned achievements / BlockWards. No page should query the
 * BlockWard entity directly as a source of truth — always go through here.
 */
import { base44 } from '@/api/base44Client';

/**
 * Load a student's earned achievements from the single source of truth.
 * Returns a unified array sorted by approval date (most recent first).
 * Each item merges StudentRecord (source of truth) with BlockWard (NFT projection).
 *
 * @param {string} studentEmail
 * @param {string} schoolId
 * @returns {Promise<Array>} unified achievement views
 */
export async function loadEarnedAchievements(studentEmail, schoolId) {
  if (!studentEmail) return [];

  // Source of truth: StudentRecord with status 'archived'
  const filter = { student_email: studentEmail, status: 'archived' };
  if (schoolId) filter.school_id = schoolId;
  const records = await base44.entities.StudentRecord.filter(filter);

  // Sort by approved_at descending (fall back to updated_date/created_date)
  records.sort(
    (a, b) =>
      new Date(b.approved_at || b.updated_date || b.created_date) -
      new Date(a.approved_at || a.updated_date || a.created_date)
  );

  // Linked projection: BlockWard (NFT data) — joined by record_id
  const bwFilter = { student_email: studentEmail, status: 'active' };
  if (schoolId) bwFilter.school_id = schoolId;
  let blockWards = [];
  try {
    blockWards = await base44.entities.BlockWard.filter(bwFilter);
  } catch {
    blockWards = [];
  }
  const bwByRecordId = {};
  blockWards.forEach((bw) => {
    if (bw.record_id) bwByRecordId[bw.record_id] = bw;
  });

  // Merge into a unified view shaped like a BlockWard for display components
  return records.map((rec) => {
    const bw = bwByRecordId[rec.id] || null;
    return {
      // Identity
      id: bw?.id || rec.id,
      record_id: rec.id,
      blockward_id: bw?.id || null,
      school_id: rec.school_id,
      // Permanent ownership (survives teacher/admin departure)
      owner_student_id: rec.owner_student_id || rec.student_id || null,
      owner_student_email: rec.owner_student_email || rec.student_email,
      owner_school_id: rec.owner_school_id || rec.school_id,
      // Student
      student_email: rec.student_email,
      student_name: rec.student_name,
      student_wallet: bw?.student_wallet || null,
      // Issuer
      issuer_email: rec.admin_email || rec.teacher_email,
      issuer_name: rec.admin_name || rec.teacher_name,
      issuer_wallet: bw?.issuer_wallet || 'system',
      // Achievement
      title: rec.title,
      description: rec.description,
      category: rec.category,
      // NFT / badge
      image_url: bw?.image_url || rec.nft_image_url || rec.custom_nft_image_url || null,
      token_id: bw?.token_id || rec.nft_token_id || null,
      transaction_hash: bw?.transaction_hash || rec.nft_transaction_hash || null,
      metadata_uri: bw?.metadata_uri || null,
      block_number: bw?.block_number || null,
      minted_at: rec.approved_at || bw?.minted_at || rec.updated_date,
      status: 'active',
      // Verification
      verify_id: rec.verify_id,
      // Extra metadata
      points: rec.points || 0,
      date_achieved: rec.date_achieved,
      is_custom_award: rec.is_custom_award || false,
      custom_award_icon: rec.custom_award_icon || null,
    };
  });
}

/**
 * Count a student's earned achievements (for dashboard stats).
 * Uses the same source of truth as loadEarnedAchievements.
 */
export async function countEarnedAchievements(studentEmail, schoolId) {
  const achievements = await loadEarnedAchievements(studentEmail, schoolId);
  return achievements.length;
}