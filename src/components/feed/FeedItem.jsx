import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Quote, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import InitialsAvatar from '@/components/ui/InitialsAvatar';
import { base44 } from '@/api/base44Client';

export const REACTIONS = [
  { type: 'celebrate', emoji: '🎉', label: 'Celebrate' },
  { type: 'clap', emoji: '👏', label: 'Applause' },
  { type: 'heart', emoji: '❤️', label: 'Love this' },
  { type: 'star', emoji: '⭐', label: 'Star moment' },
];

export default function FeedItem({ item, isNew, canEndorse, onEndorse }) {
  const [reactions, setReactions] = useState(item.reactions || {});
  const [mine, setMine] = useState((item.my_reactions || [])[0] || null);
  const [following, setFollowing] = useState(!!item.following);
  const [followBusy, setFollowBusy] = useState(false);

  const react = async (type) => {
    const prevMine = mine;
    const nextMine = prevMine === type ? null : type; // same reaction again = remove
    const nextCounts = { ...reactions };
    if (prevMine && nextCounts[prevMine]) nextCounts[prevMine] -= 1;
    if (nextMine) nextCounts[nextMine] = (nextCounts[nextMine] || 0) + 1;
    setMine(nextMine);
    setReactions(nextCounts);
    try {
      const res = await base44.functions.invoke('socialAction', { action: 'react', registry_id: item.registry_id, type });
      if (!res.data?.ok) throw new Error(res.data?.error);
      setMine((res.data.my_reactions || [])[0] || null);
    } catch {
      setMine(prevMine);
      setReactions(item.reactions || {});
    }
  };

  const toggleFollow = async () => {
    const next = !following;
    setFollowing(next);
    setFollowBusy(true);
    try {
      const res = await base44.functions.invoke('socialAction', { action: next ? 'follow' : 'unfollow', target_user_id: item.student_id });
      if (!res.data?.ok) throw new Error(res.data?.error);
    } catch {
      setFollowing(!next);
    } finally {
      setFollowBusy(false);
    }
  };

  return (
    <article className={cn(
      "rounded-xl border bg-card/60 backdrop-blur-sm p-4 sm:p-5 transition-colors",
      isNew ? "border-primary/30" : "border-border"
    )}>
      <div className="flex items-start gap-3">
        {item.student_handle ? (
          <Link to={`/@${item.student_handle}`}>
            <InitialsAvatar name={item.student_name} src={item.student_avatar} size="md" />
          </Link>
        ) : (
          <InitialsAvatar name={item.student_name} src={item.student_avatar} size="md" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm leading-snug">
            {item.student_handle ? (
              <Link to={`/@${item.student_handle}`} className="font-semibold text-foreground hover:text-primary">{item.student_name}</Link>
            ) : (
              <span className="font-semibold text-foreground">{item.student_name}</span>
            )}
            <span className="text-muted-foreground"> earned </span>
            <Link to={`/verify/${item.verification_id}`} className="font-semibold text-primary hover:underline">{item.title}</Link>
            {item.is_team_credential && (
              <span className="inline-flex items-center gap-1 ml-1.5 text-tertiary text-xs">
                <Users className="h-3.5 w-3.5" />{item.participant_role || 'team'}
              </span>
            )}
          </p>
          <p className="text-xs text-tertiary mt-1">
            {item.organisation_name} · {formatDistanceToNow(new Date(item.when), { addSuffix: true })}
          </p>
        </div>
        <button
          onClick={toggleFollow}
          disabled={followBusy}
          className={cn(
            "text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors",
            following
              ? "border-border bg-secondary/60 text-muted-foreground hover:text-foreground"
              : "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
          )}
        >
          {following ? 'Following' : 'Follow'}
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          {REACTIONS.map((r) => {
            const active = mine === r.type;
            const count = reactions[r.type] || 0;
            return (
              <button
                key={r.type}
                onClick={() => react(r.type)}
                title={r.label}
                className={cn(
                  "h-8 px-2.5 rounded-lg border text-sm flex items-center gap-1.5 transition-all duration-150",
                  active
                    ? "border-primary/40 bg-primary/10"
                    : "border-border bg-secondary/40 hover:bg-hover hover:border-primary/25"
                )}
              >
                <span>{r.emoji}</span>
                {count > 0 && <span className="text-xs font-medium text-muted-foreground">{count}</span>}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          {item.endorsement_count > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title={`${item.endorsement_count} peer endorsement${item.endorsement_count === 1 ? '' : 's'}`}>
              <Quote className="h-3.5 w-3.5" />{item.endorsement_count}
            </span>
          )}
          {canEndorse ? (
            <Button size="sm" variant="outline" onClick={() => onEndorse(item)}>
              <Quote className="h-3.5 w-3.5 mr-1.5" />Endorse
            </Button>
          ) : (
            <span className="text-[11px] text-tertiary" title="No endorsements left this term">No budget left</span>
          )}
        </div>
      </div>
    </article>
  );
}