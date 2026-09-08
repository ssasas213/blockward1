import React from 'react';
import { Instagram, Linkedin, Github, Youtube, Twitter, Dribbble, Globe, Link2 } from 'lucide-react';
import { SOCIAL_PLATFORMS } from '@/lib/profileThemes';

const LUCIDE_ICONS = {
  instagram: Instagram,
  linkedin: Linkedin,
  github: Github,
  youtube: Youtube,
  twitter: Twitter,
  dribbble: Dribbble,
  website: Globe,
};
// Platforms without a lucide icon render a small monogram chip instead.
const MONOGRAMS = { tiktok: 'TT', discord: 'DC', behance: 'Be', strava: 'ST', chess: 'Ch' };

// Social icon buttons rendered under the bio on the public profile.
export default function SocialLinks({ links }) {
  if (!links?.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {links.map((l, i) => {
        const platform = SOCIAL_PLATFORMS.find((p) => p.id === l.platform);
        const Icon = LUCIDE_ICONS[l.platform];
        const mono = MONOGRAMS[l.platform];
        const title = l.label || (platform ? platform.label : 'Link');
        return (
          <a
            key={i}
            href={l.url}
            target="_blank"
            rel="noopener nofollow"
            title={title}
            aria-label={title}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-secondary/50 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
          >
            {Icon ? <Icon className="h-4 w-4" /> : mono ? (
              <span className="text-[10px] font-bold tracking-tight">{mono}</span>
            ) : (
              <Link2 className="h-4 w-4" />
            )}
          </a>
        );
      })}
    </div>
  );
}