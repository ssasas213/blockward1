import React from 'react';
import { Globe, Link2, Linkedin } from 'lucide-react';
import {
  SiInstagram, SiTiktok, SiGithub, SiYoutube, SiX,
  SiDiscord, SiBehance, SiDribbble, SiStrava, SiChessdotcom,
  SiSpotify, SiTwitch, SiSubstack, SiMedium, SiBluesky, SiThreads,
  SiWhatsapp, SiDuolingo, SiCodeforces, SiKaggle, SiGoodreads, SiLetterboxd,
} from 'react-icons/si';
import { SOCIAL_PLATFORMS } from '@/lib/profileThemes';

// Official brand marks (Simple Icons via react-icons), rendered monochrome
// through currentColor so they sit consistently with the profile theme.
// The personal-website option keeps the neutral generic-link icon only.
const PLATFORM_ICONS = {
  instagram: SiInstagram,
  tiktok: SiTiktok,
  linkedin: Linkedin,
  github: SiGithub,
  youtube: SiYoutube,
  twitter: SiX,
  discord: SiDiscord,
  behance: SiBehance,
  dribbble: SiDribbble,
  strava: SiStrava,
  chess: SiChessdotcom,
  spotify: SiSpotify,
  twitch: SiTwitch,
  substack: SiSubstack,
  medium: SiMedium,
  bluesky: SiBluesky,
  threads: SiThreads,
  whatsapp: SiWhatsapp,
  duolingo: SiDuolingo,
  codeforces: SiCodeforces,
  kaggle: SiKaggle,
  goodreads: SiGoodreads,
  letterboxd: SiLetterboxd,
  website: Globe,
};

// Social icon buttons rendered under the bio on the public profile.
export default function SocialLinks({ links }) {
  if (!links?.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {links.map((l, i) => {
        const platform = SOCIAL_PLATFORMS.find((p) => p.id === l.platform);
        const Icon = PLATFORM_ICONS[l.platform] || Link2;
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
            <Icon className="h-4 w-4" />
          </a>
        );
      })}
    </div>
  );
}