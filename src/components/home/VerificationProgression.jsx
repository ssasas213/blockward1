import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IssuerMark, VerifierMark, IntegrityMark } from './StageMarks';

const STAGES = [
  { Mark: IssuerMark, label: 'Issuer', status: 'Verified' },
  { Mark: VerifierMark, label: 'Verifier', status: 'Signed' },
  { Mark: IntegrityMark, label: 'Integrity', status: 'Secured' },
];

function Stage({ Mark, label, status }) {
  return (
    <div className="flex items-center gap-2.5">
      <Mark className="h-6 w-6 shrink-0" />
      <div className="text-left leading-tight">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">{label}</p>
        <p className="mt-0.5 flex items-center gap-1 text-sm font-medium text-white">
          <Check className="h-3.5 w-3.5 text-[#93C5FD]" aria-hidden="true" />
          {status}
        </p>
      </div>
    </div>
  );
}

function Connector() {
  // Vertical on mobile, horizontal on desktop — one cohesive line that ties
  // the three stages into a single progression rather than three cards.
  return (
    <div aria-hidden="true" className="flex items-center justify-center py-0.5 md:py-0 md:px-5">
      <div className="h-5 w-px md:h-px md:w-10 bg-gradient-to-b md:bg-gradient-to-r from-white/0 via-[#2563EB]/40 to-white/0" />
    </div>
  );
}

/**
 * One cohesive verification progression: Issuer → Verifier → Integrity.
 * Sits on a single subtle dark band with a thin connector — never three
 * separate white cards.
 */
export default function VerificationProgression({ className }) {
  return (
    <div
      className={cn(
        'inline-flex flex-col items-start md:flex-row md:items-center',
        'rounded-2xl border border-white/[0.06] bg-white/[0.014]',
        'px-4 py-3 md:px-6 md:py-3.5',
        className
      )}
    >
      {STAGES.map((s, i) => (
        <React.Fragment key={s.label}>
          <Stage {...s} />
          {i < STAGES.length - 1 && <Connector />}
        </React.Fragment>
      ))}
    </div>
  );
}