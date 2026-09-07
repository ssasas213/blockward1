// Portfolio domains — the category system shown on the public profile and
// student dashboard. A domain is derived per achievement from the issuing
// organisation's type first (a BJJ belt comes from a martial arts academy, a
// chess rating from a chess organisation) and falls back to the credential
// category. Self-reported achievements carry a domain chosen by the student.

export const DOMAIN_ORDER = [
  'academic', 'sport', 'martial_arts', 'music',
  'chess', 'esports', 'community', 'professional', 'other',
];

export const DOMAIN_LABELS = {
  academic: 'Academic',
  sport: 'Sport',
  martial_arts: 'Martial Arts',
  music: 'Music',
  chess: 'Chess',
  esports: 'Esports',
  community: 'Community',
  professional: 'Professional',
  other: 'Other',
};

const ORG_TYPE_DOMAIN = {
  martial_arts_academy: 'martial_arts',
  chess_organisation: 'chess',
  chess_club: 'chess',
  esports_organisation: 'esports',
  music_academy: 'music',
};

const CATEGORY_DOMAIN = {
  academic: 'academic',
  sports: 'sport',
  arts: 'music',
  leadership: 'professional',
  community: 'community',
  behaviour: 'community',
  special: 'professional',
};

// Works on raw registry records (organisation_type + achievement_category)
// and on public-profile achievements (already carry `domain`).
export function domainOf(a = {}) {
  if (a.domain) return a.domain;
  if (a.organisation_type && ORG_TYPE_DOMAIN[a.organisation_type]) return ORG_TYPE_DOMAIN[a.organisation_type];
  if (a.achievement_category && CATEGORY_DOMAIN[a.achievement_category]) return CATEGORY_DOMAIN[a.achievement_category];
  if (a.category && CATEGORY_DOMAIN[a.category]) return CATEGORY_DOMAIN[a.category];
  return 'other';
}

export function domainLabel(d) {
  return DOMAIN_LABELS[d] || 'Other';
}