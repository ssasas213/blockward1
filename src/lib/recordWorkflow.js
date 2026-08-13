/**
 * recordWorkflow.js — shared, single-source-of-truth helpers for the achievement
 * lifecycle. These DERIVE display values from the canonical record status + ownership.
 * They are NOT a second source of truth: the StudentRecord.status (and record.origin)
 * remain authoritative.
 */

/**
 * Returns the role that owns the NEXT action for a record, plus a human label.
 *
 * @param {string} status  - StudentRecord.status
 * @param {object} record  - the StudentRecord (used to resolve changes_requested editor)
 * @returns {{ role: string, label: string, tone: string }}
 *   role:  'student' | 'teacher' | 'admin' | 'student_or_teacher' | 'none'
 *   tone:  'pending' | 'ready' | 'done' | 'blocked'  (for badge styling)
 */
export function getNextAction(status, record = {}) {
  switch (status) {
    case 'draft':
      // A draft can be submitted by the student owner or (if teacher-issued) the teacher.
      return { role: record.origin === 'teacher' ? 'teacher' : 'student', label: 'Draft — awaiting submission', tone: 'pending' };

    case 'awaiting_teacher_signature':
      return { role: 'teacher', label: 'Waiting for Teacher', tone: 'pending' };

    case 'awaiting_admin_signature':
      return { role: 'admin', label: 'Waiting for Administrator', tone: 'pending' };

    case 'changes_requested': {
      // The editor is determined by who ORIGINALLY submitted (record.origin), not by
      // who is merely assigned. Falls back to "student or teacher" for legacy records.
      if (record.origin === 'teacher') {
        return { role: 'teacher', label: 'Changes Requested — Waiting for Teacher', tone: 'pending' };
      }
      if (record.origin === 'student') {
        return { role: 'student', label: 'Changes Requested — Waiting for Student', tone: 'pending' };
      }
      return { role: 'student_or_teacher', label: 'Changes Requested — Waiting for Student/Teacher', tone: 'pending' };
    }

    case 'approved':
      return { role: 'admin', label: 'Ready to Deliver', tone: 'ready' };

    case 'delivering':
      return { role: 'admin', label: 'Delivering BlockWard…', tone: 'pending' };

    case 'delivered_to_vault':
      return { role: 'none', label: 'Delivered ✓', tone: 'done' };

    case 'rejected':
      return { role: 'none', label: 'Rejected', tone: 'blocked' };

    case 'archived':
      return { role: 'none', label: 'Archived', tone: 'done' };

    case 'minted':
      return { role: 'admin', label: 'Ready to Deliver', tone: 'ready' };

    default:
      return { role: 'none', label: status || 'Unknown', tone: 'pending' };
  }
}

/**
 * The list of canonical lifecycle statuses in order, for documentation/timeline use.
 */
export const LIFECYCLE_STATUSES = [
  'draft',
  'awaiting_teacher_signature',
  'awaiting_admin_signature',
  'changes_requested',
  'approved',
  'delivering',
  'delivered_to_vault',
  'rejected',
];

/**
 * Fields that, if changed, invalidate the teacher's prior signature.
 * Kept in sync with the PROTECTED list in base44/functions/recordWorkflow/entry.ts.
 */
export const SIGNATURE_INVALIDATING_FIELDS = [
  'title', 'description', 'category', 'points', 'date_achieved',
  'file_url', 'file_type', 'certificate_url',
  'custom_award_icon', 'custom_award_color', 'custom_nft_image_url',
];