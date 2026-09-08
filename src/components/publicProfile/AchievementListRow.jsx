import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { BadgeCheck } from 'lucide-react';
import InitialsAvatar from '@/components/ui/InitialsAvatar';
import { CATEGORY_STYLE, fmtDate } from '@/components/publicProfile/AchievementTile';

// Compact row — the 'list' layout, best for a long verified record.
export default function AchievementListRow({ achievement, onClick }) {
  const cat = CATEGORY_STYLE[achievement.category] || CATEGORY_STYLE.special;
  const date = fmtDate(achievement.date_delivered || achievement.date_approved || achievement.date_achieved);

  return (
    <button
      onClick={onClick}
      className="card-hover flex w-full items-center gap-3 border border-border bg-card/60 p-3 text-left backdrop-blur-md"
      style={{ borderRadius: 'calc(var(--pf-radius, 16px) - 2px)' }}
    >
      <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg">
        {achievement.image_url ? (
          <img src={achievement.image_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center" style={{ background: cat.grad }}>
            <cat.Icon className="h-6 w-6 text-white/80" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-semibold text-foreground">{achievement.title}</h3>
        <div className="mt-0.5 flex items-center gap-1.5">
          {achievement.organisation_logo ? (
            <img src={achievement.organisation_logo} alt="" className="h-3.5 w-3.5 rounded object-cover" />
          ) : (
            <InitialsAvatar name={achievement.organisation_name || '?'} size="xs" />
          )}
          <span className="truncate text-xs text-muted-foreground">
            {achievement.organisation_name}
            {achievement.participant_role ? ` · ${achievement.participant_role}` : ''}
          </span>
          {achievement.team_slug && (
            <RouterLink to={`/team/${achievement.team_slug}`} onClick={(e) => { e.stopPropagation(); }} className="text-[11px] text-muted-foreground hover:text-primary hover:underline">
              Team record →
            </RouterLink>
          )}
        </div>
      </div>

      <div className="flex flex-shrink-0 flex-col items-end gap-1">
        {date && <span className="text-[11px] text-tertiary whitespace-nowrap">{date}</span>}
        <BadgeCheck className="h-4 w-4 text-success" />
      </div>
    </button>
  );
}