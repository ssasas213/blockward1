import React from 'react';
import { Star, BadgeCheck, Users } from 'lucide-react';
import AchievementTile from '@/components/publicProfile/AchievementTile';
import { CATEGORY_STYLE } from '@/components/publicProfile/AchievementTile';

const fmtDate = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
};

/**
 * ShowcaseHero — the 'showcase' profile layout: a large hero treatment for
 * the student's pinned highlights, best for a few standout achievements.
 */
export default function ShowcaseHero({ items, onOpen }) {
  if (!items?.length) return null;
  const [hero, ...rest] = items;
  const cat = CATEGORY_STYLE[hero.category] || CATEGORY_STYLE.special;
  const date = fmtDate(hero.date_delivered || hero.date_approved || hero.date_achieved);

  return (
    <section className="mt-10">
      <div className="flex items-center gap-2 mb-4">
        <Star className="h-4 w-4 text-primary fill-primary" />
        <h2 className="text-lg font-semibold text-foreground">Highlights</h2>
        <span className="text-xs text-tertiary">pinned by the student</span>
      </div>

      {/* Hero card */}
      <div
        className="grid md:grid-cols-2 rounded-2xl border border-border bg-card/60 backdrop-blur-md overflow-hidden"
        style={{ borderRadius: 'var(--pf-radius, 1rem)', boxShadow: 'var(--pf-shadow, none)' }}
      >
        <button onClick={() => onOpen(hero)} className="card-hover relative aspect-[16/10] md:aspect-auto md:min-h-[260px] w-full overflow-hidden text-left">
          {hero.image_url ? (
            <img src={hero.image_url} alt={hero.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center" style={{ background: cat.grad }}>
              <cat.Icon className="h-20 w-20 text-white/80" />
            </div>
          )}
          <span className="absolute top-3 right-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-background/80 backdrop-blur-sm border border-success/40">
            <BadgeCheck className="h-5 w-5 text-success" />
          </span>
        </button>
        <div className="p-6 sm:p-8 flex flex-col justify-center">
          <h3 className="font-heading text-xl sm:text-2xl font-bold text-foreground leading-tight">{hero.title}</h3>
          {hero.participant_role && (
            <span className="mt-3 inline-flex items-center gap-1.5 self-start px-2 py-1 rounded bg-primary/10 text-xs font-medium text-primary">
              <Users className="h-3.5 w-3.5" />{hero.participant_role}
            </span>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{hero.organisation_name}</span>
            {date && <><span>·</span><span>{date}</span></>}
          </div>
          {hero.endorsement_count > 0 && (
            <p className="mt-2 text-xs text-tertiary">
              {hero.endorsement_count} peer endorsement{hero.endorsement_count === 1 ? '' : 's'}
            </p>
          )}
        </div>
      </div>

      {/* Remaining pinned highlights */}
      {rest.length > 0 && (
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {rest.map((a) => (
            <AchievementTile key={a.registry_id} achievement={a} onClick={() => onOpen(a)} />
          ))}
        </div>
      )}
    </section>
  );
}