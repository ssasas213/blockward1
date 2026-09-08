import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import InitialsAvatar from '@/components/ui/InitialsAvatar';
import { base44 } from '@/api/base44Client';

export default function LeaderboardPanel({ leaderboard, optOut }) {
  const [period, setPeriod] = useState('weekly');
  const [metric, setMetric] = useState('achievements');
  const [hidden, setHidden] = useState(!!optOut);
  const [saving, setSaving] = useState(false);

  useEffect(() => setHidden(!!optOut), [optOut]);

  const toggleOptOut = async (appear) => {
    setSaving(true);
    try {
      const res = await base44.functions.invoke('socialAction', { action: 'set_leaderboard_opt_out', opt_out: !appear });
      if (res.data?.ok) {
        setHidden(res.data.leaderboard_opt_out);
        toast.success(res.data.leaderboard_opt_out ? "You're hidden from leaderboards" : "You're back on the leaderboards");
      } else {
        throw new Error(res.data?.error);
      }
    } catch {
      toast.error('Could not save that — try again');
    } finally {
      setSaving(false);
    }
  };

  const board = leaderboard?.[period]?.[metric] || [];
  const periodLabel = period === 'weekly' ? 'week' : 'month';
  const metricLabel = metric === 'achievements' ? 'verified credentials' : 'endorsements received';

  const Segmented = ({ value, options, onChange }) => (
    <div className="inline-flex w-full rounded-lg border border-border bg-secondary/40 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 text-xs font-medium py-1.5 rounded-md transition-colors",
            value === o.value ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="h-4 w-4 text-warning" />
        <p className="text-sm font-semibold text-foreground truncate">
          {leaderboard?.organisation_name || 'Organisation'} leaderboard
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <Segmented
          value={period}
          onChange={setPeriod}
          options={[{ value: 'weekly', label: 'This week' }, { value: 'monthly', label: 'This month' }]}
        />
        <Segmented
          value={metric}
          onChange={setMetric}
          options={[{ value: 'achievements', label: 'Credentials' }, { value: 'endorsements', label: 'Endorsements' }]}
        />
      </div>

      {board.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6 text-center">
          No {metricLabel} this {periodLabel} yet.
        </p>
      ) : (
        <ol className="space-y-1">
          {board.map((row, i) => (
            <li key={(row.handle || row.name) + i} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-hover/50 transition-colors">
              <span className={cn("w-5 text-center text-xs font-bold", i === 0 ? "text-warning" : "text-tertiary")}>{i + 1}</span>
              <InitialsAvatar name={row.name} size="xs" />
              {row.handle ? (
                <Link to={`/@${row.handle}`} className="text-sm text-foreground hover:text-primary truncate flex-1">{row.name}</Link>
              ) : (
                <span className="text-sm text-foreground truncate flex-1">{row.name}</span>
              )}
              <span className="text-sm font-semibold text-foreground">{row.count}</span>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-3 pt-3 border-t border-border flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-foreground">Appear on leaderboards</p>
          <p className="text-[11px] text-tertiary">Turn off to stay out of the rankings</p>
        </div>
        <Switch checked={!hidden} onCheckedChange={toggleOptOut} disabled={saving} />
      </div>
    </div>
  );
}