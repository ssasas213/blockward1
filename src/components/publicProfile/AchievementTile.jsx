import React from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, Trophy, Medal, Star, Sparkles, Heart, Users } from 'lucide-react';
import InitialsAvatar from '@/components/ui/InitialsAvatar';

export const CATEGORY_STYLE = {
  academic: { Icon: Medal, grad: 'linear-gradient(135deg, #8B5CF6, #6366F1)' },
  sports: { Icon: Trophy, grad: 'linear-gradient(135deg, #10B981, #059669)' },
  arts: { Icon: Star, grad: 'linear-gradient(135deg, #EC4899, #F472B6)' },
  leadership: { Icon: Sparkles, grad: 'linear-gradient(135deg, #8B5CF6, #EC4899)' },
  community: { Icon: Heart, grad: 'linear-gradient(135deg, #F59E0B, #F97316)' },
  behaviour: { Icon: Users, grad: 'linear-gradient(135deg, #64748B, #475569)' },
  special: { Icon: BadgeCheck, grad: 'linear-gradient(135deg, #6366F1, #8B5CF6)' },
};

export const fmtDate = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
};

/**
 * AchievementTile — one verified credential in the public profile grid.
 */
export default function AchievementTile({ achievement, onClick }) {
  const cat = CATEGORY_STYLE[achievement.category] || CATEGORY_STYLE.special;
  const date = fmtDate(achievement.date_delivered || achievement.date_approved || achievement.date_achieved);

  return (
    <button
      onClick={onClick}
      className="card-hover group w-full text-left rounded-xl overflow-hidden border border-border bg-card/60 backdrop-blur-md"
    >
      <div className="relative aspect-square w-full overflow-hidden">
        {achievement.image_url ? (
          <img src={achievement.image_url} alt={achievement.title} className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center" style={{ background: cat.grad }}>
            <cat.Icon className="h-14 w-14 text-white/80" />
          </div>
        )}
        <span className="absolute top-2 right-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-background/80 backdrop-blur-sm border border-success/40">
          <BadgeCheck className="h-4 w-4 text-success" />
        </span>
      </div>

      <div className="p-3.5">
        <h3 className="text-sm font-semibold text-foreground leading-snug line-clamp-2">{achievement.title}</h3>
        <div className="mt-2 flex items-center gap-2">
          {achievement.organisation_logo ? (
            <img src={achievement.organisation_logo} alt="" className="h-4 w-4 rounded object-cover" />
          ) : (
            <InitialsAvatar name={achievement.organisation_name || '?'} size="xs" />
          )}
          <span className="text-xs text-muted-foreground truncate flex-1">{achievement.organisation_name}</span>
          {date && <span className="text-[11px] text-tertiary whitespace-nowrap">{date}</span>}
        </div>
        {(achievement.participant_role || achievement.team_slug) && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {achievement.participant_role && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-[11px] font-medium text-primary">
                <Users className="h-3 w-3" />{achievement.participant_role}
              </span>
            )}
            {achievement.team_slug && (
              <Link
                to={`/team/${achievement.team_slug}`}
                onClick={(e) => e.stopPropagation()}
                className="text-[11px] text-muted-foreground hover:text-primary hover:underline"
              >
                Team record →
              </Link>
            )}
          </div>
        )}
      </div>
    </button>
  );
}