import React from 'react';
import InitialsAvatar from '@/components/ui/InitialsAvatar';
import { Quote } from 'lucide-react';

const fmt = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
};

/**
 * EndorsementList — the full list behind an endorsement count. Endorsements
 * are never anonymous: each row shows the endorser's name, handle and
 * affiliation alongside their first-hand text.
 */
export default function EndorsementList({ endorsements, showAchievementTitle }) {
  if (!endorsements?.length) return null;
  return (
    <div className="space-y-3">
      {endorsements.map((e) => (
        <div key={e.id} className="rounded-xl border border-border bg-background/40 p-3.5">
          <div className="flex items-center gap-2.5">
            <InitialsAvatar name={e.endorser?.name || e.endorser_name || '?'} size="xs" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">
                {e.endorser?.name || e.endorser_name}
                {e.endorser?.handle && <span className="text-primary font-normal"> @{e.endorser.handle}</span>}
              </p>
              <p className="text-[11px] text-tertiary truncate">{e.endorser?.affiliation}</p>
            </div>
            {fmt(e.created_date) && <span className="text-[11px] text-tertiary whitespace-nowrap">{fmt(e.created_date)}</span>}
          </div>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed flex gap-2">
            <Quote className="h-3 w-3 text-primary flex-shrink-0 mt-1" />
            {e.text}
          </p>
          {showAchievementTitle && (
            <p className="text-xs text-tertiary mt-1.5">on {e.achievement_title}</p>
          )}
        </div>
      ))}
    </div>
  );
}