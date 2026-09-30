/**
 * BlockWard Platform Configuration
 *
 * Two completely independent platforms sharing the same BlockWard
 * verification engine. Each has its own roles, terminology, achievement
 * categories, navigation, branding, and dashboard routes.
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
    welcomeText: 'Welcome to BlockWard Schools',
    subtitle: 'Sign in to your school achievement vault',
    signupSubtitle: 'Create your school BlockWard account',
    roles: ['Students', 'Teachers', 'Parents', 'School Admins'],
    features: [
      'Academic achievements',
      'Attendance awards',
      'Student records',
      'Parent communication',
      'Classes and timetables',
    ],
    navItems: [],
    credentialLabel: 'Achievement',
    cta: 'Enter BlockWard Schools',
    loginPath: '/schools/login',
    signupPath: '/schools/signup',
    dashboardPath: '/schools/dashboard',
    // Achievement categories for this platform
    achievementCategories: [
      'Academic Excellence',
      'Attendance',
      'Leadership',
      'Sports',
      'Behaviour',
      'Community Service',
      'Arts',
    ],
    // Signup roles (maps to UserProfile.user_type)
    signupRoles: [
      { key: 'student', label: 'Student', icon: 'GraduationCap', color: 'from-blue-500 to-cyan-500', active: 'border-blue-500 ring-2 ring-blue-200 bg-blue-50', text: 'text-blue-700' },
      { key: 'teacher', label: 'Teacher', icon: 'BookOpen', color: 'from-violet-500 to-purple-500', active: 'border-violet-500 ring-2 ring-violet-200 bg-violet-50', text: 'text-violet-700' },
      { key: 'admin', label: 'School Admin', icon: 'Shield', color: 'from-rose-500 to-orange-500', active: 'border-rose-500 ring-2 ring-rose-200 bg-rose-50', text: 'text-rose-700' },
    ],
    // Navigation per role — the schools platform is in legacy wind-down. The
    // live sidebar (Layout.jsx) is driven by its own role navigation, and the
    // organisations sidebar (OrgsLayout) uses only the organisations platform
    // below. These entries are intentionally minimal so no deleted route renders.
    navigation: {
      admin: [{ name: 'Dashboard', icon: 'LayoutDashboard', path: '/AdminDashboard' }],
      teacher: [{ name: 'Dashboard', icon: 'LayoutDashboard', path: '/TeacherDashboard' }],
      student: [{ name: 'Dashboard', icon: 'LayoutDashboard', path: '/StudentDashboard' }],
    },
    // org_types that belong to this platform
    orgTypes: ['school'],
    // Theme colors for the layout
    theme: {
      primary: 'blue',
      sidebarGradient: 'from-blue-500 to-indigo-600',
      activeGradient: 'from-blue-500 to-indigo-600',
      accent: 'text-blue-600',
      bgAccent: 'bg-blue-50',
      ringAccent: 'ring-blue-200',
    },
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
    welcomeText: 'Welcome to BlockWard Organisations',
    subtitle: 'Sign in to your achievement vault',
    signupSubtitle: 'Create your organisation BlockWard account',
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
    navItems: ['Members', 'Teams', 'Competitions', 'Certifications', 'Events', 'Leaderboards'],
    credentialLabel: 'Credential',
    cta: 'Enter BlockWard Organisations',
    loginPath: '/organisations/login',
    signupPath: '/organisations/signup',
    dashboardPath: '/organisations/dashboard',
    // Achievement categories for this platform
    achievementCategories: [
      'Belt Promotion',
      'Tournament Winner',
      'Championship',
      'Employee of the Month',
      'Training Completion',
      'Professional Certification',
      'Outstanding Service',
      'Volunteer Award',
      'Competition Winner',
    ],
    // Signup roles (maps to UserProfile.user_type internally, but displayed with org terminology)
    signupRoles: [
      { key: 'student', label: 'Member / Athlete', icon: 'Trophy', color: 'from-amber-500 to-orange-500', active: 'border-amber-500 ring-2 ring-amber-200 bg-amber-50', text: 'text-amber-700' },
      { key: 'teacher', label: 'Coach / Instructor', icon: 'Whistle', color: 'from-orange-500 to-red-500', active: 'border-orange-500 ring-2 ring-orange-200 bg-orange-50', text: 'text-orange-700' },
      { key: 'admin', label: 'Organisation Admin', icon: 'Shield', color: 'from-rose-500 to-orange-500', active: 'border-rose-500 ring-2 ring-rose-200 bg-rose-50', text: 'text-rose-700' },
    ],
    // Navigation per role — org terminology only
    navigation: {
      admin: [
        { name: 'Dashboard', icon: 'LayoutDashboard', path: '/organisations/dashboard' },
      ],
      teacher: [
        { name: 'Dashboard', icon: 'LayoutDashboard', path: '/organisations/dashboard' },
      ],
      student: [
        { name: 'Dashboard', icon: 'LayoutDashboard', path: '/organisations/dashboard' },
      ],
    },
    // org_types that belong to this platform
    orgTypes: [
      'sports_club',
      'martial_arts_academy',
      'chess_club',
      'music_academy',
      'debate_organization',
      'stem_competition',
      'corporate_training',
      'training_provider',
      'competition_organizer',
      'other',
    ],
    // Theme colors for the layout
    theme: {
      primary: 'orange',
      sidebarGradient: 'from-amber-500 to-orange-600',
      activeGradient: 'from-amber-500 to-orange-600',
      accent: 'text-orange-600',
      bgAccent: 'bg-orange-50',
      ringAccent: 'ring-amber-200',
    },
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