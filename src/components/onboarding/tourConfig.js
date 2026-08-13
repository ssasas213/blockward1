/**
 * Role-specific onboarding tours. Each step drives the mascot position,
 * spotlight target and dialogue. No business logic — pure presentation.
 */

const COMMON = [
  {
    id: 'welcome',
    title: 'Welcome to BlockWard',
    body: "Hey! I'm your guide. I'll show you how BlockWard turns your achievements into verified digital credentials.",
    mascotPos: 'center',
    buttons: ['start', 'skip'],
  },
  {
    id: 'what',
    title: 'What is BlockWard?',
    body: "BlockWard is your home for achievements that can be reviewed, verified and stored permanently in your digital portfolio.",
    mascotPos: 'right',
    visual: 'credential',
  },
  {
    id: 'dashboard',
    title: 'Your Dashboard',
    body: "You'll see your achievements, activity, progress and important updates here.",
    target: { main: true },
    mascotPos: 'right',
  },
  {
    id: 'lifecycle',
    title: 'How a BlockWard works',
    body: "Once an achievement is reviewed and approved, it becomes a verified BlockWard — permanently stored in your portfolio.",
    mascotPos: 'right',
    visual: 'lifecycle',
  },
  {
    id: 'verify',
    title: 'Verification',
    body: "Every verified BlockWard has a secure verification page you can share with schools, universities, organisations or employers.",
    mascotPos: 'right',
    visual: 'verify',
  },
];

const ROLE_MID = {
  student: {
    id: 'achievements',
    title: 'Achievements',
    body: "Achievements start here. You can submit your achievements for review and verification.",
    target: { sidebarText: 'My Achievements' },
    mascotPos: 'left',
  },
  teacher: {
    id: 'achievements',
    title: 'Achievements',
    body: "Achievements start here. You can recognise students and issue achievements for review.",
    target: { sidebarText: 'Create Achievement' },
    mascotPos: 'left',
  },
  admin: {
    id: 'approvals',
    title: 'Approval Queue',
    body: "You oversee submissions, reviews and approvals across your school's BlockWard workspace.",
    target: { sidebarText: 'Approval Queue' },
    mascotPos: 'left',
  },
};

const ROLE_VAULT = {
  student: {
    id: 'vault',
    title: 'BlockWard Vault',
    body: "Your verified BlockWards live in your Vault — your permanent collection of achievements.",
    target: { sidebarText: 'Portfolio Vault' },
    mascotPos: 'left',
  },
  teacher: {
    id: 'review',
    title: 'Review & Recognise',
    body: "You can review achievements, recognise students and send verified achievements through the BlockWard approval process.",
    target: { sidebarText: 'My Submissions' },
    mascotPos: 'left',
  },
  admin: {
    id: 'delivery',
    title: 'Approve & Deliver',
    body: "You approve credentials, sign them off, and send verified BlockWards to student vaults — overseen from your Custodian Dashboard.",
    target: { sidebarText: 'Custodian Dashboard' },
    mascotPos: 'left',
  },
};

const ROLE_CTA = {
  student: { label: 'Explore my dashboard', page: 'StudentDashboard' },
  teacher: { label: 'View my classes', page: 'Classes' },
  admin: { label: 'Set up my school', page: 'SystemSettings' },
};

export function getTour(role) {
  const r = role || 'student';
  const steps = [
    COMMON[0], COMMON[1], COMMON[2],
    ROLE_MID[r],
    COMMON[3],
    ROLE_VAULT[r],
    COMMON[4],
  ];
  steps.push({
    id: 'ready',
    title: "You're ready",
    body: "Let's build your BlockWard portfolio.",
    mascotPos: 'center',
    final: true,
    cta: ROLE_CTA[r],
  });
  return steps;
}

/** Find a DOM element for a spotlight target. */
export function findTarget(target) {
  if (!target) return null;
  if (target.main) return document.querySelector('main');
  if (target.selector) return document.querySelector(target.selector);
  if (target.sidebarText) {
    const links = Array.from(document.querySelectorAll('aside a, nav a'));
    const match = links.find(a => (a.textContent || '').toLowerCase().includes(target.sidebarText.toLowerCase()));
    if (match) return match;
    // fall back to any element containing the text
    const all = Array.from(document.querySelectorAll('a, button, [role="link"]'));
    return all.find(el => (el.textContent || '').toLowerCase().includes(target.sidebarText.toLowerCase())) || null;
  }
  return null;
}