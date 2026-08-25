// Shared caller verification for staff-only write operations.
//
// RLS `user_condition` can ONLY check the platform role ("admin"/"user"), never
// UserProfile.user_type — in this app teachers AND students are both platform
// "user", so no RLS rule can allow teachers but block students. Any "teacher or
// admin only" gate must therefore be enforced in code via these helpers, and
// the entity's `create` rule locked to __service_role_only__.

export async function getCallerProfile(base44) {
  const user = await base44.auth.me();
  if (!user) {
    return { user: null, profile: null, error: { error: 'Unauthorized', status: 401 } };
  }
  const profiles = await base44.asServiceRole.entities.UserProfile.filter({ user_email: user.email });
  if (!profiles || profiles.length === 0) {
    return { user, profile: null, error: { error: 'Profile not found', status: 404 } };
  }
  return { user, profile: profiles[0], error: null };
}

export function requireStaff(profile, roles = ['teacher', 'admin']) {
  if (!profile) return { error: 'Unauthorized', status: 401 };
  if (!roles.includes(profile.user_type)) {
    return { error: `Only ${roles.join(' or ')} may perform this action`, status: 403 };
  }
  return null;
}

export function requireSameSchool(profile, schoolId) {
  if (!profile || !profile.school_id) {
    return { error: 'You are not associated with a school', status: 403 };
  }
  if (schoolId && schoolId !== profile.school_id) {
    return { error: 'You can only act within your own school', status: 403 };
  }
  return null;
}