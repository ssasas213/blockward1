import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import EmptyState from '@/components/ui/empty-state';
import {
  Bell, MessageCircle, Megaphone, BookOpen, Heart, Briefcase, Eye, ShieldCheck, FileCheck2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const TYPE_ICON = {
  message: MessageCircle,
  announcement_urgent: Megaphone,
  announcement_important: Megaphone,
  announcement_scheduled_reminder: Megaphone,
  classwork_posted: BookOpen,
  classwork_due_soon: BookOpen,
  classwork_returned: BookOpen,
  endorsement: Heart,
  follow: Heart,
  request_signed_off: FileCheck2,
  request_changes: FileCheck2,
  team_accepted: FileCheck2,
  opportunity_match: Briefcase,
  view_milestone: Eye,
  org_approved: ShieldCheck,
};

function timeAgo(iso) {
  if (!iso) return '';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/**
 * RecentActivityCard — the student's latest notifications on the dashboard:
 * unread items highlighted with a primary-tinted row, everything else quiet.
 * Display-only; the bell handles acting on individual notifications.
 */
export default function RecentActivityCard({ notifications, loading = false }) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Recent activity</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 rounded-lg bg-muted/60 animate-pulse" />
            ))}
          </div>
        ) : (notifications || []).length === 0 ? (
          <EmptyState icon={Bell} title="No activity yet" />
        ) : (
          <ul className="space-y-1.5">
            {(notifications || []).slice(0, 5).map((n) => {
              const Icon = TYPE_ICON[n.type] || Bell;
              return (
                <li
                  key={n.id}
                  className={cn(
                    'flex items-start gap-3 rounded-lg p-2.5',
                    n.read ? 'bg-muted/40' : 'border border-primary/20 bg-primary/5'
                  )}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary flex-shrink-0">
                    <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-sm truncate', n.read ? 'font-normal' : 'font-semibold', 'text-foreground')}>
                      {n.title}
                    </p>
                    {n.body && <p className="text-xs text-muted-foreground truncate">{n.body}</p>}
                  </div>
                  <span className="text-[11px] text-tertiary whitespace-nowrap flex-shrink-0">
                    {timeAgo(n.created_date)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}