import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Inbox } from 'lucide-react';

/**
 * TeacherInboxCard — unread direct-message count for the effective teacher,
 * with a one-tap jump to the Messages page.
 */
export default function TeacherInboxCard({ unread = 0 }) {
  return (
    <Card className="surface-card card-hover">
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center"><Inbox className="h-4 w-4 text-primary" /></div>
          <div><p className="text-sm font-semibold text-foreground">Inbox</p><p className="text-xs text-muted-foreground">Unread messages</p></div>
          {unread > 0 && <Badge variant="default" className="ml-auto">{unread}</Badge>}
        </div>
        <p className="text-3xl font-bold text-foreground mb-3">{unread}</p>
        <Link
          to={createPageUrl('Messages')}
          className="inline-flex items-center text-xs font-medium text-primary hover:underline"
        >
          Open messages →
        </Link>
      </CardContent>
    </Card>
  );
}