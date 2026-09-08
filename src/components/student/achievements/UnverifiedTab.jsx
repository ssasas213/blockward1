import React from 'react';
import EmptyState from '@/components/ui/empty-state';
import AchievementCard, { AchievementRow, cardFromSelf } from '@/components/achievements/AchievementCard';
import { FileText } from 'lucide-react';

/**
 * UnverifiedTab — the student's SelfReportedAchievement records on the shared
 * achievement card: dashed border, grey outline status badge and a visible
 * "Get this verified" action so the gap between unverified and verified is
 * obvious and easy to close. List mode uses the compact shared row.
 */
export default function UnverifiedTab({ items, onGetVerified, viewMode = 'grid' }) {
  if (!items || items.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="Nothing self-reported yet"
        description="Add achievements yourself from the dashboard — you can ask an organisation to verify them later, and verified ones become permanent BlockWards."
      />
    );
  }

  const cards = items.map(s => cardFromSelf(s));

  if (viewMode === 'list') {
    return (
      <div className="space-y-2">
        {cards.map(c => (
          <AchievementRow key={c.id} item={c} onClick={() => onGetVerified?.(c)} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {cards.map(c => (
        <AchievementCard key={c.id} item={c} onGetVerified={onGetVerified} />
      ))}
    </div>
  );
}