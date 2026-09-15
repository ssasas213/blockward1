import React from 'react';
import { ExternalLink } from 'lucide-react';

// The one prominent call-to-action above the achievements — portfolio, CV,
// fundraiser, team page or commission form. https-only, safe rel attributes.
// When the student set a gradient accent, the button uses the two-stop
// gradient with its contrast-safe foreground (worst stop passes WCAG AA).
export default function FeaturedLink({ link }) {
  if (!link?.url) return null;
  return (
    <div className="mt-6 sm:mt-0">
      <a
        href={link.url}
        target="_blank"
        rel="noopener nofollow"
        className="flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-semibold shadow-lg transition-transform hover:-translate-y-0.5"
        style={{
          borderRadius: 'var(--pf-btn-radius, 10px)',
          background: 'var(--pf-accent-grad, hsl(var(--primary)))',
          color: 'var(--pf-accent-grad-fg, hsl(var(--primary-foreground)))',
        }}
      >
        <ExternalLink className="h-4 w-4" />
        {link.label || 'Featured link'}
      </a>
    </div>
  );
}