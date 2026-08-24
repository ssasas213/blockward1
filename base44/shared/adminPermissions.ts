/**
 * adminPermissions — canonical admin permission model.
 *
 * admin_permissions (the boolean object on UserProfile) is the single source of
 * truth for what an admin may do. admin_level is a display label that seeds
 * sensible defaults when an admin is created (setupSchool / acceptInvitation /
 * getTestModeStatus). The Admin Permissions screen reads and writes
 * admin_permissions directly, so what it shows is what the backend enforces.
 *
 * `issue_blockwards` is intentionally NOT a permission here: per the platform
 * architecture, only teachers create and submit achievement records; admins
 * review, sign, and deliver. An admin therefore never needs an "issue" grant.
 */

export const ADMIN_PERMISSION_KEYS = [
  'manage_users',
  'manage_classes',
  'view_all_points',
  'edit_points',
  'view_reports',
  'manage_categories',
  'manage_school_settings',
  'view_parent_contacts',
] as const;

export const DEFAULT_ADMIN_PERMISSIONS: Record<string, Record<string, boolean>> = {
  super_admin: {
    manage_users: true, manage_classes: true, view_all_points: true, edit_points: true,
    view_reports: true, manage_categories: true, manage_school_settings: true, view_parent_contacts: true,
  },
  head_of_year: {
    manage_users: false, manage_classes: true, view_all_points: true, edit_points: true,
    view_reports: true, manage_categories: false, manage_school_settings: false, view_parent_contacts: true,
  },
  head_of_department: {
    manage_users: false, manage_classes: true, view_all_points: true, edit_points: false,
    view_reports: true, manage_categories: false, manage_school_settings: false, view_parent_contacts: true,
  },
  data_manager: {
    manage_users: false, manage_classes: false, view_all_points: true, edit_points: false,
    view_reports: true, manage_categories: false, manage_school_settings: false, view_parent_contacts: false,
  },
  basic_admin: {
    manage_users: false, manage_classes: false, view_all_points: false, edit_points: false,
    view_reports: false, manage_categories: false, manage_school_settings: false, view_parent_contacts: false,
  },
};

/** Defaults for a freshly created admin. Unknown levels fall back to super_admin (full). */
export function defaultAdminPermissions(adminLevel?: string | null): Record<string, boolean> {
  const level = adminLevel && DEFAULT_ADMIN_PERMISSIONS[adminLevel] ? adminLevel : 'super_admin';
  return { ...DEFAULT_ADMIN_PERMISSIONS[level] };
}

/**
 * Backend enforcement helper. Returns true if the given admin profile may
 * perform the permission. Super admins (or unset level, e.g. the school owner
 * during first setup) implicitly have every permission.
 */
export function hasAdminPermission(profile: any, permission: string): boolean {
  if (!profile) return false;
  const level = profile.admin_level;
  if (!level || level === 'super_admin') return true;
  return !!(profile.admin_permissions && profile.admin_permissions[permission]);
}