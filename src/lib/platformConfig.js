/**
 * BlockWard Platform Configuration
 *
 * BlockWard serves two top-level platforms, each sharing the same verification
 * engine but with distinct terminology, roles, features, and dashboards:
 *
 *   1. BlockWard Schools      — schools, colleges, universities
 *   2. BlockWard Organisations — sports clubs, martial arts, chess, esports,
 *                                music academies, training centres, companies
 *
 * The shared verification flow is identical for both platforms; only the UI,
 * terminology, and dashboards differ.
 */

export const PLATFORMS = {
  schools: {
    id: 'schools',
    name: 'BlockWard Schools',
    tagline: 'For schools, colleges and universities.',
    icon: 'GraduationCap',
    gradient: 'from-blue-500 to-indigo-600',
    bgGradient: 'from-blue-50 to-indigo-50',
    ring: 'ring-blue-200',
    text: 'text-blue-700',
    chip: 'bg-blue-100 text-blue-700',
    buttonGradient: 'from-blue-600 to-indigo-600',
    roles: ['Students', 'Teachers', 'Parents', 'School Admins'],
    features: [
      'Academic achievements',
      'Attendance awards',
      'Student records',
      'Parent communication',
      'Classes and timetables',
    ],
    navItems: ['Classes', 'Timetable', 'Gradebook', 'Parent Communication', 'School Events'],
    credentialLabel: 'Achievement',
    cta: 'Enter BlockWard Schools',
    // org_types that belong to this platform
    orgTypes: ['school'],
  },
  organisations: {
    id: 'organisations',
    name: 'BlockWard Organisations',
    tagline:
      'For sports clubs, martial arts academies, chess clubs, esports teams, music academies, training centres and companies.',
    icon: 'Trophy',
    gradient: 'from-amber-500 to-orange-600',
    bgGradient: 'from-amber-50 to-orange-50',
    ring: 'ring-amber-200',
    text: 'text-amber-700',
    chip: 'bg-amber-100 text-amber-700',
    buttonGradient: 'from-amber-500 to-orange-600',
    roles: [
      'Members',
      'Athletes',
      'Employees',
      'Coaches',
      'Instructors',
      'Managers',
      'Organisation Admins',
    ],
    features: [
      'Belt promotions',
      'Tournament wins',
      'Championship records',
      'Certifications',
      'Professional achievements',
      'Employee recognition',
      'Competition awards',
    ],
    navItems: ['Members', 'Competitions', 'Certifications', 'Rankings', 'Events', 'Awards'],
    credentialLabel: 'Credential',
    cta: 'Enter BlockWard Organisations',
    orgTypes: [
      'martial_arts_academy',
      'chess_club',
      'sports_club',
      'music_academy',
      'debate_organization',
      'stem_competition',
      'corporate_training',
      'training_provider',
      'competition_organizer',
      'other',
    ],
  },
};

/**
 * The shared BlockWard verification engine — identical for both platforms.
 */
export const VERIFICATION_FLOW = [
  { step: 'Create Achievement', icon: 'PlusCircle' },
  { step: 'Verifier Signs', icon: 'PenLine' },
  { step: 'Organisation Authorises', icon: 'ShieldCheck' },
  { step: 'Record Archived', icon: 'Archive' },
  { step: 'Public Verification Link Generated', icon: 'Link2' },
];

export const PLATFORM_LIST = [PLATFORMS.schools, PLATFORMS.organisations];

export function getPlatformConfig(platformId) {
  return PLATFORMS[platformId] || null;
}

/**
 * Determine which platform an org_type belongs to.
 */
export function platformForOrgType(orgType) {
  for (const platform of PLATFORM_LIST) {
    if (platform.orgTypes.includes(orgType)) return platform.id;
  }
  return 'schools';
}