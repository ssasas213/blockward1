import React from 'react';
import InitialsAvatar from '@/components/ui/InitialsAvatar';
import AchievementTile from '@/components/publicProfile/AchievementTile';
import AchievementListRow from '@/components/publicProfile/AchievementListRow';
import SocialLinks from '@/components/publicProfile/SocialLinks';
import FeaturedLink from '@/components/publicProfile/FeaturedLink';
import { themeVars, bannerStyle } from '@/lib/profileThemes';

// Placeholder tiles so the preview shows a real layout before the student
// has any published achievements.
const PLACEHOLDERS = [
  { registry_id: 'ph1', title: 'Regional 400m champion', category: 'sports', image_url: null, organisation_name: 'Athletics Club' },
  { registry_id: 'ph2', title: 'Grade 8 violin distinction', category: 'arts', image_url: null, organisation_name: 'Music Academy' },
  { registry_id: 'ph3', title: 'UKMT Maths Challenge gold', category: 'academic', image_url: null, organisation_name: 'Maths Trust' },
];

/**
 * ProfilePreview — live, self-contained miniature of the public /@handle
 * profile. The theme's token overrides are applied to this wrapper only, so
 * the preview updates as the student changes options without touching the
 * rest of the app.
 */
export default function ProfilePreview({
  name, handle, bio, avatarUrl, count,
  bannerUrl, themeId, accentColour, displayFont, profileLayout,
  socialLinks, featuredLink, sampleAchievements,
}) {
  const vars = themeVars(themeId, accentColour, displayFont);
  const samples = (sampleAchievements && sampleAchievements.length ? sampleAchievements.slice(0, 3) : PLACEHOLDERS);

  return (
    <div className="rounded-xl border border-border overflow-hidden bg-background" style={vars}>
      {/* Banner */}
      <div className="h-16 w-full" style={bannerStyle(bannerUrl, themeId)} />

      {/* Header */}
      <div className="p-3.5 sm:p-4" style={{ borderRadius: 'var(--pf-radius, 1rem)' }}>
        <div className="flex items-center gap-3">
          <InitialsAvatar name={name || 'Student'} src={avatarUrl} size="md" ring />
          <div className="min-w-0 flex-1">
            <p className="font-heading text-sm sm:text-base font-bold text-foreground truncate">{name || 'Your Name'}</p>
            <p className="text-xs font-semibold text-primary">@{handle || 'handle'}</p>
          </div>
          <div className="rounded-lg border border-border bg-secondary/40 px-2.5 py-1 text-center">
            <p className="text-sm font-bold text-foreground leading-none">{count || samples.length}</p>
            <p className="text-[9px] text-muted-foreground mt-0.5">verified</p>
          </div>
        </div>

        {bio && <p className="mt-2 text-xs text-muted-foreground whitespace-pre-line leading-relaxed line-clamp-3">{bio}</p>}

        {socialLinks?.length > 0 && <div className="mt-2"><SocialLinks links={socialLinks.slice(0, 6)} /></div>}

        {featuredLink?.url && <div className="mt-3"><FeaturedLink link={featuredLink} /></div>}
      </div>

      {/* Achievements in the chosen layout */}
      <div className="px-3.5 sm:px-4 pb-4">
        {profileLayout === 'list' ? (
          <div className="space-y-1.5">
            {samples.map((a) => (
              <AchievementListRow key={a.registry_id} achievement={a} onClick={() => {}} />
            ))}
          </div>
        ) : profileLayout === 'showcase' ? (
          <div>
            <div className="rounded-xl border border-border bg-card/60 overflow-hidden flex items-center gap-3 p-2.5">
              <div className="h-14 w-20 flex-shrink-0 rounded-lg bg-gradient-to-br from-primary to-accent" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{samples[0].title}</p>
                <p className="text-[11px] text-muted-foreground truncate">{samples[0].organisation_name}</p>
              </div>
            </div>
            <div className="mt-1.5 grid grid-cols-4 gap-1.5">
              {samples.slice(1).map((a) => (
                <AchievementTile key={a.registry_id} achievement={a} onClick={() => {}} />
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {samples.map((a) => (
              <AchievementTile key={a.registry_id} achievement={a} onClick={() => {}} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}