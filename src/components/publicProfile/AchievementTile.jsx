import React from 'react';
import AchievementCard, { cardFromRegistry, CATEGORY_STYLE, fmtDate } from '@/components/achievements/AchievementCard';

// Re-exported for the list layout (AchievementListRow) — one shared source.
export { CATEGORY_STYLE, fmtDate };

/**
 * AchievementTile — the public profile's achievement card. A thin wrapper
 * over the shared AchievementCard so My BlockWards and the public profile
 * can never drift.
 */
export default function AchievementTile({ achievement, onClick, canEndorse, onEndorse }) {
  return (
    <AchievementCard
      item={cardFromRegistry(achievement)}
      onClick={onClick}
      canEndorse={canEndorse}
      onEndorse={onEndorse}
    />
  );
}