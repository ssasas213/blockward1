import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ClipboardCheck } from 'lucide-react';
import { format } from 'date-fns';

/**
 * WorkToMarkCard — turned-in student work in the teacher's classes that is
 * still awaiting a grade. Data comes from getDashboardData (persona-aware).
 */
export default function WorkToMarkCard({ items = [], count = 0 }) {
  return (
    <Card className="surface-card card-hover">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center"><ClipboardCheck className="h-4 w-4 text-primary" /></div>
            <div><p className="text-sm font-semibold text-foreground">Work to mark</p><p className="text-xs text-muted-foreground">{count} turned in</p></div>
          </div>
          {count > 0 && <Badge variant="warning">{count}</Badge>}
        </div>
        {items.length > 0 ? (
          <div className="space-y-2">
            {items.map(s => (
              <Link
                key={s.id}
                to={createPageUrl(`ClassDetail?id=${s.class_id}`)}
                className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-muted/40 hover:bg-hover transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm text-foreground truncate">{s.student_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{s.assignment_title}</p>
                </div>
                <span className="text-[10px] text-tertiary flex-shrink-0">
                  {s.submitted_at ? format(new Date(s.submitted_at), 'd MMM') : ''}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Nothing to mark right now.</p>
        )}
      </CardContent>
    </Card>
  );
}