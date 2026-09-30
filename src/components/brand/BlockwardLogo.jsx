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
  return (
    <svg
      width={s.box} height={s.box} viewBox="0 0 32 32" fill="none"
      className={cn('flex-shrink-0', className)} aria-hidden="true"
    >
      <defs>
        <linearGradient id="bw-blue-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2563EB" />
          <stop offset="1" stopColor="#60A5FA" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="28" height="28" rx="9" fill="url(#bw-blue-grad)" />
      <path d="M9 16.5l4.5 4.5L23 11" stroke="#FFFFFF" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
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