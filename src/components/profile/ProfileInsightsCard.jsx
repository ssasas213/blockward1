import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Eye, Loader2, Gauge, Trophy, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

const CATEGORY_LABELS = {
  academic: 'Academic', sports: 'Sport', arts: 'Arts', leadership: 'Leadership',
  community: 'Community', behaviour: 'Behaviour', special: 'Special',
};

const strengthScore = (s) => {
  if (!s) return 0;
  let score = 0;
  if (s.handle) score += 15;
  if (s.bio) score += 15;
  if (s.avatar) score += 10;
  if (s.pinned > 0) score += 15;
  score += Math.min(s.achievements || 0, 5) * 6;
  if (s.externally_verified) score += 15;
  return Math.min(score, 100);
};

const strengthTips = (s) => {
  if (!s) return [];
  const tips = [];
  if (!s.handle) tips.push('Claim your public handle');
  if (!s.bio) tips.push('Add a short bio');
  if (!s.avatar) tips.push('Add a profile photo');
  if (!s.achievements) tips.push('Get your first achievement verified');
  else if (!s.pinned) tips.push('Pin up to 6 highlights to the top of your profile');
  if (!s.externally_verified) tips.push('Add an external verifier to one achievement');
  return tips;
};

/**
 * ProfileInsightsCard — the feedback loop for the student's own public
 * profile: anonymous view counts with a 30-day sparkline, a weekly
 * aggregated "who's looking" line, a profile-strength meter with tips, and
 * a "your year" recap. Views are never individual — the student only ever
 * sees totals. Insights can be switched off entirely.
 */
export default function ProfileInsightsCard({ profile }) {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [optBusy, setOptBusy] = useState(false);

  useEffect(() => { load(); }, [profile?.id]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('profileInsights', {});
      if (res.data?.ok) setInsights(res.data);
    } catch (e) { /* insights stay hidden on failure */ }
    finally { setLoading(false); }
  };

  const toggleInsights = async (on) => {
    setOptBusy(true);
    try {
      await base44.entities.UserProfile.update(profile.id, { views_insight_opt_out: !on });
      setInsights((s) => (s ? { ...s, opted_in: on } : s));
      toast.success(on ? 'Insights enabled' : 'Insights off — views are still counted, but nothing more is collected');
    } catch (e) {
      toast.error('Could not update the setting');
    } finally {
      setOptBusy(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-border bg-card shadow-sm">
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }
  if (!insights) return null;

  const score = strengthScore(insights.strength);
  const tips = strengthTips(insights.strength);
  const spark = insights.sparkline || [];
  const maxSpark = Math.max(1, ...spark.map((d) => d.count));
  const recap = insights.recap || {};
  const hasRecap = (recap.achievements || 0) + (recap.endorsements || 0) > 0;

  return (
    <Card className="border-border bg-card shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2 text-foreground">
          <Eye className="h-4 w-4 text-primary" /> Profile insights
        </CardTitle>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden sm:inline">Insights</span>
          <Switch checked={insights.opted_in} onCheckedChange={toggleInsights} disabled={optBusy} />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {!insights.opted_in ? (
          <p className="text-sm text-muted-foreground">
            Insights are off. Your view counter still updates, but no viewer details are collected.
          </p>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <p className="text-3xl font-bold text-foreground">{insights.total}</p>
                <p className="text-xs text-muted-foreground mt-0.5">total profile views</p>
                {insights.week && insights.week.people > 0 && (
                  <p className="text-xs text-primary mt-2">
                    {insights.week.people} {insights.week.people === 1 ? 'person' : 'people'} from{' '}
                    {insights.week.schools || 1} {insights.week.schools === 1 ? 'school' : 'schools'} viewed your profile this week
                  </p>
                )}
              </div>
              <div className="flex items-end gap-[3px] h-14" aria-hidden="true">
                {spark.map((d) => (
                  <div
                    key={d.key}
                    className="flex-1 rounded-t-sm bg-primary/70"
                    style={{ height: `${Math.max(6, Math.round((d.count / maxSpark) * 100))}%`, opacity: d.count > 0 ? 1 : 0.25 }}
                    title={`${d.key}: ${d.count}`}
                  />
                ))}
              </div>
            </div>
            <p className="text-[11px] text-tertiary -mt-3">
              Views are counted anonymously — you only ever see totals, never who looked.
            </p>
          </>
        )}

        {/* Profile strength */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Gauge className="h-4 w-4 text-primary" /> Profile strength
            </p>
            <span className="text-sm font-bold text-foreground">{score}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-primary to-brand-pink transition-all" style={{ width: `${score}%` }} />
          </div>
          {tips.length > 0 && (
            <ul className="text-xs text-muted-foreground space-y-1 mt-1">
              {tips.slice(0, 3).map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3 text-accent flex-shrink-0" /> {t}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Year recap */}
        {hasRecap && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Trophy className="h-4 w-4 text-accent" /> Your year
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="rounded-lg border border-border bg-background p-3 text-center">
                <p className="text-xl font-bold text-foreground">{recap.achievements}</p>
                <p className="text-[11px] text-muted-foreground">verified</p>
              </div>
              <div className="rounded-lg border border-border bg-background p-3 text-center">
                <p className="text-xl font-bold text-foreground">{recap.endorsements}</p>
                <p className="text-[11px] text-muted-foreground">endorsements</p>
              </div>
              {insights.opted_in && (
                <div className="rounded-lg border border-border bg-background p-3 text-center">
                  <p className="text-xl font-bold text-foreground">{recap.views ?? 0}</p>
                  <p className="text-[11px] text-muted-foreground">views</p>
                </div>
              )}
              <div className="rounded-lg border border-border bg-background p-3 text-center">
                <p className="text-sm font-semibold text-foreground truncate px-1 pt-1">
                  {recap.top_category ? CATEGORY_LABELS[recap.top_category] || recap.top_category : '—'}
                </p>
                <p className="text-[11px] text-muted-foreground">top category</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}