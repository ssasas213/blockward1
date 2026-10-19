import React from 'react';
import { Info } from 'lucide-react';

const Row = ({ label, value }) => (
  <div className="flex items-start justify-between gap-4 py-2.5 border-b border-border/60 last:border-0">
    <span className="text-xs font-medium text-tertiary flex-shrink-0 pt-0.5">{label}</span>
    <span className="text-sm text-foreground text-right break-words min-w-0">{value || '—'}</span>
  </div>
);

export default function StepReview({ draft, onSubmit, onBack, submitting }) {
  const categoryName = draft.category ? draft.category.charAt(0).toUpperCase() + draft.category.slice(1) : '—';

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-card/40 p-5">
        <Row label="Title" value={draft.title} />
        <Row label="Category" value={categoryName} />
        <Row label="Achievement date" value={draft.date_achieved} />
        <Row label="Awarding organisation" value={draft.org?.name || draft.suggested?.name || draft.issuer_org} />
        <Row label="Country" value={draft.country} />
        <Row label="Reference" value={draft.external_credential_id} />
        <Row label="Description" value={draft.description} />
        <Row label="Evidence" value={(draft.evidence || []).length ? `${draft.evidence.length} file(s), stored privately` : 'None attached'} />
      </div>

      <div className="flex items-start gap-2.5 rounded-lg border border-info/25 bg-info/5 p-4">
        <Info className="h-4 w-4 text-info mt-0.5 flex-shrink-0" />
        <div className="text-xs text-muted-foreground space-y-1">
          <p>
            Your achievement starts as <span className="text-foreground font-medium">unverified</span> — uploading a
            certificate never confers verification.
          </p>
          {draft.org && (
            <p>
              {draft.org.status === 'verified'
                ? `${draft.org.name} will review your claim and evidence. If they confirm it, your credential is issued and anchored.`
                : `${draft.org.name} is awaiting Blockward approval — your request will queue for them.`}
            </p>
          )}
          {draft.suggested && (
            <p>
              We've invited {draft.suggested.name} to join BlockWard. Your achievement is saved privately and
              becomes verifiable once they register.
            </p>
          )}
          <p>Privacy: everything stays in your personal archive until you choose to share it.</p>
        </div>
      </div>
    </div>
  );
}