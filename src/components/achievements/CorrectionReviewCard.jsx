import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowRight, History, PenLine, XCircle } from 'lucide-react';

const FIELDS = [
  { key: 'title', label: 'Title' },
  { key: 'description', label: 'Description' },
  { key: 'date_achieved', label: 'Date achieved' },
  { key: 'category', label: 'Category' },
];

const preview = (v) => {
  if (v === null || v === undefined || v === '') return '(empty)';
  const s = String(v);
  return s.length > 80 ? `${s.slice(0, 80)}…` : s;
};

/**
 * CorrectionReviewCard — a pending correction on a VERIFIED credential in
 * the verifier's queue. Shows exactly what changed (old → new), the
 * student's reason, and the two honest actions: re-sign the corrected
 * version (approving publishes version N+1 — the original is retained and
 * visible in the history) or decline with a reason.
 */
export default function CorrectionReviewCard({ correction, onApprove, onDecline, busy }) {
  const changed = FIELDS.filter(
    (f) => (correction[`proposed_${f.key}`] ?? null) !== (correction[`current_${f.key}`] ?? null)
  );

  return (
    <Card className="border-primary/30 bg-card shadow-sm">
      <CardContent className="p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold text-foreground">Correction: {correction.current_title}</h3>
          <Badge variant="outline" className="gap-1">
            <History className="h-3 w-3" /> Verified credential
          </Badge>
          {correction.is_original_verifier
            ? <Badge variant="secondary">You verified this</Badge>
            : <Badge variant="secondary">Original verifier unavailable</Badge>}
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {correction.student_name} ·{' '}
          {correction.requested_at && `requested ${new Date(correction.requested_at).toLocaleDateString('en-GB')}`}
          {correction.verification_id && ` · ${correction.verification_id}`}
        </p>

        {correction.reason && (
          <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-xs font-semibold text-tertiary uppercase tracking-wide">Student's reason</p>
            <p className="text-sm text-foreground mt-1">{correction.reason}</p>
          </div>
        )}

        <div className="mt-3 space-y-2">
          {changed.map((f) => (
            <div key={f.key} className="rounded-lg border border-border p-3">
              <p className="text-[11px] font-medium text-tertiary uppercase tracking-wide">{f.label}</p>
              <div className="mt-1 flex items-start gap-2 text-sm break-words min-w-0">
                <p className="text-muted-foreground line-through flex-1 min-w-0">{preview(correction[`current_${f.key}`])}</p>
                <ArrowRight className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-1" />
                <p className="text-foreground font-medium flex-1 min-w-0">{preview(correction[`proposed_${f.key}`])}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
          Approving re-signs the corrected details and publishes version 2 — the original is kept in the
          version history on the public verification page. Nothing is hidden.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={onApprove} disabled={busy}>
            <PenLine className="h-4 w-4 mr-1.5" /> Review & re-sign
          </Button>
          <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={onDecline} disabled={busy}>
            <XCircle className="h-4 w-4 mr-1.5" /> Decline
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}