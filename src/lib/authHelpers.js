import { base44 } from '@/api/base44Client';

const SCHOOLS_DASHBOARD_MAP = {
  admin: '/AdminDashboard',
  teacher: '/TeacherDashboard',
  student: '/StudentDashboard',
};

const ORGS_DASHBOARD_MAP = {
  admin: '/organisations/dashboard',
  teacher: '/organisations/dashboard',
  student: '/organisations/dashboard',
};

function normalizeEmail(email) {
  return (email || '').trim().toLowerCase();
}

/**
 * After a successful Google login, load the user's profile and redirect to the
 * correct dashboard.
 *
 * Returns:
 *   - null if a redirect was issued (to dashboard or onboarding)
 *   - 'suspended' if the account is suspended/inactive
 *   - 'pending' if the account is pending admin approval
 */
export async function handlePostLoginRedirect() {
  const user = await base44.auth.me();
  if (!user) throw new Error('Not authenticated');

  const normalizedEmail = normalizeEmail(user.email);

  // Search by exact email first
  let profiles = await base44.entities.UserProfile.filter({ user_email: user.email });

  // Fallback: try normalized (lowercase) email
  if (profiles.length === 0) {
    profiles = await base44.entities.UserProfile.filter({ user_email: normalizedEmail });
  }

  if (profiles.length === 0) {
    // Authenticated but no BlockWard profile — send to onboarding
    window.location.href = '/Onboarding';
    return null;
  }

  const profile = profiles[0];

  if (profile.status === 'inactive' || profile.status === 'suspended') {
    return 'suspended';
  }

  if (profile.status === 'pending_approval') {
    return 'pending';
  }

  const role = profile.user_type; // admin | teacher | student

  // Determine which platform the user belongs to
  // Check role_label first (set during onboarding for org users)
  const roleLabel = (profile.role_label || '').toLowerCase();
  let platform = roleLabel.includes('organisation') || roleLabel.includes('org')
    ? 'organisations'
    : 'schools';

  // If school_id exists, check the school's org_type
  if (platform === 'schools' && profile.school_id) {
    try {
      const schools = await base44.entities.School.filter({ id: profile.school_id });
      if (schools.length > 0) {
        const orgType = schools[0].org_type || 'school';
        if (orgType !== 'school') {
          platform = 'organisations';
        }
      }
    } catch {
      /* ignore — default to schools */
    }
  }

  if (platform === 'organisations') {
    window.location.href = ORGS_DASHBOARD_MAP[role] || '/organisations/dashboard';
  } else {
    window.location.href = SCHOOLS_DASHBOARD_MAP[role] || '/StudentDashboard';
  }
  return null;
}