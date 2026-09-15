import React from 'react';
import { BadgeCheck } from 'lucide-react';
import InitialsAvatar from '@/components/ui/InitialsAvatar';
import SocialLinks from '@/components/publicProfile/SocialLinks';
import FeaturedLink from '@/components/publicProfile/FeaturedLink';
import CustomLinkRows from '@/components/publicProfile/CustomLinkRows';
import OpenToChips from '@/components/publicProfile/OpenToChips';
import ProfileBadge from '@/components/publicProfile/ProfileBadge';

/**
 * ProfileHero — the top of the public profile, in one of four bounded
 * hero-style presets: banner (classic cover + overlapping card), split
 * (identity beside the cover), minimal (no cover), fullbleed (tall
 * edge-to-edge cover).
 *
 * LEGIBILITY: on 'banner' the identity text sits on a SOLID white scrim
 * with FIXED colours that never depend on the theme or the banner behind
 * it (name #17121F 16.8:1, sub #4B4453 8.7:1, badge #17803D 4.7:1 on
 * #FFFFFF). On 'fullbleed' it sits on a near-black glass scrim (≥85%
 * opacity) so white text stays ≥AA over even a pure-white banner. On
 * 'split'/'minimal' it uses the app's validated token colours. The banner
 * always ends at a hard border — no gradient fade into the page.
 */

// Avatar frames — bounded presets. 'square'/'squircle' clip the avatar.
function AvatarFrame({ student, poke = false }) {
  const frame = student.avatar_frame || 'none';
  const clip = frame === 'square' ? 'rounded-lg' : frame === 'squircle' ? 'rounded-[26%]' : 'rounded-full';
  const padded = frame === 'gradient-ring' || frame === 'accent-ring';
  const bg = frame === 'gradient-ring'
    ? { background: 'var(--pf-accent-grad, hsl(var(--primary)))' }
    : frame === 'accent-ring'
      ? { background: 'hsl(var(--primary))' }
      : undefined;
  return (
    <div
      className={`flex-shrink-0 self-start shadow-lg ${poke ? '-mt-10 sm:-mt-14' : ''} ${padded ? `p-[3px] ${clip}` : ''}`}
      style={bg}
    >
      <div className={`${clip} overflow-hidden ring-4 ring-white`}>
        <InitialsAvatar name={student.name} src={student.avatar_url} size="xl" />
      </div>
    </div>
  );
}

