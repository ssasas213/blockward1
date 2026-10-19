import React from 'react';
import { cn } from '@/lib/utils';
import { Check, Circle, X } from 'lucide-react';

const STATUS_META = {
  pending_review: { label: 'Pending Verification', cls: 'bg-amber-500/10 text-amber-600 border-amber-500/25' },
  info_requested: { label: 'More info requested', cls: 'bg-amber-500/10 text-amber-600 border-amber-500/25' },
  verifier_authorized: { label: 'Verifier reviewing', cls: 'bg-primary/10 text-primary border-primary/25' },
  verifier_confirmed: { label: 'Confirmed', cls: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25' },
  verifier_declined: { label: 'Verifier could not confirm', cls: 'bg-destructive/10 text-destructive border-destructive/25' },
  verifier_rejected: { label: 'Verifier not approved', cls: 'bg-destructive/10 text-destructive border-destructive/25' },
  rejected: { label: 'Rejected', cls: 'bg-destructive/10 text-destructive border-destructive/25' },
  issued: { label: 'Blockward Verified', cls: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25' },
  withdrawn: { label: 'Withdrawn', cls: 'bg-secondary text-muted-foreground border-border' },
};

const STAGES = [
  { key: 'submitted', label: 'Achievement submitted' },
  { key: 'super_admin', label: 'Super Admin review' },
  { key: 'verifier_authorized', label: 'Verifier authorised' },
  { key: 'verifier_confirmed', label: 'Verifier confirmation' },
  { key: 'issued', label: 'Credential issued' },
  { key: 'anchored', label: 'Blockchain anchored' },
];

function stagesFor(r) {
  const s = r.status;
  const done = new Set(['submitted']);
  if (!['pending_review', 'info_requested', 'withdrawn', 'rejected'].includes(s)) done.add('super_admin');
  if (['verifier_authorized', 'verifier_confirmed', 'issued'].includes(s)) done.add('verifier_authorized');
  if (['verifier_confirmed', 'issued'].includes(s)) done.add('verifier_confirmed');
  if (s === 'issued') done.add('issued');
  if (s === 'issued' && !r.demo) done.add('anchored'); // real credentials anchor through the Polygon pipeline
  return done;
}

/** One historical verification in the student's Vault — clear status badge
 *  plus the six-stage progress timeline. Issuer verification and blockchain
 *  anchoring are NEVER merged into one misleading status. Demo credentials
 *  are always labelled DEMO. */
export default function HistoricalVaultCard({ req }) {
  const meta = STATUS_META[req.status] || STATUS_META.pending_review;
  const done = stagesFor(req);
  const failed = ['verifier_declined', 'verifier_rejected', 'rejected', 'withdrawn'].includes(req.status);
  return (
    <div className={cn('rounded-xl border border-border bg-card/40 p-4 space-y-3', req.status === 'issued' && 'verified-glow')}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold', meta.cls)}>
          {req.status === 'issued' && <Check className="h-3 w-3" />} {meta.label}
        </span>
        {req.demo && (
          <span className="inline-flex items-center rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-warning">Demo</span>
        )}
        <span className="text-xs text-tertiary">{req.request_ref}</span>
      </div>
      <div>
        <p className="font-semibold text-foreground">{req.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {req.issuing_org} · Achieved {req.original_date}
          {req.decided_at && req.status === 'issued' && <> · Verified {String(req.decided_at).slice(0, 10)}</>}
          {req.status === 'issued' && !req.demo && <> · Anchored on Polygon</>}
        </p>
      </div>

      {req.status === 'info_requested' && req.info_request && (
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2">
          <p className="text-xs text-foreground font-medium">Action needed: {req.info_request}</p>
        </div>
      )}
      {req.status === 'verifier_rejected' && req.review_rejected_reason && (
        <p className="text-xs text-muted-foreground">The verifier you nominated was not approved: {req.review_rejected_reason}</p>
      )}
      {req.status === 'verifier_declined' && req.decision_note && (
        <p className="text-xs text-muted-foreground">{req.verifier_name} could not verify: {req.decision_note}</p>
      )}
      {req.status === 'issued' && (
        <p className="text-xs text-muted-foreground">
          {req.demo
            ? <>Demo credential {req.demo_credential?.bw_id} — synthetic, never a real Blockward Verified credential.</>
            : <>Achievement earned {req.original_date}. Confirmed by the approved verifier and issued as Blockward credential <span className="text-foreground font-medium">{req.credential_bw_id}</span> later — history is never rewritten.</>}
        </p>
      )}

      {/* Progress timeline */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-1">
        {STAGES.map((st) => {
          const isDone = done.has(st.key);
          const isBlocked = failed && !isDone;
          return (
            <div key={st.key} className="flex items-center gap-1.5">
              {isDone ? <Check className="h-3.5 w-3.5 text-success flex-shrink-0" />
                : isBlocked ? <X className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
                : <Circle className="h-3.5 w-3.5 text-muted-foreground/40 flex-shrink-0" />}
              <span className={cn('text-[11px] leading-tight', isDone ? 'text-foreground font-medium' : 'text-muted-foreground/60')}>{st.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}