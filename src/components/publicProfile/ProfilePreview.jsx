import React from 'react';
import InitialsAvatar from '@/components/ui/InitialsAvatar';
import SocialLinks from '@/components/publicProfile/SocialLinks';
import { themeVars, bannerStyle } from '@/lib/profileThemes';

// Live mini render of the public profile — updates as the student changes
// options. The preview IS the feature: every iteration is another minute
// spent on the profile.
export default function ProfilePreview({ name, handle, bio, avatarUrl, value, achievements = [] }) {
  const vars = themeVars(value.theme_id, value.accent_colour, value.display_font);
  const hasBanner = !!value.banner_url || (value.theme_id && value.theme_id !== 'slate');
  const bs = bannerStyle(value.banner_url);
  const sample = achievements.slice(0, 4);
  const layout = value.profile_layout || 'grid';

  const Tile = ({ a, big }) => (
    <div className={`overflow-hidden rounded-lg border border-border bg-card ${big ? 'col-span-2 row-span-2' : ''}`}>
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
    <div className="overflow-hidden rounded-2xl border border-border bg-background" style={vars}>
      {/* Banner */}
      {hasBanner && (
        <div
          className={bs ? 'h-16' : 'h-10'}
          style={bs || { background: 'var(--pf-banner)' }}
        />
      )}

      <div className="p-4">
        <div className={`flex items-end gap-3 ${hasBanner && bs ? '-mt-8' : ''}`}>
          <div className="rounded-full bg-background p-0.5">
            <InitialsAvatar name={name || 'Student'} src={avatarUrl} size="lg" ring />
          </div>
          <div className="min-w-0 flex-1 pb-0.5">
            <p className="truncate font-heading text-base font-bold text-foreground">{name || 'Your name'}</p>
            <p className="truncate text-xs font-semibold text-primary">@{handle || 'handle'}</p>
          </div>
          <span className="rounded-lg border border-border bg-secondary/40 px-2 py-1 text-center">
            <span className="block text-sm font-bold leading-none text-foreground">{achievements.length}</span>
            <span className="block text-[8px] text-muted-foreground">verified</span>
          </span>
        </div>

        {bio && <p className="mt-2 whitespace-pre-line text-[11px] leading-relaxed text-muted-foreground line-clamp-3">{bio}</p>}

        <div className="mt-2.5">
          <SocialLinks links={value.social_links} />
        </div>

        {value.featured_link?.url && (
          <div
            className="mt-3 truncate rounded-lg bg-primary px-3 py-2 text-center text-[11px] font-semibold text-primary-foreground"
            style={{ borderRadius: 'calc(var(--pf-radius, 14px) - 2px)' }}
          >
            {value.featured_link.label || 'Featured link'} ↗
          </div>
        )}

        {/* Achievements in the chosen layout */}
        <div className="mt-3 border-t border-border pt-3">
          {layout === 'list' ? (
            <div className="space-y-1.5">
              {sample.map((a, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border border-border bg-card p-1.5">
                  <span className="h-7 w-7 flex-shrink-0 rounded-md bg-primary/15" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[10px] font-semibold text-foreground">{a.title}</span>
                    <span className="block truncate text-[8px] text-muted-foreground">{a.organisation_name}</span>
                  </span>
                  <span className="text-[8px] text-tertiary">✓</span>
                </div>
              ))}
              {sample.length === 0 && <p className="text-[10px] text-muted-foreground">Your verified achievements will appear as compact rows.</p>}
            </div>
          ) : layout === 'showcase' ? (
            <div className="grid grid-cols-2 gap-1.5">
              {sample[0] ? <Tile a={sample[0]} big /> : <div className="col-span-2 row-span-2 flex h-20 items-center justify-center rounded-lg border border-dashed border-border text-[10px] text-muted-foreground">Hero achievement</div>}
              {sample.slice(1, 3).map((a, i) => <Tile key={i} a={a} />)}
              {sample.length === 0 && <Tile />}{sample.length === 0 && <Tile />}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {sample.map((a, i) => <Tile key={i} a={a} />)}
              {sample.length === 0 && (
                <p className="col-span-3 py-4 text-center text-[10px] text-muted-foreground">Your verified achievements will appear here.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}