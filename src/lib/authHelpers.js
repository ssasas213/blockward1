import { base44 } from '@/api/base44Client';

export const DASHBOARD_MAP = {
  admin: '/AdminDashboard',
  teacher: '/TeacherDashboard',
  student: '/StudentDashboard',
};

/**
 * After a successful login, load the user's profile and redirect to the correct dashboard.
 * Returns an error string if the account has a problem (pending, suspended, no profile).
 */
export async function handlePostLoginRedirect() {
  const user = await base44.auth.me();
  if (!user) throw new Error('Not authenticated');

  const profiles = await base44.entities.UserProfile.filter({ user_email: user.email });

  if (profiles.length === 0) {
    // Authenticated but no BlockWard profile — send to onboarding
    window.location.href = '/Onboarding';
    return null;
  }

  const profile = profiles[0];

  if (profile.status === 'inactive' || profile.status === 'suspended') {
    return 'suspended';
  }

  const role = profile.user_type; // admin | teacher | student
  const dest = DASHBOARD_MAP[role] || '/StudentDashboard';
  window.location.href = dest;
  return null;
}