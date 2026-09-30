import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Blockward brand mark — a clean geometric verification badge (rounded
 * square with a check), in Blockward blue. Replaces the legacy shield.
 *
 * variant: 'mark' (badge only) | 'compact' (badge + "Blockward") | 'full' (badge + wordmark + optional Beta tag)
 * size: sm | md | lg | xl
 * tone: 'auto' (primary token) | 'light' (for dark hero backgrounds, forces light text)
 */
const SIZES = {
  sm: { box: 18, text: 'text-sm' },
  md: { box: 22, text: 'text-base' },
  lg: { box: 28, text: 'text-lg' },
  xl: { box: 40, text: 'text-2xl' },
};

export function BlockwardMark({ size = 'md', className }) {
  const s = SIZES[size] || SIZES.md;
  // Unique gradient ids per instance — the mark renders many times per page
  // (sidebar, header, footer) and duplicate ids would collide in the DOM.
  const uid = React.useId().replace(/:/g, '');
  const top = `bw-top-${uid}`;
  const mid = `bw-mid-${uid}`;
  const bot = `bw-bot-${uid}`;
  return (
    <svg
      width={s.box} height={s.box} viewBox="0 0 64 64" fill="none"
      className={cn('flex-shrink-0', className)} aria-hidden="true"
    >
      <defs>
        <linearGradient id={top} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#D1E7FF" />
          <stop offset="1" stopColor="#4A9EFF" />
        </linearGradient>
        <linearGradient id={mid} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#0066FF" />
          <stop offset="1" stopColor="#2563EB" />
        </linearGradient>
        <linearGradient id={bot} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4D9FFF" />
          <stop offset="1" stopColor="#2563EB" />
        </linearGradient>
      </defs>
      {/* Mark only — no background, fully transparent. Same geometry as
          /favicon.svg so the in-app brand icon matches the browser tab. */}
      <rect x="11" y="9" width="11" height="46" rx="3.5" fill={`url(#${mid})`} />
      <path d="M20 11 C 39 11, 47 19, 41 27 C 35 32, 25 31, 20 31 Z" fill={`url(#${top})`} />
      <path d="M20 33 L36 33 L40 37 L20 37 Z" fill="#0066FF" />
      <path d="M20 33 C 41 33, 50 41, 44 49 C 38 55, 27 54, 20 54 Z" fill={`url(#${bot})`} />
    </svg>
  );
}

export default function BlockwardLogo({ size = 'md', variant = 'full', className, showBeta = false, tone = 'auto' }) {
  const s = SIZES[size] || SIZES.md;
  if (variant === 'mark') return <BlockwardMark size={size} className={className} />;
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <BlockwardMark size={size} />
      {variant !== 'mark' && (
        <span className={cn(
          'font-semibold tracking-tight leading-none',
          s.text,
          tone === 'light' ? 'text-white' : 'text-foreground'
        )}>
          Blockward
        </span>
      )}
      {showBeta && (
        <span className="ml-0.5 px-1.5 py-0.5 rounded-md border border-primary/30 bg-primary/15 text-[10px] font-semibold uppercase tracking-wide text-primary">
          Beta
        </span>
      )}
    </span>
  );
}