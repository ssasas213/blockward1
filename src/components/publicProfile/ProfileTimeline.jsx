import React from 'react';
import { Quote } from 'lucide-react';

const fmtDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

/**
 * ProfileTimeline — achievements shown chronologically, spanning every
 * organisation, newest first. One row per achievement with its date, org
 * and endorsement count.
 */
export default function ProfileTimeline({ achievements, onOpen }) {
  const sorted = [...achievements].sort((a, b) =>
    new Date(b.date_achieved || b.date_delivered || b.date_approved || 0) -
    new Date(a.date_achieved || a.date_delivered || a.date_approved || 0)
  );

  return (
    <div className="relative border-l-2 border-border ml-2 space-y-7 py-1">
      {sorted.map((a) => {
        const date = fmtDate(a.date_achieved || a.date_delivered || a.date_approved);
        return (
          <div key={a.registry_id} className="relative pl-6">
            <span className="absolute -left-[8px] top-1.5 h-3 w-3 rounded-full bg-primary border-2 border-background shadow-glow" />
            <button onClick={() => onOpen(a)} className="text-left w-full group">
              <p className="text-[11px] text-tertiary">
                {date && <span>{date}</span>}
                {a.organisation_name && <span> · {a.organisation_name}</span>}
              </p>
              <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{a.title}</p>
              {a.endorsement_count > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                  <Quote className="h-3 w-3 text-primary" />
                  {a.endorsement_count} peer endorsement{a.endorsement_count === 1 ? '' : 's'}
                </p>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}