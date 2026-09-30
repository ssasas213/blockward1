import React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { formatDateTime } from '@/lib/achievementStatus';

const ACTION_TONE = {
  approve: 'text-success', reject: 'text-destructive', suspend: 'text-warning',
  restore: 'text-info', request_info: 'text-info',
};

export default function ConsoleAuditLog({ entries }) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground">Audit log</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Append-only record of internal admin actions on issuer organisations.</p>
      </div>
      {!entries?.length ? (
        <Card className="surface-card"><CardContent className="py-10 text-center text-sm text-muted-foreground">No admin actions recorded yet.</CardContent></Card>
      ) : (
        <div className="surface-card rounded-lg divide-y divide-border/60">
          {entries.map((e) => (
            <div key={e.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className={cn('font-semibold capitalize', ACTION_TONE[e.action] || 'text-foreground')}>{e.action}</span>
                  <span className="text-foreground"> · {e.org_name}</span>
                  <span className="text-tertiary"> · {e.previous_status} → {e.new_status}</span>
                </p>
                {e.reason && <p className="text-xs text-muted-foreground mt-0.5">"{e.reason}"</p>}
              </div>
              <div className="text-xs text-tertiary sm:text-right">
                <p>{e.admin_email}</p>
                <p>{formatDateTime(e.timestamp)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}