// Name, tagline, handle, pronouns, badges, bio, languages and open-to chips.
// tone: 'scrim' (fixed colours on white), 'glass' (white on dark glass),
// 'token' (theme tokens on the page surface).
function IdentityFields({ student, count, tone }) {
  const color = tone === 'scrim'
    ? { name: '#17121F', sub: '#4B4453' }
    : tone === 'glass'
      ? { name: '#FFFFFF', sub: 'rgba(255,255,255,0.85)' }
      : { name: 'hsl(var(--foreground))', sub: 'hsl(var(--muted-foreground))' };
  const verifiedChip = tone === 'scrim'
    ? 'border-[#1E8E4E]/30 bg-[#1E8E4E]/10 text-[#17803D]'
    : 'border-success/30 bg-success/10 text-success';
  const langChip = tone === 'scrim'
    ? { style: { border: '1px solid #E2DCEB', background: 'rgba(75,68,83,0.07)', color: '#4B4453' } }
    : { className: 'border-border bg-secondary/50 text-muted-foreground' };

  return (
    <div className="min-w-0 flex-1 sm:pt-1">
      <h1 className="font-heading text-2xl sm:text-4xl font-bold leading-tight break-words" style={{ color: color.name }}>
        {student.name}
      </h1>
      {student.tagline && (
        <p className="mt-0.5 text-sm sm:text-base font-medium" style={{ color: color.sub }}>
          {student.tagline}
        </p>
      )}
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="text-sm sm:text-base font-medium" style={{ color: color.sub }}>@{student.handle}</p>
        {student.pronouns && (
          <span className="text-xs font-medium" style={{ color: color.sub, opacity: 0.8 }}>{student.pronouns}</span>
        )}
        {count > 0 && (
          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${verifiedChip}`}>
            <BadgeCheck className="h-3.5 w-3.5" /> Verified
          </span>
        )}
        {student.badge && (
          <ProfileBadge tier={student.badge.tier} orgName={student.badge.org_name} grantedAt={student.badge.granted_at} />
        )}
      </div>
      {student.bio && (
        <p className="text-sm sm:text-[15px] mt-3 leading-relaxed whitespace-pre-line max-w-2xl" style={{ color: color.sub }}>
          {student.bio}
        </p>
      )}
      {(student.open_to?.length > 0 || student.languages?.length > 0) && (
        <div className="mt-3 space-y-2">
          <OpenToChips openTo={student.open_to} tone={tone === 'scrim' ? 'scrim' : 'token'} />
          {student.languages?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {student.languages.map((l) => (
                <span key={l} className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${langChip.className || ''}`} style={langChip.style}>
                  {l}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LinksAndStats({ student, count, endorsementCount }) {
  const stats = [
    { label: 'Verified', value: count },
    { label: 'Endorsements', value: endorsementCount },
    { label: 'Views', value: student.profile_views || 0 },
  ];
  return (
    <>
      {(student.social_links?.length > 0 || student.featured_link?.url) && (
        <div className="pf-rise mt-3 flex flex-col sm:flex-row gap-2" style={{ '--pf-delay': '60ms' }}>
          {student.social_links?.length > 0 && <SocialLinks links={student.social_links} />}
          {student.featured_link?.url && <FeaturedLink link={student.featured_link} />}
        </div>
      )}
      {student.custom_links?.length > 0 && (
        <div className="pf-rise mt-3" style={{ '--pf-delay': '80ms' }}>
          <CustomLinkRows links={student.custom_links} />
        </div>
      )}
      {count > 0 && (
        <div className="pf-rise pf-tile mt-3 flex items-stretch divide-x divide-border border border-border bg-secondary" style={{ '--pf-delay': '100ms' }}>
          {stats.map((s) => (
            <div key={s.label} className="flex-1 px-2 py-2.5 sm:px-4 text-center">
              <p className="text-base sm:text-lg font-bold text-foreground leading-none">{s.value}</p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function Banner({ bannerCss, className }) {
  return (
    <div
      className={`relative overflow-hidden border-b border-border ${className || ''}`}
      role="img"
      aria-label="Profile banner"
    >
      <div className="absolute inset-0" style={bannerCss || { background: 'var(--pf-banner)' }} />
      <div className="absolute inset-0" style={{ background: 'radial-gradient(80% 90% at 78% 0%, hsl(var(--primary) / 0.18), transparent 70%)' }} aria-hidden="true" />
    </div>
  );
}

export default function ProfileHero({ student, count = 0, endorsementCount = 0, bannerCss }) {
  const hero = student.hero_style || 'banner';

  // banner — the classic: cover, white identity card overlapping it
  if (hero === 'banner') {
    return (
      <section>
        <Banner bannerCss={bannerCss} className="h-36 sm:h-48 lg:h-56" />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 -mt-10 sm:-mt-14">
          <div className="pf-tile pf-rise relative border border-border bg-[#FFFFFF] p-5 sm:p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6">
              <AvatarFrame student={student} poke />
              <IdentityFields student={student} count={count} tone="scrim" />
            </div>
          </div>
          <LinksAndStats student={student} count={count} endorsementCount={endorsementCount} />
        </div>
      </section>
    );
  }

  // fullbleed — tall edge-to-edge cover, dark glass identity over it
  if (hero === 'fullbleed') {
    return (
      <section>
        <div className="relative h-72 sm:h-96 overflow-hidden border-b border-border">
          <div className="absolute inset-0" style={bannerCss || { background: 'var(--pf-banner)' }} role="img" aria-label="Profile banner" />
          <div className="absolute inset-0" style={{ background: 'radial-gradient(80% 90% at 78% 0%, hsl(var(--primary) / 0.18), transparent 70%)' }} aria-hidden="true" />
          <div className="absolute inset-x-0 bottom-0">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-4 sm:pb-6">
              <div className="pf-tile pf-rise relative border border-white/20 bg-[#0B0A10]/85 backdrop-blur-md p-5 sm:p-6 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6">
                  <AvatarFrame student={student} poke />
                  <IdentityFields student={student} count={count} tone="glass" />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <LinksAndStats student={student} count={count} endorsementCount={endorsementCount} />
        </div>
      </section>
    );
  }

  // split — identity on the page surface, cover beside it
  if (hero === 'split') {
    return (
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8">
        <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr] lg:items-center">
          <div className="pf-rise flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6">
            <AvatarFrame student={student} />
            <IdentityFields student={student} count={count} tone="token" />
          </div>
          <div
            className="pf-tile pf-rise h-44 sm:h-56 lg:h-72 overflow-hidden border border-border shadow-card"
            style={bannerCss || { background: 'var(--pf-banner)' }}
            role="img"
            aria-label="Profile banner"
          />
        </div>
        <LinksAndStats student={student} count={count} endorsementCount={endorsementCount} />
      </section>
    );
  }

  // minimal — no cover, quiet and editorial
  return (
    <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8">
      <div className="pf-rise flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6">
        <AvatarFrame student={student} />
        <IdentityFields student={student} count={count} tone="token" />
      </div>
      <LinksAndStats student={student} count={count} endorsementCount={endorsementCount} />
    </section>
  );
}