import React from 'react';
import { BadgeCheck } from 'lucide-react';
import InitialsAvatar from '@/components/ui/InitialsAvatar';
import { CATEGORY_STYLE, fmtDate } from '@/components/publicProfile/AchievementTile';

// Large hero treatment for the top pinned achievement — the 'showcase' layout.
export default function ShowcaseHero({ achievement, onOpen }) {
  const cat = CATEGORY_STYLE[achievement.category] || CATEGORY_STYLE.special;
  const date = fmtDate(achievement.date_delivered || achievement.date_approved || achievement.date_achieved);

  return (
    <button
      onClick={() => onOpen(achievement)}
      className="card-hover group block w-full overflow-hidden border border-border bg-card/60 text-left backdrop-blur-md"
      style={{ borderRadius: 'var(--pf-radius, 16px)', boxShadow: 'var(--pf-shadow, none)' }}
    >
      <div className="grid sm:grid-cols-2">
        <div className="relative aspect-[4/3] overflow-hidden sm:aspect-auto sm:min-h-[260px]">
          {achievement.image_url ? (
            <img
              src={achievement.image_url}
              alt={achievement.title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center" style={{ background: cat.grad }}>
              <cat.Icon className="h-20 w-20 text-white/80" />
            </div>
          )}
          <span className="absolute left-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-background/80 backdrop-blur-sm border border-success/40">
            <BadgeCheck className="h-4.5 w-4.5 text-success" />
          </span>
        </div>

        <div className="flex flex-col justify-center gap-3 p-6 sm:p-8">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">Top highlight</span>
          <h3 className="font-heading text-xl sm:text-2xl font-bold text-foreground leading-tight">{achievement.title}</h3>
          {achievement.description && (
            <p className="text-sm text-muted-foreground line-clamp-3">{achievement.description}</p>
          )}
          <div className="flex items-center gap-2">
            {achievement.organisation_logo ? (
              <img src={achievement.organisation_logo} alt="" className="h-5 w-5 rounded object-cover" />
            ) : (
              <InitialsAvatar name={achievement.organisation_name || '?'} size="xs" />
            )}
            <span className="text-xs font-medium text-foreground truncate">{achievement.organisation_name}</span>
            {achievement.participant_role && (
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">{achievement.participant_role}</span>
            )}
            {date && <span className="ml-auto text-[11px] text-tertiary whitespace-nowrap">{date}</span>}
          </div>
          <span className="text-xs text-tertiary">Verified · Permanently recorded</span>
        </div>
      </div>
    </button>
  );
}