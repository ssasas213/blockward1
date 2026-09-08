import React from 'react';
import { BadgeCheck, Users } from 'lucide-react';
import InitialsAvatar from '@/components/ui/InitialsAvatar';
import { CATEGORY_STYLE } from '@/components/publicProfile/AchievementTile';

const fmtDate = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
};

/**
 * AchievementListRow — compact row for the 'list' profile layout, best for a
 * long verified record.
 */
export default function AchievementListRow({ achievement, onClick }) {
  const cat = CATEGORY_STYLE[achievement.category] || CATEGORY_STYLE.special;
  const date = fmtDate(achievement.date_delivered || achievement.date_approved || achievement.date_achieved);

  return (
    <button
      onClick={onClick}
      className="card-hover w-full flex items-center gap-3 sm:gap-4 rounded-xl border border-border bg-card/60 backdrop-blur-md p-3 text-left"
    >
      <div className="h-12 w-12 flex-shrink-0 rounded-lg overflow-hidden">
        {achievement.image_url ? (
          <img src={achievement.image_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center" style={{ background: cat.grad }}>
            <cat.Icon className="h-5 w-5 text-white/80" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold text-foreground truncate">{achievement.title}</h3>
        <div className="mt-0.5 flex items-center gap-2">
          <span className="text-xs text-muted-foreground truncate flex-1">{achievement.organisation_name}</span>
          {date && <span className="text-[11px] text-tertiary whitespace-nowrap">{date}</span>}
        </div>
      </div>
      {achievement.participant_role && (
        <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-[11px] font-medium text-primary">
          <Users className="h-3 w-3" />{achievement.participant_role}
        </span>
      )}
      <BadgeCheck className="h-4 w-4 text-success flex-shrink-0" />
    </button>
  );
}