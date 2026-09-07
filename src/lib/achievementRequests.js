// Frontend display helpers for the student achievement request flow.
// STATUS_LABELS are the STUDENT-FACING plain-English statuses — internal
// workflow values never surface to students.
export const STATUS_LABELS = {
  draft: 'Draft',
  submitted: 'Waiting on your teacher',
  under_review: 'Waiting on your teacher',
  changes_requested: 'Needs changes',
  verifier_signed: 'Waiting on approval',
  awaiting_second_approval: 'Waiting on approval',
  awaiting_external_verification: 'Waiting on approval',
  approved: 'Verified',
  minted: 'Verified',
  archived: 'Verified',
  rejected: 'Not approved',
  expired: 'Expired',
};

export const STATUS_BADGE_VARIANTS = {
  draft: 'secondary',
  submitted: 'info',
  under_review: 'info',
  changes_requested: 'warning',
  verifier_signed: 'secondary',
  awaiting_second_approval: 'warning',
  awaiting_external_verification: 'info',
  approved: 'success',
  minted: 'success',
  archived: 'success',
  rejected: 'destructive',
  expired: 'secondary',
};

export const TIER_LABELS = {
  1: 'Tier 1 — verifier sign-off',
  2: 'Tier 2 — verifier + admin',
  3: 'Tier 3 — + external verifier',
};

export const TIER_SHORT = { 1: 'Tier 1', 2: 'Tier 2', 3: 'Tier 3' };

export const METHOD_OPTIONS = [
  { value: 'witnessed_in_person', label: 'Witnessed in person' },
  { value: 'reviewed_evidence', label: 'Reviewed submitted evidence' },
  { value: 'official_records', label: 'Confirmed against official records' },
  { value: 'third_party', label: 'Confirmed with a third party' },
  { value: 'other', label: 'Other' },
];

export const ATTESTATION_TEXT = 'I confirm this achievement is accurate and I am authorised to verify it.';

export const CATEGORY_LABELS = {
  academic: 'Academic',
  sports: 'Sports',
  arts: 'Arts',
  leadership: 'Leadership',
  community: 'Community',
  behaviour: 'Behaviour',
  special: 'Special',
};