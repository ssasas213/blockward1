import React from 'react';
import { BadgeCheck, Star } from 'lucide-react';
import InitialsAvatar from '@/components/ui/InitialsAvatar';
import GeneratedCover from '@/components/publicProfile/GeneratedCover';
import { fmtDate } from '@/components/publicProfile/AchievementTile';

/**
 * HighlightsRow — up to 6 achievements the student pinned to the top of
 * their profile, in one of three bounded styles: carousel (scrollable hero
 * cards), grid (even card grid) or spotlight (one large feature card with
 * the rest beneath it).
 */
export default function HighlightsRow({ items, onOpen, style = 'carousel' }) {
  if (!items?.length) return null;

  return (
    <section className="mt-10 pf-rise" style={{ '--pf-delay': '60ms' }}>
      <div className="flex items-center gap-2 mb-4">
        <Star className="h-4 w-4 text-primary fill-primary" />
        <h2 className="text-lg font-semibold text-foreground">Highlights</h2>
        <span className="text-xs text-tertiary">pinned by the student</span>
      </div>
      {style === 'grid' ? (
        <div className="pf-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {items.map((a) => (
            <HighlightCard key={a.registry_id} achievement={a} onOpen={onOpen} variant="grid" />
          ))}
        </div>
      ) : style === 'spotlight' ? (
        <>
          <HighlightCard achievement={items[0]} onOpen={onOpen} variant="hero" />
          {items.length > 1 && (
            <div className="pf-grid mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              {items.slice(1).map((a) => (
                <HighlightCard key={a.registry_id} achievement={a} onOpen={onOpen} variant="mini" />
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
          {items.map((a) => (
            <HighlightCard key={a.registry_id} achievement={a} onOpen={onOpen} variant="carousel" />
          ))}
        </div>
      )}
    </section>
  );
}

function HighlightCard({ achievement, onOpen, variant = 'carousel' }) {
  const date = fmtDate(achievement.date_delivered || achievement.date_approved || achievement.date_achieved);
  const sizeClass = variant === 'hero'
    ? 'w-full aspect-[21/9] max-w-none flex-shrink'
    : variant === 'mini'
      ? 'aspect-video w-full sm:min-w-0 flex-shrink'
      : 'aspect-video w-[86%] max-w-[560px] sm:w-auto sm:flex-1 sm:min-w-[300px] flex-shrink-0';

  return (
    <button
      onClick={() => onOpen(achievement)}
      className={`pf-tile card-hover group relative overflow-hidden rounded-xl border border-border text-left snap-start ${sizeClass}`}
    >
      <div className="absolute inset-0 transition-transform duration-200 group-hover:scale-[1.02]">
        {achievement.image_url ? (
          <img src={achievement.image_url} alt={achievement.title} className="h-full w-full object-cover" />
        ) : (
          <GeneratedCover
            bare
            compact
            title={achievement.title}
            category={achievement.category}
            orgName={achievement.organisation_name}
            orgLogo={achievement.organisation_logo}
          />
        )}
      </div>
      {/* Scrim — same treatment for light and dark cover photos */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" aria-hidden="true" />

      <span
        className="absolute top-3 right-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/45 border border-white/25"
        title="Verified by the issuing organisation"
      >
        <BadgeCheck className="h-4 w-4 text-white" />
      </span>

      <div className={`absolute inset-x-0 bottom-0 ${variant === 'mini' ? 'p-3' : 'p-4'}`}>
        <p className={`font-semibold leading-snug text-white line-clamp-1 drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)] ${variant === 'mini' ? 'text-sm' : 'text-base sm:text-lg'}`}>
          {achievement.title}
        </p>
        <div className="mt-1 flex items-center gap-1.5 min-w-0">
          {achievement.organisation_logo ? (
            <img src={achievement.organisation_logo} alt="" className="h-4 w-4 rounded-full object-cover flex-shrink-0" />
          ) : (
            <InitialsAvatar name={achievement.organisation_name || '?'} size="xs" />
          )}
          <span className="text-xs text-white/85 truncate flex-1">{achievement.organisation_name}</span>
          {date && <span className="text-xs text-white/60 whitespace-nowrap">{date}</span>}
        </div>
      </div>
    </button>
  );
}