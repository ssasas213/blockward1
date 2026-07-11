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
    navItems: ['Classes', 'Timetable', 'Attendance', 'Grade Book', 'School Events'],
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
    // Navigation per role
    navigation: {
      admin: [
        { name: 'Dashboard', icon: 'LayoutDashboard', path: '/AdminDashboard' },
        { name: 'Users', icon: 'Users', path: '/ManageUsers' },
        { name: 'Classes', icon: 'BookOpen', path: '/Classes' },
        { name: 'Timetable', icon: 'Calendar', path: '/Timetable' },
        { name: 'School Events', icon: 'Calendar', path: '/SchoolEvents' },
        { name: 'Attendance', icon: 'UserCircle', path: '/Attendance' },
        { name: 'Grade Book', icon: 'BookOpen', path: '/GradeBook' },
        { name: 'Announcements', icon: 'Bell', path: '/Announcements' },
        { name: 'Approval Queue', icon: 'PenLine', path: '/AdminApprovalQueue' },
        { name: 'Achievement Records', icon: 'Trophy', path: '/AdminRecords' },
        { name: 'Custodian Dashboard', icon: 'Shield', path: '/CustodianDashboard' },
        { name: 'Point Categories', icon: 'Settings', path: '/PointCategories' },
        { name: 'Analytics', icon: 'BarChart3', path: '/Analytics' },
        { name: 'Reports', icon: 'FileText', path: '/Reports' },
        { name: 'School Codes', icon: 'Shield', path: '/SchoolCodes' },
        { name: 'Parent Comms', icon: 'Bell', path: '/ParentComms' },
      ],
      teacher: [
        { name: 'Dashboard', icon: 'LayoutDashboard', path: '/TeacherDashboard' },
        { name: 'My Classes', icon: 'BookOpen', path: '/Classes' },
        { name: 'Timetable', icon: 'Calendar', path: '/Timetable' },
        { name: 'School Events', icon: 'Calendar', path: '/SchoolEvents' },
        { name: 'Issue Points', icon: 'Award', path: '/IssuePoints' },
        { name: 'Create Achievement', icon: 'Trophy', path: '/IssueBlockWard' },
        { name: 'My Submissions', icon: 'Shield', path: '/TeacherRecords' },
        { name: 'Parent Comms', icon: 'FileText', path: '/ParentComms' },
        { name: 'My BlockWards', icon: 'Award', path: '/TeacherBlockWards' },
        { name: 'Resources', icon: 'FileText', path: '/Resources' },
      ],
      student: [
        { name: 'Dashboard', icon: 'LayoutDashboard', path: '/StudentDashboard' },
        { name: 'My Classes', icon: 'BookOpen', path: '/Classes' },
        { name: 'Announcements', icon: 'Megaphone', path: '/Announcements' },
        { name: 'Timetable', icon: 'Calendar', path: '/Timetable' },
        { name: 'School Events', icon: 'Calendar', path: '/SchoolEvents' },
        { name: 'My Points', icon: 'Award', path: '/MyPoints' },
        { name: 'My BlockWards', icon: 'Shield', path: '/StudentBlockWards' },
        { name: 'My Achievements', icon: 'Trophy', path: '/StudentMyRecords' },
        { name: 'Portfolio Vault', icon: 'HardDrive', path: '/StudentPortfolioVault' },
        { name: 'Resources', icon: 'FileText', path: '/Resources' },
      ],
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
        { name: 'Members', icon: 'Users', path: '/organisations/members' },
        { name: 'Teams', icon: 'Users', path: '/organisations/teams' },
        { name: 'Departments', icon: 'Building2', path: '/organisations/departments' },
        { name: 'Competitions', icon: 'Trophy', path: '/organisations/competitions' },
        { name: 'Certifications', icon: 'Award', path: '/organisations/certifications' },
        { name: 'Events', icon: 'Calendar', path: '/organisations/events' },
        { name: 'Achievements', icon: 'Medal', path: '/organisations/achievements' },
        { name: 'Recognition', icon: 'Star', path: '/organisations/recognition' },
        { name: 'Leaderboards', icon: 'BarChart3', path: '/organisations/leaderboards' },
        { name: 'Analytics', icon: 'BarChart3', path: '/organisations/analytics' },
        { name: 'Approval Queue', icon: 'PenLine', path: '/organisations/approvals' },
      ],
      teacher: [
        { name: 'Dashboard', icon: 'LayoutDashboard', path: '/organisations/dashboard' },
        { name: 'My Teams', icon: 'Users', path: '/organisations/teams' },
        { name: 'Members', icon: 'Users', path: '/organisations/members' },
        { name: 'Issue Achievement', icon: 'Trophy', path: '/organisations/issue' },
        { name: 'My Submissions', icon: 'Shield', path: '/organisations/submissions' },
        { name: 'Events', icon: 'Calendar', path: '/organisations/events' },
        { name: 'My BlockWards', icon: 'Award', path: '/organisations/my-blockwards' },
      ],
      student: [
        { name: 'Dashboard', icon: 'LayoutDashboard', path: '/organisations/dashboard' },
        { name: 'My Achievements', icon: 'Trophy', path: '/organisations/my-achievements' },
        { name: 'My BlockWards', icon: 'Shield', path: '/organisations/my-blockwards' },
        { name: 'Portfolio Vault', icon: 'HardDrive', path: '/organisations/vault' },
        { name: 'Events', icon: 'Calendar', path: '/organisations/events' },
        { name: 'Leaderboards', icon: 'BarChart3', path: '/organisations/leaderboards' },
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