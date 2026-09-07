// Frontend display helpers for the student achievement request flow.
export const STATUS_LABELS = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under review',
  changes_requested: 'Changes requested',
  verifier_signed: 'Verifier signed',
  awaiting_second_approval: 'Awaiting approval',
  awaiting_external_verification: 'External verification',
  approved: 'Approved',
  minted: 'Published',
  rejected: 'Rejected',
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