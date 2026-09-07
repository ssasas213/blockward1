import React from 'react';
import EmptyState from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { FileText } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const STATUS_BADGE = {
  unverified: { label: 'Unverified', variant: 'outline' },
  verification_requested: { label: 'Verification requested', variant: 'warning' },
  verified: { label: 'Verified', variant: 'success' },
};

/**
 * UnverifiedTab — the student's SelfReportedAchievement records, visually
 * distinct from verified BlockWards (dashed, muted cards).
 */
export default function UnverifiedTab({ items }) {
  if (!items || items.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="Nothing self-reported yet"
        description="Add achievements yourself from the dashboard — you can ask an organisation to verify them later, and verified ones become permanent BlockWards."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {items.map(s => {
        const badge = STATUS_BADGE[s.status] || STATUS_BADGE.unverified;
        return (
          <div
            key={s.id}
            className={cn(
              "rounded-xl border-2 border-dashed border-border bg-muted/10 p-5",
              s.status === 'verified' && "border-solid border-success/40 bg-success/5"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-medium text-foreground leading-tight">{s.title}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {s.domain}
                  {s.organisation_name && ` · ${s.organisation_name}`}
                  {s.date_achieved && ` · ${format(new Date(s.date_achieved), 'MMM d, yyyy')}`}
                </p>
              </div>
              <Badge variant={badge.variant} className="flex-shrink-0">{badge.label}</Badge>
            </div>
            {s.description && (
              <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{s.description}</p>
            )}
            <p className="text-xs text-muted-foreground/70 mt-3">
              {s.status === 'verified'
                ? 'Verified and published — it now lives in your BlockWards.'
                : s.status === 'verification_requested'
                ? 'Waiting for your organisation to verify this.'
                : 'Self-reported — ask your organisation to verify it to make it permanent.'}
            </p>
          </div>
        );
      })}
    </div>
  );
}