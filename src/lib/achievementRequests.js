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
  awaiting_external_verification: 'Waiting on your verifier',
  approved: 'Verified',
  minted: 'Verified',
  archived: 'Verified',
  rejected: 'Not approved',
  expired: 'Expired',
  withdrawn: 'Withdrawn',
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
  withdrawn: 'secondary',
};

// Roles an independent verifier can hold — the fixed whitelist the backend
// enforces on submit.
export const INDEPENDENT_ROLE_OPTIONS = [
  { value: 'coach', label: 'Coach' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'instructor', label: 'Instructor' },
  { value: 'examiner', label: 'Examiner' },
  { value: 'referee', label: 'Referee' },
  { value: 'club_official', label: 'Club official' },
  { value: 'event_organiser', label: 'Event organiser' },
  { value: 'employer', label: 'Employer' },
  { value: 'mentor', label: 'Mentor' },
  { value: 'other', label: 'Other' },
];

export const TIER_LABELS = {
  1: 'Tier 1 — verifier sign-off',
  2: 'Tier 2 — verifier + admin',
  3: 'Tier 3 — + external verifier',
};

export const TIER_SHORT = { 1: 'Tier 1', 2: 'Tier 2', 3: 'Tier 3' };

// What happens AFTER the nominated verifier signs — tier-accurate so a
// teacher always knows whether their signature completes the credential or
// hands it to the next approver. Never simplify the approval chain in the UI.
export function signOffOutcome(tier) {
  if (tier === 2) {
    return "After your signature, this request moves to your organisation's approver for the second approval — it is not published yet.";
  }
  if (tier === 3) {
    return "After your signature, your organisation's approver reviews it, then an external verifier is emailed a one-time confirmation link.";
  }
  return "On sign-off the credential is published straight to the student's profile.";
}

// Success toast for a completed sign-off — matches the real next step.
export function signOffSuccessMessage(tier) {
  if (tier === 2) return "Signed off — waiting for your organisation's approver";
  if (tier === 3) return "Signed off — waiting for your organisation's approver, then the external verifier";
  return "Signed off — published to the student's profile";
}

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