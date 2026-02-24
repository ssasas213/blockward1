/**
 * getUserContext — resolves role, schoolId, and teacher class assignments
 * for the currently authenticated user.
 * Returns: { user, profile, membership, schoolId, role, teacherClassIds }
 */
import { base44 } from '@/api/base44Client';

export async function getUserContext() {
  const user = await base44.auth.me();
  if (!user) return null;

  const profiles = await base44.entities.UserProfile.filter({ user_email: user.email });
  const profile = profiles[0] || null;

  const role = profile?.user_type || 'student';
  const schoolId = profile?.school_id || null;

  let membership = null;
  let teacherClassIds = [];

  if (role === 'teacher' || role === 'admin') {
    const memberships = await base44.entities.StaffMembership.filter({ user_email: user.email });
    membership = memberships[0] || null;
    teacherClassIds = membership?.class_ids || [];
  }

  return { user, profile, membership, schoolId, role, teacherClassIds };
}