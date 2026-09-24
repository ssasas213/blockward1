import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CalendarDays } from 'lucide-react';
import { format } from 'date-fns';

const TYPE_LABEL = {
  assembly: 'Assembly',
  holiday: 'Holiday',
  exam_period: 'Exams',
  deadline: 'Deadline',
  event: 'Event',
};

/**
 * UpcomingEventsCard — the next scheduled school events (any type) for the
 * teacher's school, with a link to the full calendar.
 */
export default function UpcomingEventsCard({ events = [] }) {
  return (
    <Card className="surface-card card-hover">
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center"><CalendarDays className="h-4 w-4 text-primary" /></div>
          <div><p className="text-sm font-semibold text-foreground">Coming up</p><p className="text-xs text-muted-foreground">School events</p></div>
        </div>
        {events.length > 0 ? (
          <div className="space-y-2">
            {events.map(e => (
              <div key={e.id} className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-muted/40">
                <div className="min-w-0">
                  <p className="text-sm text-foreground truncate">{e.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {format(new Date(e.start_time), 'EEE d MMM · HH:mm')}{e.location ? ` · ${e.location}` : ''}
                  </p>
                </div>
                <Badge variant="outline" className="text-[10px] flex-shrink-0">{TYPE_LABEL[e.event_type] || 'Event'}</Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No upcoming events.</p>
        )}
        <Link to={createPageUrl('SchoolCalendar')} className="inline-flex items-center text-xs font-medium text-primary hover:underline mt-3">
          Full calendar →
        </Link>
      </CardContent>
    </Card>
  );
}