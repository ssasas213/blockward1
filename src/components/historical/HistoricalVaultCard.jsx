import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Check, Circle, Send, X } from 'lucide-react';

const STATUS_META = {
  pending_review: { label: 'Pending Verification', cls: 'bg-amber-500/10 text-amber-600 border-amber-500/25' },
  info_requested: { label: 'More info requested', cls: 'bg-amber-500/10 text-amber-600 border-amber-500/25' },
  verifier_authorized: { label: 'Verifier reviewing', cls: 'bg-primary/10 text-primary border-primary/25' },
  decision_processing: { label: 'Finalising credential', cls: 'bg-primary/10 text-primary border-primary/25' },
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
  if (['verifier_authorized', 'decision_processing', 'verifier_confirmed', 'issued'].includes(s)) done.add('verifier_authorized');
  if (['verifier_confirmed', 'issued'].includes(s)) done.add('verifier_confirmed');
  if (s === 'issued') done.add('issued');
  if (s === 'issued' && !r.demo) done.add('anchored'); // real credentials anchor through the Polygon pipeline
  return done;
}

/** One historical verification in the student's Vault — clear status badge
 *  plus the six-stage progress timeline. Issuer verification and blockchain
 *  anchoring are NEVER merged into one misleading status. Demo credentials
 *  are always labelled DEMO. When the Super Admin review or the approved
 *  verifier asks for more information, the student answers right here. */
export default function HistoricalVaultCard({ req, onUpdated }) {
  const [local, setLocal] = useState(req);
  const [respondText, setRespondText] = useState('');
  const [responding, setResponding] = useState(false);
  const [respondError, setRespondError] = useState(null);

  const meta = STATUS_META[local.status] || STATUS_META.pending_review;
  const done = stagesFor(local);
  const failed = ['verifier_declined', 'verifier_rejected', 'rejected', 'withdrawn'].includes(local.status);
  const internalInfoNeeded = local.status === 'info_requested' && !!local.info_request;
  const verifierInfoNeeded = local.status === 'verifier_authorized' && !!local.verifier_info_request?.message;
  const needsResponse = internalInfoNeeded || verifierInfoNeeded;

  const submitResponse = async () => {
    const message = respondText.trim();
    if (!message || responding) return;
    setResponding(true);
    setRespondError(null);
    try {
      const res = await base44.functions.invoke('historicalStudentAction', {
        action: 'provide_info', request_id: local.id, message,
      });
      if (res.data?.ok) {
        setLocal((p) => ({ ...p, status: res.data.status, verifier_info_request: null }));
        setRespondText('');
        onUpdated?.();
      } else {
        setRespondError(res.data?.error || 'Could not send your response. Try again.');
      }
    } catch (e) {
      setRespondError(e?.message || 'Could not send your response. Try again.');
    } finally {
      setResponding(false);
    }
  };

  return (
    <div className={cn('rounded-xl border border-border bg-card/40 p-4 space-y-3', local.status === 'issued' && 'verified-glow')}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold', meta.cls)}>
          {local.status === 'issued' && <Check className="h-3 w-3" />} {meta.label}
        </span>
        {local.demo && (
          <span className="inline-flex items-center rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-warning">Demo</span>
        )}
        <span className="text-xs text-tertiary">{local.request_ref}</span>
      </div>
      <div>
        <p className="font-semibold text-foreground">{local.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {local.issuing_org} · Achieved {local.original_date}
          {local.decided_at && local.status === 'issued' && <> · Verified {String(local.decided_at).slice(0, 10)}</>}
          {local.status === 'issued' && !local.demo && <> · Anchored on Polygon</>}
        </p>
      </div>

      {verifierInfoNeeded && (
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2">
          <p className="text-xs text-foreground font-medium">The verifier asked: {local.verifier_info_request.message}</p>
        </div>
      )}
      {local.status === 'verifier_rejected' && local.review_rejected_reason && (
        <p className="text-xs text-muted-foreground">The verifier you nominated was not approved: {local.review_rejected_reason}</p>
      )}
      {local.status === 'verifier_declined' && local.decision_note && (
        <p className="text-xs text-muted-foreground">{local.verifier_name} could not verify: {local.decision_note}</p>
      )}
      {local.status === 'issued' && (
        <p className="text-xs text-muted-foreground">
          {local.demo
            ? <>Demo credential {local.demo_credential?.bw_id} — synthetic, never a real Blockward Verified credential.</>
            : <>Achievement earned {local.original_date}. Confirmed by the approved verifier and issued as Blockward credential <span className="text-foreground font-medium">{local.credential_bw_id}</span> later — history is never rewritten.</>}
        </p>
      )}

      {/* Answer an information request inline — internal review or the
          approved verifier's own question. */}
      {needsResponse && (
        <div className="space-y-2 rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2.5">
          <p className="text-xs text-foreground font-medium">
            {verifierInfoNeeded
              ? `The verifier asked: ${local.verifier_info_request.message}`
              : `Action needed: ${local.info_request}`}
          </p>
          <textarea
            value={respondText}
            onChange={(e) => setRespondText(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Write your response…"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-tertiary focus:outline-none focus:border-primary/40"
          />
          {respondError && <p className="text-xs text-destructive">{respondError}</p>}
          <div className="flex justify-end">
            <Button size="sm" variant="outline" disabled={responding || !respondText.trim()} onClick={submitResponse}>
              {responding ? 'Sending…' : <>Send response <Send className="h-3.5 w-3.5" /></>}
            </Button>
          </div>
        </div>
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