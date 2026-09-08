import React from 'react';
import { ExternalLink } from 'lucide-react';

/**
 * FeaturedLink — one prominent call-to-action above the achievements
 * (portfolio, CV, fundraiser, team page, commission form). This is what
 * makes the profile worth putting in an Instagram bio.
 */
export default function FeaturedLink({ link }) {
  if (!link?.url) return null;
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener nofollow"
      className="inline-flex items-center gap-2.5 rounded-xl bg-primary text-primary-foreground px-6 h-12 text-sm sm:text-base font-semibold shadow-lg hover:-translate-y-0.5 hover:shadow-xl transition-all"
    >
      {link.label || 'View my work'}
      <ExternalLink className="h-4 w-4" />
    </a>
  );
}