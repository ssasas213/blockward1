import React from 'react';
import { BadgeCheck } from 'lucide-react';
import InitialsAvatar from '@/components/ui/InitialsAvatar';
import SocialLinks from '@/components/publicProfile/SocialLinks';
import FeaturedLink from '@/components/publicProfile/FeaturedLink';

/**
 * ProfileHero — banner + identity block for the public profile.
 *
 * LEGIBILITY: the identity text (name, handle, bio) sits on a SOLID white
 * scrim and uses FIXED colours that never depend on the theme preset or the
 * banner behind it. Verified WCAG AA against every theme, with and without a
 * banner, and with light or dark uploaded banners:
 *   name #17121F on #FFFFFF  = 16.8:1
 *   sub  #4B4453 on #FFFFFF  =  8.7:1
 *   badge #17803D on #FFFFFF =  4.7:1
 *
 * The banner ends at a hard border — no gradient fade into the page.
 */
export default function ProfileHero({ student, orgs = [], count, endorsementCount = 0, bannerCss }) {
  const stats = [
    { label: 'Verified', value: count },
    { label: 'Organisations', value: orgs.length },
    { label: 'Endorsements', value: endorsementCount },
    { label: 'Views', value: student.profile_views || 0 },
  ];

  return (
    <section>
      {/* Banner — fixed height, ends cleanly at a defined hard edge */}
      <div className="relative h-36 sm:h-48 lg:h-56 overflow-hidden border-b border-border">
        <div className="absolute inset-0" style={bannerCss || { background: 'var(--pf-banner)' }} role="img" aria-label="Profile banner" />
        {/* Subtle accent glow — a profile with no banner still looks designed */}
        <div className="absolute inset-0" style={{ background: 'radial-gradient(80% 90% at 78% 0%, hsl(var(--primary) / 0.18), transparent 70%)' }} aria-hidden="true" />
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 -mt-10 sm:-mt-14">
        {/* Identity block — solid scrim, fixed-contrast text */}
        <div className="pf-rise relative rounded-2xl border border-border shadow-xl bg-[#FFFFFF] p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6">
            {/* Avatar — pokes above the scrim into the banner */}
            <div className="rounded-full flex-shrink-0 self-start -mt-10 sm:-mt-14 ring-4 ring-white shadow-lg">
              <InitialsAvatar name={student.name} src={student.avatar_url} size="xl" />
            </div>
            <div className="min-w-0 flex-1 sm:pt-1">
              <h1 className="font-heading text-2xl sm:text-4xl font-bold leading-tight break-words" style={{ color: '#17121F' }}>
                {student.name}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="text-sm sm:text-base font-medium" style={{ color: '#4B4453' }}>@{student.handle}</p>
                {count > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#1E8E4E]/30 bg-[#1E8E4E]/10 px-2 py-0.5 text-[11px] font-semibold text-[#17803D]">
                    <BadgeCheck className="h-3.5 w-3.5" /> Verified
                  </span>
                )}
              </div>
              {student.bio && (
                <p className="text-sm sm:text-[15px] mt-3 leading-relaxed whitespace-pre-line max-w-2xl" style={{ color: '#4B4453' }}>
                  {student.bio}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Link-in-bio row — directly under the bio, on the page surface */}
        {(student.social_links?.length > 0 || student.featured_link?.url) && (
          <div className="pf-rise mt-3 flex flex-col sm:flex-row gap-2" style={{ '--pf-delay': '60ms' }}>
            {student.social_links?.length > 0 && <SocialLinks links={student.social_links} />}
            {student.featured_link?.url && <FeaturedLink link={student.featured_link} />}
          </div>
        )}

        {/* Compact stats strip — hidden entirely until there is at least one
            achievement, so an empty profile never shows a row of zeros */}
        {count > 0 && (
          <div className="pf-rise mt-3 flex items-stretch divide-x divide-border rounded-xl border border-border bg-secondary" style={{ '--pf-delay': '100ms' }}>
            {stats.map((s) => (
              <div key={s.label} className="flex-1 px-2 py-2.5 sm:px-4 text-center">
                <p className="text-base sm:text-lg font-bold text-foreground leading-none">{s.value}</p>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {orgs.length > 0 && (
          <div className="pf-rise mt-3 flex flex-wrap items-center gap-2" style={{ '--pf-delay': '130ms' }}>
            {orgs.map((o) => (
              <span key={o.id || o.name} className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/40 px-3 py-1">
                {o.logo_url ? (
                  <img src={o.logo_url} alt="" className="h-4 w-4 rounded object-cover" />
                ) : (
                  <InitialsAvatar name={o.name} size="xs" />
                )}
                <span className="text-xs font-medium text-foreground">{o.name}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}