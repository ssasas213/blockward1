import React from 'react';
import { ExternalLink } from 'lucide-react';

// The one prominent call-to-action above the achievements — portfolio, CV,
// fundraiser, team page or commission form. https-only, safe rel attributes.
export default function FeaturedLink({ link }) {
  if (!link?.url) return null;
  return (
    <div className="mt-6">
      <a
        href={link.url}
        target="_blank"
        rel="noopener nofollow"
        className="flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-lg transition-transform hover:-translate-y-0.5"
        style={{ borderRadius: 'var(--pf-radius, 14px)' }}
      >
        <ExternalLink className="h-4 w-4" />
        {link.label || 'Featured link'}
      </a>
    </div>
  );
}