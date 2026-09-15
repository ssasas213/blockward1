import { base44 } from '@/api/base44Client';

/**
 * credentialEdits — the client mirror of the server's field split.
 *
 * ATTESTED fields are what a verifier signed: title, description, date,
 * category, organisation, evidence, team. PRESENTATION fields (cover image,
 * visibility, private notes) are never part of any attestation and are
 * always freely editable.
 *
 * The server enforces every rule — these lists drive the UI affordances only.
 */
export const ATTESTED_REQUEST_FIELDS = [
  'title', 'description', 'date_achieved', 'category',
  'evidence', 'is_team', 'my_team_role', 'team_participants',
  'nominated_verifier_email', 'credential_type_title', 'verification_tier',
];
export const PRESENTATION_REQUEST_FIELDS = ['image_url'];
export const ATTESTED_RECORD_FIELDS = ['title', 'description', 'date_achieved', 'category'];
export const PRESENTATION_RECORD_FIELDS = ['image_url', 'visibility', 'private_notes'];

export const FIELD_LABELS = {
  title: 'Title',
  description: 'Description',
  date_achieved: 'Date achieved',
  category: 'Category',
  image_url: 'Cover image',
  visibility: 'Visibility',
  private_notes: 'Private notes',
};

export const CATEGORY_LABELS = {
  academic: 'Academic', sports: 'Sports', arts: 'Arts', leadership: 'Leadership',
  community: 'Community', behaviour: 'Behaviour', special: 'Special',
};

/** Request states where a direct edit goes through the state-aware edit flow. */
export const DIRECT_EDITABLE_STATUSES = [
  'submitted', 'under_review', 'verifier_signed', 'awaiting_second_approval', 'awaiting_external_verification',
];

export async function credentialEdit(payload) {
  const res = await base44.functions.invoke('credentialEditAction', payload);
  return res.data;
}

/** Fetch the editable state of a verified credential (owner only). */
export function getCredentialState(verification_id) {
  return credentialEdit({ action: 'get_credential', verification_id });
}

/** The verifier's pending-correction queue. */
export function listCorrections() {
  return credentialEdit({ action: 'list_corrections' });
}