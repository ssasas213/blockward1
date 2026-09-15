import React from 'react';
import InitialsAvatar from '@/components/ui/InitialsAvatar';
import SocialLinks from '@/components/publicProfile/SocialLinks';
import { publicProfileVars, bannerStyle, OPEN_TO_OPTIONS } from '@/lib/profileThemes';

// Live mini render of the public profile — updates as the student changes
// every option (hero layout, scheme, pattern, corners, card style, density,
// tagline, links). The preview IS the feature: every iteration is another
// minute spent on the profile.
export default function ProfilePreview({ name, handle, bio, avatarUrl, value, achievements = [] }) {
  const vars = publicProfileVars(value);
  const hero = value.hero_style || 'banner';
  const bs = bannerStyle(value.banner_url);
  const pattern = value.surface_pattern && value.surface_pattern !== 'none' ? value.surface_pattern : null;
  const schemeClass = value.forced_scheme === 'light' ? 'pf-scheme-light' : value.forced_scheme === 'dark' ? 'pf-scheme-dark' : '';
  const sample = achievements.slice(0, 4);
  const layout = value.profile_layout || 'grid';
  const tagline = value.tagline || '';
  const pronouns = value.pronouns || '';
  const openTo = (value.open_to || []).map((id) => OPEN_TO_OPTIONS.find((o) => o.id === id)).filter(Boolean).slice(0, 3);
  const customLinks = Array.isArray(value.custom_links) ? value.custom_links.filter((l) => l.url).slice(0, 4) : [];

  const showCover = hero === 'fullbleed' || ((hero === 'banner') && (bs || (value.theme_id && value.theme_id !== 'slate')));
  const overCover = hero === 'banner' && showCover && bs;
  const glass = hero === 'fullbleed';

  const Tile = ({ a, big }) => (
    <div className={`pf-tile overflow-hidden rounded-lg border border-border bg-card ${big ? 'col-span-2 row-span-2' : ''}`}>
      <div className={`${big ? 'aspect-[2/1]' : 'aspect-square'} w-full overflow-hidden`}>
        {a?.image_url ? (
          <img src={a.image_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-primary/15" />
        )}
      </div>
      {big && <p className="truncate px-2 py-1.5 text-[10px] font-semibold text-foreground">{a?.title}</p>}
    </div>
  );

  return (
    <div
      className={`pf-page relative overflow-hidden rounded-2xl border border-border bg-background ${schemeClass}`}
      data-cardstyle={value.card_style || 'elevated'}
      data-density={value.card_density || 'comfortable'}
      style={vars}
    >
      {pattern && <div className={`pf-pattern pf-pattern-${pattern}`} aria-hidden="true" />}

      {/* Cover */}
      {showCover && (
        <div
          className={hero === 'fullbleed' ? 'h-24' : 'h-16'}
          style={bs || { background: 'var(--pf-banner)' }}
        />
      )}

      <div className="relative z-10 p-4">
        {/* Identity */}
        <div className={`flex items-end gap-3 ${overCover ? '-mt-8' : glass ? '-mt-10' : ''}`}>
          <div className={`rounded-full bg-background p-0.5 ${glass ? 'opacity-90' : ''}`}>
            <InitialsAvatar name={name || 'Student'} src={avatarUrl} size="lg" ring />
          </div>
          <div className={`min-w-0 flex-1 pb-0.5 ${glass ? 'rounded-lg bg-[#0B0A10]/85 px-2 py-1.5 backdrop-blur-sm' : ''}`}>
            <p className={`truncate font-heading text-base font-bold ${glass ? 'text-white' : 'text-foreground'}`}>{name || 'Your name'}</p>
            {tagline && <p className={`truncate text-[10px] font-medium ${glass ? 'text-white/85' : 'text-muted-foreground'}`}>{tagline}</p>}
            <p className={`truncate text-xs font-semibold ${glass ? 'text-white/85' : 'text-primary'}`}>
              @{handle || 'handle'}{pronouns && <span className={`ml-1 font-normal ${glass ? 'text-white/60' : 'text-muted-foreground'}`}>{pronouns}</span>}
            </p>
          </div>
          <span className={`pf-tile rounded-lg border border-border bg-secondary/40 px-2 py-1 text-center ${glass ? 'opacity-0' : ''}`}>
            <span className="block text-sm font-bold leading-none text-foreground">{achievements.length}</span>
            <span className="block text-[8px] text-muted-foreground">verified</span>
          </span>
        </div>

        {hero === 'split' && (
          <div
            className="pf-tile mt-3 h-14 rounded-lg border border-border shadow-sm"
            style={bs || { background: 'var(--pf-banner)' }}
          />
        )}

        {bio && <p className="mt-2 whitespace-pre-line text-[11px] leading-relaxed text-muted-foreground line-clamp-3">{bio}</p>}

        {openTo.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {openTo.map((o) => (
              <span key={o.id} className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[9px] font-semibold text-primary">
                {o.label}
              </span>
            ))}
          </div>
        )}

        <div className="mt-2.5">
          <SocialLinks links={value.social_links} />
        </div>

        {value.featured_link?.url && (
          <div
            className="mt-3 truncate px-3 py-2 text-center text-[11px] font-semibold"
            style={{
              borderRadius: 'calc(var(--pf-btn-radius, 10px) - 2px)',
              background: 'var(--pf-accent-grad, hsl(var(--primary)))',
              color: 'var(--pf-accent-grad-fg, hsl(var(--primary-foreground)))',
            }}
          >
            {value.featured_link.label || 'Featured link'} ↗
          </div>
        )}

        {customLinks.length > 0 && (
          <div className="mt-2 space-y-1">
            {customLinks.map((l, i) => (
              <div key={i} className="pf-tile flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5">
                <span className="h-4 w-4 flex-shrink-0 rounded-sm bg-primary/15" />
                <span className="truncate text-[10px] font-medium text-foreground">{l.label || 'Link'}</span>
              </div>
            ))}
          </div>
        )}

        {/* Achievements in the chosen layout */}
        <div className="pf-grid mt-3 grid grid-cols-3 gap-1.5 border-t border-border pt-3">
          {layout === 'showcase' ? (
            <>
              {sample[0] ? <Tile a={sample[0]} big /> : <div className="col-span-2 row-span-2 flex h-20 items-center justify-center rounded-lg border border-dashed border-border text-[10px] text-muted-foreground">Hero achievement</div>}
              {sample.slice(1, 3).map((a, i) => <Tile key={i} a={a} />)}
              {sample.length === 0 && <Tile />}{sample.length === 0 && <Tile />}
            </>
          ) : (
            <>
              {sample.map((a, i) => <Tile key={i} a={a} />)}
              {sample.length === 0 && (
                <p className="col-span-3 py-4 text-center text-[10px] text-muted-foreground">Your verified achievements will appear here.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}