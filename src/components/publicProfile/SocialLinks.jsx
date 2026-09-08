import React from 'react';
import { Instagram, Linkedin, Github, Youtube, Dribbble, Globe } from 'lucide-react';

const ICONS = {
  instagram: Instagram,
  linkedin: Linkedin,
  github: Github,
  youtube: Youtube,
  dribbble: Dribbble,
  website: Globe,
};
const MONOGRAMS = {
  tiktok: 'TT', x: 'X', discord: 'DC', behance: 'Bē', strava: 'ST', chesscom: 'CH',
};

/**
 * SocialLinks — the link-in-bio row under the bio. Icon buttons, always
 * https, never followed by crawlers.
 */
export default function SocialLinks({ links }) {
  if (!links?.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {links.map((l, i) => {
        const Icon = ICONS[l.platform];
        const mono = MONOGRAMS[l.platform];
        return (
          <a
            key={`${l.platform}-${i}`}
            href={l.url}
            target="_blank"
            rel="noopener nofollow"
            title={l.label || l.platform}
            className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-border bg-secondary/60 text-muted-foreground hover:text-primary hover:border-primary/40 hover:-translate-y-0.5 transition-all"
          >
            {Icon ? <Icon className="h-4 w-4" /> : <span className="text-[10px] font-bold">{mono || '•'}</span>}
          </a>
        );
      })}
    </div>
  );
}