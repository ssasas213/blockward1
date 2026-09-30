import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Blockward verification-stage marks — a small, cohesive set of custom SVG
 * marks (NOT generic Lucide icons). All three share the same 24×24 canvas,
 * 1.5 stroke weight, #93C5FD stroke and a filled #2563EB accent so they read
 * as one brand system rather than three unrelated feature icons.
 *
 *  IssuerMark    — issuing authority / source (an authoritative stamp)
 *  VerifierMark  — human authorisation / signature (an authorisation stroke)
 *  IntegrityMark — sealed proof / tamper evidence (a sealed enclosure)
 */

const SVG = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: '#93C5FD',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export function IssuerMark({ className }) {
  return (
    <svg {...SVG} className={cn('h-6 w-6', className)} aria-hidden="true">
      {/* stamp bar (issuing authority) */}
      <path d="M5 8h14" />
      {/* stem to the seal */}
      <path d="M12 8.6v3" opacity="0.55" />
      {/* the seal / origin point */}
      <circle cx="12" cy="15.3" r="2.6" fill="#2563EB" stroke="none" />
    </svg>
  );
}

export function VerifierMark({ className }) {
  return (
    <svg {...SVG} className={cn('h-6 w-6', className)} aria-hidden="true">
      {/* a single authorisation stroke + pen-lift dot */}
      <path d="M5 16.5C8 11 10 12 12 14.5S16.5 9 18.5 9.6" />
      <circle cx="18.5" cy="9.6" r="1.7" fill="#2563EB" stroke="none" />
    </svg>
  );
}

export function IntegrityMark({ className }) {
  return (
    <svg {...SVG} className={cn('h-6 w-6', className)} aria-hidden="true">
      {/* a sealed, tamper-evident enclosure with a locked core */}
      <rect x="5" y="5" width="14" height="14" rx="3.4" />
      <rect x="9.4" y="9.4" width="5.2" height="5.2" rx="1.6" fill="#2563EB" stroke="none" />
    </svg>
  );
}