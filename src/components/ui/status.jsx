import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Blockward status system — a consistent, restrained status indicator used
 * across dashboards, tables, achievement rows and credential surfaces.
 *
 * Small dot + label (not a giant pill). Semantic colour comes from the tone:
 *   green  → verified / valid / success
 *   blue   → active / selected / processing / primary
 *   amber  → pending / requires attention
 *   red    → failed / rejected / revoked / destructive
 *   neutral→ draft / expired / idle
 *
 * tone is derived from the achievementStatus helper when `status` is passed.
 */
export const TONE_DOT = {
  green: 'bg-success',
  blue: 'bg-primary',
  amber: 'bg-warning',
  red: 'bg-destructive',
  neutral: 'bg-muted-foreground',
};

export const TONE_TEXT = {
  green: 'text-success',
  blue: 'text-primary',
  amber: 'text-warning',
  red: 'text-destructive',
  neutral: 'text-muted-foreground',
};

/**
 * StatusDot — just the coloured dot, for inline table use.
 */
export function StatusDot({ tone = 'neutral', className, pulse }) {
  return (
    <span
      className={cn(
        'inline-block h-1.5 w-1.5 rounded-full flex-shrink-0',
        TONE_DOT[tone] || TONE_DOT.neutral,
        pulse && 'animate-pulse',
        className
      )}
      aria-hidden="true"
    />
  );
}

/**
 * StatusIndicator — dot + text label. The default Blockward status element.
 * Use `size` sm (default) for tables/rows, md for headings.
 */
export function StatusIndicator({ tone = 'neutral', label, size = 'sm', pulse, className }) {
  const text =
    size === 'md' ? 'text-sm' : 'text-xs';
  const dot = size === 'md' ? 'h-2 w-2' : 'h-1.5 w-1.5';
  return (
    <span className={cn('inline-flex items-center gap-1.5 font-medium whitespace-nowrap', TONE_TEXT[tone] || TONE_TEXT.neutral, text, className)}>
      <StatusDot tone={tone} pulse={pulse} className={dot} />
      {label}
    </span>
  );
}

/**
 * StatusPill — a subtle bordered pill variant for places that need a
 * self-contained badge (e.g. achievement list rows). Restrained: thin border,
 * tinted bg, no glow.
 */
export function StatusPill({ tone = 'neutral', label, className, pulse }) {
  const PILL_CLS = {
    green: 'bg-success/10 text-success border-success/30',
    blue: 'bg-primary/10 text-primary border-primary/30',
    amber: 'bg-warning/10 text-warning border-warning/30',
    red: 'bg-destructive/10 text-destructive border-destructive/30',
    neutral: 'bg-secondary text-muted-foreground border-border',
  };
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
      PILL_CLS[tone] || PILL_CLS.neutral,
      className
    )}>
      <StatusDot tone={tone} pulse={pulse} className="h-1.5 w-1.5" />
      {label}
    </span>
  );
}

export default StatusIndicator;