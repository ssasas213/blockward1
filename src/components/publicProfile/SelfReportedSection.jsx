import React from 'react';
import { AlertTriangle, Clock } from 'lucide-react';
import { domainLabel } from '@/lib/achievementDomains';

const fmtDate = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
};

/**
 * SelfReportedSection — the visually distinct "Unverified — pending
 * verification" section on the public profile. Anything the student added
 * themselves that hasn't been verified by an organisation yet.
 */
export default function SelfReportedSection({ items }) {
  if (!items?.length) return null;

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-center gap-2 mb-1.5">
        <h2 className="text-lg font-semibold text-foreground">Self-reported</h2>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-warning/10 text-warning border border-warning/30">
          <AlertTriangle className="h-3.5 w-3.5" />
          Unverified — pending verification
        </span>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Added by the student themselves. These become verified credentials once an organisation confirms them.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((s) => (
          <div
            key={s.id}
            className="rounded-xl border border-dashed border-warning/40 bg-warning/5 p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground leading-snug">{s.title}</h3>
              {s.status === 'verification_requested' ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-info whitespace-nowrap">
                  <Clock className="h-3 w-3" /> in review
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-warning whitespace-nowrap">
                  <AlertTriangle className="h-3 w-3" /> unverified
                </span>
              )}
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="px-1.5 py-0.5 rounded bg-muted text-[11px]">{domainLabel(s.domain)}</span>
              {s.date_achieved && <span className="text-tertiary">{fmtDate(s.date_achieved)}</span>}
            </div>
            {s.description && (
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed line-clamp-2">{s.description}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}