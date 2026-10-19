import React from 'react';
import { CATEGORY_LABELS } from './StepHDetails';

/** Step 5 — Review & submit. Shows the complete summary and the exact
 *  approval path the request will follow, so nothing is surprising. */
export default function StepHReview({ draft, submitting, onSubmit }) {
  const Row = ({ label, value }) => (
    <div className="flex flex-col sm:flex-row sm:gap-4 py-2 border-b border-border/60 last:border-0">
      <span className="text-xs font-medium text-tertiary w-44 flex-shrink-0">{label}</span>
      <span className="text-sm text-foreground break-words">{value || '—'}</span>
    </div>
  );
  const evidenceCount = (draft.evidence || []).length;
  return (
    <div className="space-y-5">
      <div>
        <p className="section-heading mb-1">Achievement</p>
        <Row label="Title" value={draft.title} />
        <Row label="Category" value={CATEGORY_LABELS[draft.category] || draft.category} />
        <Row label="Description" value={draft.description} />
        <Row label="Original date" value={draft.original_date} />
        <Row label="Issuing organisation" value={draft.issuing_org} />
        <Row label="Country" value={draft.country} />
        <Row label="Certificate reference" value={draft.certificate_ref} />
        <Row label="Evidence" value={`${evidenceCount} item${evidenceCount === 1 ? '' : 's'} (private)`} />
      </div>
      <div>
        <p className="section-heading mb-1">Your professional profile</p>
        <Row label="Full name" value={draft.profile_full_name} />
        <Row label="LinkedIn" value={draft.linkedin_url} />
        <Row label="Website" value={draft.personal_website} />
      </div>
      <div>
        <p className="section-heading mb-1">Proposed verifier</p>
        <Row label="Name" value={draft.verifier_name} />
        <Row label="Email" value={draft.verifier_email} />
        <Row label="Role" value={draft.verifier_role} />
        <Row label="Organisation" value={draft.verifier_org} />
        <Row label="LinkedIn" value={draft.verifier_linkedin} />
        <Row label="Relationship" value={draft.verifier_relationship} />
        <Row label="Claimed authority" value={draft.verifier_authority_claim} />
      </div>
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
        <p className="text-sm font-semibold text-foreground">What happens after you submit</p>
        <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
          <li>The achievement is saved in your private Vault as <span className="text-foreground font-medium">Pending Verification</span> — it is <span className="text-foreground font-medium">not verified</span>.</li>
          <li>A Blockward Super Admin reviews the proposed verifier with independent checks before authorising them.</li>
          <li>The approved verifier receives a secure, single-use link and must confirm the achievement themselves.</li>
          <li>Only then is a Blockward Verified credential issued, anchored to the blockchain, and placed in your Vault.</li>
        </ol>
      </div>
      <button
        type="button" onClick={onSubmit} disabled={submitting}
        className="w-full h-11 rounded-full text-sm font-semibold text-white bg-primary hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {submitting ? 'Submitting…' : 'Submit for verification'}
      </button>
      <p className="text-center text-xs text-tertiary">
        Import is not verification. Blockward Verified is only granted after the full two-stage process above.
      </p>
    </div>
  );
}