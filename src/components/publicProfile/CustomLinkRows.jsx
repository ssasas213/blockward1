import React, { useState } from 'react';
import {
  ExternalLink, Globe, FileText, Code2, Video, Music, BookOpen,
  ShoppingCart, PenTool, Briefcase, Link2,
} from 'lucide-react';

const ICONS = {
  globe: Globe, file: FileText, code: Code2, video: Video, music: Music,
  book: BookOpen, cart: ShoppingCart, pen: PenTool, briefcase: Briefcase,
};

// One row icon: the chosen preset icon, the destination's favicon ('auto'),
// or a neutral generic-link fallback when neither resolves.
export function LinkIcon({ icon, url, className = 'h-4 w-4' }) {
  const [broken, setBroken] = useState(false);
  if (icon && icon !== 'auto') {
    const Icon = ICONS[icon] || Link2;
    return <Icon className={className} />;
  }
  let host = null;
  try { host = new URL(url).hostname; } catch { host = null; }
  if (host && !broken) {
    return (
      <img
        src={`https://www.google.com/s2/favicons?domain=${host}&sz=64`}
        alt=""
        className={`${className} rounded-sm object-contain`}
        onError={() => setBroken(true)}
      />
    );
  }
  return <Link2 className={className} />;
}

// Custom links — up to 4 full-width labelled rows below the featured link.
// Together with the social icons this is the link-in-bio hub.
export default function CustomLinkRows({ links }) {
  if (!links?.length) return null;
  return (
    <div className="space-y-2">
      {links.map((l, i) => (
        <a
          key={i}
          href={l.url}
          target="_blank"
          rel="noopener nofollow"
          className="pf-tile flex w-full items-center gap-3 border border-border bg-card px-4 py-3 shadow-sm transition-colors hover:border-primary/40 hover:text-primary"
        >
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-secondary/60 text-muted-foreground">
            <LinkIcon icon={l.icon} url={l.url} />
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{l.label}</span>
          <ExternalLink className="h-3.5 w-3.5 flex-shrink-0 text-tertiary" />
        </a>
      ))}
    </div>
  );
}