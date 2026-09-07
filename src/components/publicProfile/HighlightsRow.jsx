import React from 'react';
import AchievementTile from '@/components/publicProfile/AchievementTile';
import { Star } from 'lucide-react';

/**
 * HighlightsRow — up to 6 achievements the student pinned to the top of
 * their profile.
 */
export default function HighlightsRow({ items, onOpen }) {
  if (!items?.length) return null;

  return (
    <section className="mt-10">
      <div className="flex items-center gap-2 mb-4">
        <Star className="h-4 w-4 text-primary fill-primary" />
        <h2 className="text-lg font-semibold text-foreground">Highlights</h2>
        <span className="text-xs text-tertiary">pinned by the student</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {items.map((a) => (
          <AchievementTile key={a.registry_id} achievement={a} onClick={() => onOpen(a)} />
        ))}
      </div>
    </section>
  );
}