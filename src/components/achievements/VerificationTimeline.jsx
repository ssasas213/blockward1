import React from 'react';
import { cn } from '@/lib/utils';
import { Check, Dot } from 'lucide-react';
import { formatDateTime } from '@/lib/achievementStatus';
import { hasVerifiedIntegrity } from '@/lib/credentialIntegrity';

const EVENT_LABELS = {
  created: 'Achievement created',
  verification_requested: 'Verification requested',
  opened: 'Issuer opened request',
  signed: 'Verifier signed',
  threshold_reached: 'All required signatures complete',
  confirmed: 'Issuer verification complete',
  issuer_confirmed: 'Issuer verification complete',
  blockchain_started: 'Credential commitment submitted to Polygon Amoy',
  blockchain_confirmed: 'Transaction confirmed on-chain',
  blockchain_failed: 'Blockchain confirmation failed',
  integrity_mismatch: 'Integrity check failed — content drift detected',
  revoked: 'Credential revoked',
  declined: 'Issuer could not verify',
};

/**
 * Builds a provenance timeline ONLY from real stored audit events across the
 * achievement, verification request and credential event logs. No event is
 * fabricated. Duplicates (the same lifecycle step logged in two places) are
 * de-duplicated by label, keeping the earliest timestamp.
 */
export default function VerificationTimeline({ item }) {
  const a = item || {};
  const events = [];
  const push = (label, ts, done) => {
    if (!ts && !done) return;
    events.push({ label, ts: ts ? new Date(ts).getTime() : (done ? Date.now() : null), done });
  };

  const seen = new Set();
  const add = (label, ts) => {
    if (seen.has(label) || !ts) return;
    seen.add(label);
    events.push({ label, ts: new Date(ts).getTime(), done: true });
  };

  const collect = (log) => (Array.isArray(log) ? log : []).forEach((e) => {
    const label = EVENT_LABELS[e.event] || (e.event ? e.event.charAt(0).toUpperCase() + e.event.slice(1).replace(/_/g, ' ') : null);
    if (label) add(label, e.timestamp);
  });

  collect(a.event_log);
  collect(a.request?.event_log);
  collect(a.credential?.event_log);

  // Integrity confirmed as the terminal step when chain_check is confirmed.
  if (hasVerifiedIntegrity(a.credential)) {
    add('Integrity confirmed', a.credential.chain_check.checked_at);
  }
  if (a.credential?.anchor_status === 'confirmed' && a.credential?.blockchain?.block_timestamp) {
    add('Transaction confirmed on-chain', a.credential.blockchain.block_timestamp);
  }

  events.sort((x, y) => (x.ts || 0) - (y.ts || 0));

  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">No provenance events recorded yet.</p>;
  }

  return (
    <ol className="relative space-y-4">
      {events.map((e, i) => {
        const isLast = i === events.length - 1;
        const terminal = e.label === 'Integrity confirmed' || e.label === 'Blockward Verified';
        return (
          <li key={i} className="relative pl-6">
            {i < events.length - 1 && (
              <span className="absolute left-[7px] top-4 bottom-[-1rem] w-px bg-border" />
            )}
            <span className={cn(
              'absolute left-0 top-1 h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center',
              terminal ? 'border-success bg-success/20' : 'border-primary bg-primary/15'
            )}>
              {terminal && <Check className="h-2 w-2 text-success" />}
            </span>
            <p className={cn('text-sm leading-tight', terminal ? 'font-semibold text-success' : 'text-foreground')}>{e.label}</p>
            <p className="text-xs text-tertiary">{formatDateTime(e.ts ? new Date(e.ts).toISOString() : null)}</p>
            {terminal && isLast && (
              <p className="text-xs font-semibold text-success mt-1">BLOCKWARD VERIFIED</p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
