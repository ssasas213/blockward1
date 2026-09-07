import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import FeedItem from '@/components/feed/FeedItem';
import LeaderboardPanel from '@/components/feed/LeaderboardPanel';
import EndorseDialog from '@/components/endorsements/EndorseDialog';
import { Loader2, Rss, Quote, AlertCircle } from 'lucide-react';

const LAST_VISIT_KEY = 'bw_feed_last_visit';

export default function Feed() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [endorseTarget, setEndorseTarget] = useState(null);
  const [endorseOpen, setEndorseOpen] = useState(false);
  const [lastVisit, setLastVisit] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await base44.functions.invoke('socialData', {});
      if (res.data?.ok) setData(res.data);
      else setError(res.data?.error || 'Could not load the feed.');
    } catch (e) {
      setError(e?.response?.data?.error || e.message || 'Could not load the feed.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const prev = localStorage.getItem(LAST_VISIT_KEY);
    setLastVisit(prev ? new Date(prev) : null);
    load();
  }, [load]);

  // Mark this visit once the feed is on screen. The divider uses the
  // lastVisit captured at mount, so refreshing the stored timestamp is safe.
  useEffect(() => {
    if (data?.ok) localStorage.setItem(LAST_VISIT_KEY, new Date().toISOString());
  }, [data]);

  const feed = data?.feed || [];
  const budget = data?.budget || null;
  const canEndorse = !!(budget && budget.remaining > 0);

  const updateItem = (registryId, patch) => {
    setData((prev) =>
      prev ? { ...prev, feed: prev.feed.map((it) => (it.registry_id === registryId ? { ...it, ...patch } : it)) } : prev
    );
  };

  const onEndorse = (item) => {
    setEndorseTarget(item);
    setEndorseOpen(true);
  };

  const onEndorseDone = (res) => {
    if (endorseTarget && res) {
      updateItem(endorseTarget.registry_id, { endorsement_count: (endorseTarget.endorsement_count || 0) + 1 });
      if (typeof res.remaining === 'number' && budget) {
        setData((prev) => (prev ? { ...prev, budget: { ...prev.budget, remaining: res.remaining } } : prev));
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center max-w-md mx-auto mt-12">
        <AlertCircle className="h-8 w-8 mx-auto text-destructive mb-3" />
        <p className="text-sm text-foreground">{error}</p>
      </div>
    );
  }

  // Reverse chronological; new items sit above the "since your last visit" marker.
  let newMarked = false;
  const firstNewItemIdx = lastVisit
    ? feed.findIndex((it) => new Date(it.when) > lastVisit)
    : -1;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Activity Feed</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Verified achievements from people you follow, your organisations, and the organisations they compete with.
        </p>
      </div>

      <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
        {/* The feed — calm, reverse chronological, no infinite scroll */}
        <div className="space-y-3">
          {feed.length === 0 ? (
            <div className="rounded-xl border border-border bg-card/40 p-12 text-center">
              <Rss className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-foreground">Nothing in your feed yet</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Follow people from their profiles, or earn verified achievements in your organisation — new ones appear here.
              </p>
            </div>
          ) : (
            feed.map((item, idx) => {
              const isNew = firstNewItemIdx !== -1 && idx >= firstNewItemIdx;
              const showMarker = isNew && !newMarked;
              if (showMarker) newMarked = true;
              return (
                <React.Fragment key={item.registry_id}>
                  {showMarker && (
                    <div className="flex items-center gap-3 py-2">
                      <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                      <span className="text-[11px] font-semibold text-primary uppercase tracking-wide">New since your last visit</span>
                      <div className="h-px flex-1 bg-primary/20" />
                    </div>
                  )}
                  <FeedItem item={item} isNew={isNew} canEndorse={canEndorse} onEndorse={onEndorse} />
                </React.Fragment>
              );
            })
          )}
        </div>

        {/* Right rail — endorsement budget + leaderboards */}
        <aside className="space-y-4 lg:sticky lg:top-20">
          {budget && (
            <div className="rounded-xl border border-border bg-card/60 p-4">
              <div className="flex items-center gap-2">
                <Quote className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">Endorsements left this term</p>
              </div>
              <p className="text-2xl font-bold text-foreground mt-2">
                {budget.remaining}
                <span className="text-sm text-muted-foreground font-medium"> of {budget.budget}</span>
              </p>
              {budget.term_end && (
                <p className="text-xs text-tertiary mt-1">
                  Resets {new Date(budget.term_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </p>
              )}
            </div>
          )}
          {data?.leaderboard && (
            <LeaderboardPanel leaderboard={data.leaderboard} optOut={data.leaderboard_opt_out} />
          )}
        </aside>
      </div>

      <EndorseDialog
        open={endorseOpen}
        onOpenChange={setEndorseOpen}
        achievement={endorseTarget}
        mode="achievement"
        onDone={onEndorseDone}
      />
    </div>
  );
}