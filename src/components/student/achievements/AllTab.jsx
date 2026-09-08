import React, { useMemo } from 'react';
import EmptyState from '@/components/ui/empty-state';
import AchievementCard, { AchievementRow, cardFromVault, cardFromRequest, cardFromSelf } from '@/components/achievements/AchievementCard';
import AchievementGridSkeleton from '@/components/achievements/AchievementGridSkeleton';
import { Trophy } from 'lucide-react';

/**
 * AllTab — everything the student has, newest first, as one grid of shared
 * achievement cards (compact rows in list mode). Archived/minted requests
 * and verified self-reported items are excluded: they already exist as
 * verified achievements, and including them here made the same achievement
 * render twice with different subtitles and icons.
 */
export default function AllTab({ verified, requests, selfReported, onSelectVerified, onGoTo, onShare, onGetVerified, viewMode = 'grid', loading = false }) {
  const items = useMemo(() => {
    const merged = [
      ...verified.map(v => ({ type: 'verified', card: cardFromVault(v), raw: v, date: v.minted_at || v.created_date })),
      ...requests
        .filter(r => !['archived', 'minted'].includes(r.status))
        .map(r => ({ type: 'request', card: cardFromRequest(r), raw: r, date: r.submitted_at || r.created_date })),
      ...selfReported
        .filter(s => s.status !== 'verified')
        .map(s => ({ type: 'self', card: cardFromSelf(s), raw: s, date: s.date_achieved || s.created_date })),
    ];
    return merged.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  }, [verified, requests, selfReported]);

  // Skeleton grid while the section loads — shaped like the real cards so the
  // layout never jumps. (After the useMemo: hooks must not be conditional.)
  if (loading) return <AchievementGridSkeleton />;

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Trophy}
        title="No achievements yet"
        description="Request your first achievement to get it verified and permanently recorded."
      />
    );
  }

  const open = (it) => {
    if (it.type === 'verified') onSelectVerified(it.raw);
    else if (it.type === 'request') onGoTo('pending');
    else onGoTo('unverified');
  };

  if (viewMode === 'list') {
    return (
      <div className="space-y-2">
        {items.map(it => (
          <AchievementRow key={it.card.id} item={it.card} onClick={() => open(it)} onShare={it.type === 'verified' ? onShare : null} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map(it => (
        <AchievementCard
          key={it.card.id}
          item={it.card}
          onClick={() => open(it)}
          onShare={it.type === 'verified' ? onShare : null}
          onGetVerified={it.type === 'self' ? onGetVerified : null}
        />
      ))}
    </div>
  );
}