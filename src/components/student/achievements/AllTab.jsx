import React, { useMemo } from 'react';
import EmptyState from '@/components/ui/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, Clock, FileText, ChevronRight, Trophy } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { STATUS_LABELS } from '@/lib/achievementRequests';

const TYPE_META = {
  verified: { icon: Shield, label: 'Verified', badgeClass: 'border-success/30 bg-success/10 text-success' },
  request: { icon: Clock, label: null, badgeClass: 'border-warning/30 bg-warning/10 text-warning' },
  self: { icon: FileText, label: 'Unverified', badgeClass: 'border-border bg-muted text-muted-foreground' },
};

/**
 * AllTab — everything the student has, newest first: verified BlockWards,
 * achievement requests (any status) and self-reported achievements.
 */
export default function AllTab({ verified, requests, selfReported, onSelectVerified, onGoTo }) {
  const items = useMemo(() => {
    const merged = [
      ...verified.map(v => ({
        type: 'verified',
        id: v.id,
        title: v.title,
        meta: v.category,
        date: v.minted_at || v.created_date,
        record: v,
      })),
      ...requests.map(r => ({
        type: 'request',
        id: r.id,
        title: r.title,
        meta: r.school_name || r.credential_type_title,
        date: r.submitted_at || r.created_date,
        record: r,
      })),
      ...selfReported.map(s => ({
        type: 'self',
        id: s.id,
        title: s.title,
        meta: s.organisation_name || s.domain,
        date: s.date_achieved || s.created_date,
        record: s,
      })),
    ];
    return merged.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  }, [verified, requests, selfReported]);

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Trophy}
        title="No achievements yet"
        description="Request your first achievement to get it verified and permanently recorded."
      />
    );
  }

  const handleSelect = (it) => {
    if (it.type === 'verified') onSelectVerified(it.record);
    else if (it.type === 'request') onGoTo('pending');
    else onGoTo('unverified');
  };

  return (
    <Card className="shadow-sm">
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {items.map(it => {
            const meta = TYPE_META[it.type];
            const Icon = meta.icon;
            return (
              <button
                key={`${it.type}-${it.id}`}
                onClick={() => handleSelect(it)}
                className="w-full text-left p-4 hover:bg-muted/50 transition-colors flex items-center gap-4"
              >
                <div className={cn(
                  "h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0",
                  it.type === 'verified' ? 'bg-success/10 text-success' : it.type === 'request' ? 'bg-warning/10 text-warning' : 'bg-muted text-muted-foreground'
                )}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground text-sm truncate">{it.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <span className="capitalize">{it.meta || '—'}</span>
                    {it.date && ` · ${format(new Date(it.date), 'MMM d, yyyy')}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant="outline" className={meta.badgeClass}>
                    {it.type === 'request' ? (STATUS_LABELS[it.record.status] || it.record.status) : meta.label}
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}