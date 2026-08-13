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

  // ===== Resolve school membership BEFORE picking a destination. =====
  // This prevents landing a no-school user on a dashboard (which then bounces
  // through the route guard) and routes a pending teacher/admin to the
  // awaiting-approval screen instead of the dashboard.
  // Admin: owns a school (admin_email) OR active AdminSchoolMembership.
  // Teacher: school_id on profile OR active StaffMembership.
  // Student: school_id on profile (auto-linked at join time).
  let hasSchool = !!(profile.school_id || profile.active_school_id);
  let pendingMembership = false;

  if (!hasSchool) {
    if (role === 'admin') {
      try {
        const owned = await base44.entities.School.filter({ admin_email: user.email });
        if (owned.length > 0) {
          hasSchool = true;
        } else {
          const memberships = await base44.entities.AdminSchoolMembership.filter({ admin_email: user.email });
          if (memberships.some(m => m.status === 'active')) hasSchool = true;
          else if (memberships.some(m => m.status === 'pending')) pendingMembership = true;
        }
      } catch { /* ignore — treat as no school */ }
    } else if (role === 'teacher') {
      try {
        const staff = await base44.entities.StaffMembership.filter({ user_email: user.email });
        if (staff.some(s => s.status === 'active')) hasSchool = true;
        else if (staff.some(s => s.status === 'pending')) pendingMembership = true;
      } catch { /* ignore */ }
    }
  }

  // Pending join request — show the awaiting-approval state on the Login page
  if (pendingMembership) return 'pending';

  // No school linked yet — route to setup, not the dashboard
  if (!hasSchool) {
    window.location.href = role === 'admin' ? '/SchoolSetup' : '/JoinSchool';
    return null;
  }

  // ===== Determine platform (organisations vs schools) =====
  const roleLabel = (profile.role_label || '').toLowerCase();
  let platform = roleLabel.includes('organisation') || roleLabel.includes('org')
    ? 'organisations'
    : 'schools';

  if (platform === 'schools') {
    const schoolId = profile.active_school_id || profile.school_id;
    if (schoolId) {
      try {
        const schools = await base44.entities.School.filter({ id: schoolId });
        if (schools.length > 0 && (schools[0].org_type || 'school') !== 'school') {
          platform = 'organisations';
        }
      } catch {
        /* ignore — default to schools */
      }
    }
  }

  if (platform === 'organisations') {
    window.location.href = ORGS_DASHBOARD_MAP[role] || '/organisations/dashboard';
  } else {
    window.location.href = SCHOOLS_DASHBOARD_MAP[role] || '/StudentDashboard';
  }
  return null;
}