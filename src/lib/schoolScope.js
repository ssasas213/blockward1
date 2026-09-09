import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

/**
 * School-scope guard for staff actions.
 *
 * Every school-scoped write (creating a class, timetable entries, uploading
 * resources…) is scoped by the organisation on the staff profile. A teacher
 * or admin with no organisation linked CANNOT perform any of them — RLS
 * refuses the write. These helpers surface the real reason instead of a
 * generic "Failed to…" error.
 */

/** True for a staff profile (teacher/admin) with no organisation linked. */
export function isSchoollessStaff(profile) {
  if (!profile) return false;
  if (!['teacher', 'admin'].includes(profile.user_type)) return false;
  return !profile.school_id && !profile.active_school_id;
}

/**
 * Block a school-scoped action with the real reason it can't run.
 * Returns true when the action was blocked (caller should stop immediately).
 */
export async function blockIfSchoolless(profile, actionLabel) {
  if (!isSchoollessStaff(profile)) return false;

  // Name the school when a join request is waiting — that is the usual cause.
  let pendingSchoolName = null;
  try {
    const staff = await base44.entities.StaffMembership.filter({
      user_email: profile.user_email,
      status: 'pending',
    });
    pendingSchoolName = staff?.[0]?.school_name || null;
  } catch { /* lookups can fail — the message still explains the cause */ }

  const waiting = pendingSchoolName
    ? `Your request to join ${pendingSchoolName} is waiting for an administrator.`
    : "Join a school, or wait for an administrator to approve your request.";

  toast.error(
    `You're not linked to a school yet, so you can't ${actionLabel}. ${waiting}`,
    {
      description: 'You can check the status of your request at any time.',
      action: {
        label: 'View status',
        onClick: () => { window.location.href = '/JoinSchool'; },
      },
    }
  );
  return true;
}