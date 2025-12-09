/**
 * Permission utility functions for checking admin access levels
 */

/**
 * Check if a user has a specific permission
 * @param {Object} profile - User profile object
 * @param {string} permission - Permission key to check
 * @returns {boolean}
 */
export function hasPermission(profile, permission) {
  if (!profile) return false;
  
  // Super admins always have all permissions
  if (profile.admin_level === 'super_admin' || profile.user_type === 'admin' && !profile.admin_level) {
    return true;
  }
  
  // Check specific permission
  return profile.admin_permissions?.[permission] === true;
}

/**
 * Check if user can manage users
 */
export function canManageUsers(profile) {
  return hasPermission(profile, 'manage_users');
}

/**
 * Check if user can manage classes
 */
export function canManageClasses(profile) {
  return hasPermission(profile, 'manage_classes');
}

/**
 * Check if user can issue BlockWards
 */
export function canIssueBlockWards(profile) {
  return hasPermission(profile, 'issue_blockwards');
}

/**
 * Check if user can view all points
 */
export function canViewAllPoints(profile) {
  return hasPermission(profile, 'view_all_points');
}

/**
 * Check if user can edit points
 */
export function canEditPoints(profile) {
  return hasPermission(profile, 'edit_points');
}

/**
 * Check if user can view reports
 */
export function canViewReports(profile) {
  return hasPermission(profile, 'view_reports');
}

/**
 * Check if user can manage categories
 */
export function canManageCategories(profile) {
  return hasPermission(profile, 'manage_categories');
}

/**
 * Check if user can manage school settings
 */
export function canManageSchoolSettings(profile) {
  return hasPermission(profile, 'manage_school_settings');
}

/**
 * Check if user can view parent contacts
 */
export function canViewParentContacts(profile) {
  return hasPermission(profile, 'view_parent_contacts');
}

/**
 * Get admin level display name
 */
export function getAdminLevelName(level) {
  const levels = {
    super_admin: 'Super Admin',
    head_of_year: 'Head of Year',
    head_of_department: 'Head of Department',
    data_manager: 'Data Manager',
    basic_admin: 'Basic Admin'
  };
  return levels[level] || 'Admin';
}