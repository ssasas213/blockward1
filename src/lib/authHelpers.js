import { base44 } from '@/api/base44Client';
import { platformForOrgType } from '@/lib/platformConfig';

// Schools dashboard routes (existing flat routes)
const SCHOOLS_DASHBOARD_MAP = {
  admin: '/AdminDashboard',
  teacher: '/TeacherDashboard',
  student: '/StudentDashboard',
};

// Organisations dashboard routes (new platform-scoped routes)
const ORGS_DASHBOARD_MAP = {
  admin: '/organisations/dashboard',
  teacher: '/organisations/dashboard',
  student: '/organisations/dashboard',
};

/**
 * After a successful login, load the user's profile and redirect to the
 * correct platform dashboard. If a platformId is provided (from the login
 * page), it overrides the org_type detection — the user explicitly chose
 * which platform to enter.
 *
 * Returns an error string if the account has a problem (suspended).
 */
export async function handlePostLoginRedirect(platformId = null) {
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

  // Determine which platform the user belongs to
  let platform = platformId;

  // If no explicit platform chosen, detect from the user's org_type
  if (!platform && profile.school_id) {
    try {
      const schools = await base44.entities.School.filter({ id: profile.school_id });
      if (schools.length > 0) {
        const orgType = schools[0].org_type || 'school';
        platform = platformForOrgType(orgType);
      }
    } catch {
      /* ignore — default to schools */
    }
  }

  // Default to schools
  platform = platform || 'schools';

  if (platform === 'organisations') {
    const dest = ORGS_DASHBOARD_MAP[role] || '/organisations/dashboard';
    window.location.href = dest;
  } else {
    const dest = SCHOOLS_DASHBOARD_MAP[role] || '/StudentDashboard';
    window.location.href = dest;
  }
  return null;
}