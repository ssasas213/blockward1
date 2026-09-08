import React from 'react';
import { cn } from '@/lib/utils';

/**
 * AchievementGridSkeleton — placeholder cards shaped exactly like the real
 * achievement cards (4:3 ratio, same grid, same rounded corners) so the layout
 * never jumps when data arrives. Used by the achievement tabs while their
 * section is still loading — no centred spinners.
 */
export default function AchievementGridSkeleton({ count = 6, className = '' }) {
  return (
    <div
      className={cn('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4', className)}
      aria-hidden="true"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bw-card-4-3 block w-full rounded-xl border border-border bg-card animate-pulse"
        />
      ))}
    </div>
  );
}