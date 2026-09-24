import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Megaphone } from 'lucide-react';
import { format } from 'date-fns';

/**
 * TeacherAnnouncementsCard — the most recent announcements visible to this
 * teacher (school-wide, their classes, or their own posts). Priority is
 * surfaced as a badge; urgent items tint the row.
 */
export default function TeacherAnnouncementsCard({ items = [] }) {
  return (
    <Card className="surface-card card-hover">
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center"><Megaphone className="h-4 w-4 text-primary" /></div>
          <div><p className="text-sm font-semibold text-foreground">Announcements</p><p className="text-xs text-muted-foreground">Recent</p></div>
        </div>
        {items.length > 0 ? (
          <div className="space-y-2">
            {items.map(a => (
              <div
                key={a.id}
                className={`p-2.5 rounded-lg border ${a.priority === 'urgent' ? 'bg-destructive/10 border-destructive/30' : a.priority === 'important' ? 'bg-warning/10 border-warning/30' : 'bg-muted/40 border-transparent'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground truncate">{a.title}</p>
                  <span className="text-[10px] text-tertiary flex-shrink-0">{a.sent_at ? format(new Date(a.sent_at), 'd MMM') : ''}</span>
                </div>
                {a.body_short && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{a.body_short}</p>}
                <p className="text-[10px] text-tertiary mt-1">{a.scope_type === 'SCHOOL' ? 'Whole school' : (a.class_name || 'Class')}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No recent announcements.</p>
        )}
      </CardContent>
    </Card>
  );
}