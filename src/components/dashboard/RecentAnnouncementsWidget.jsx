import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useSchool } from '@/lib/SchoolContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/ui/empty-state';
import { Megaphone, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

/**
 * RecentAnnouncementsWidget — the latest school, year-group and class
 * announcements visible to this student (the same visibility rules the
 * Announcement RLS enforces server-side).
 */
export default function RecentAnnouncementsWidget() {
  const { user, profile } = useSchool();
  const [items, setItems] = useState(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const sid = profile?.school_id || null;
        const anns = await base44.entities.Announcement.filter(sid ? { school_id: sid } : {}).catch(() => []);
        const myEmail = String(user.email || '').toLowerCase();
        const myClassIds = profile?.class_ids || [];
        const visible = (anns || []).filter((a) =>
          a.status === 'sent' &&
          (a.scope_type === 'SCHOOL' ||
            a.scope_type === 'YEAR_GROUP' ||
            (a.scope_type === 'CLASS' && myClassIds.includes(a.class_id)) ||
            ((a.scope_type === 'STUDENTS' || a.scope_type === 'TEAM') &&
              (a.student_emails || []).some((e) => String(e).toLowerCase() === myEmail)))
        );
        visible.sort((a, b) => String(b.sent_at || '').localeCompare(String(a.sent_at || '')));
        setItems(visible.slice(0, 5));
      } catch (e) {
        setItems([]);
      }
    })();
  }, [user, profile?.school_id, profile?.class_ids]);

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-primary" /> Announcements
        </CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link to={createPageUrl('SchoolCalendar')}>
            View All
            <ChevronRight className="h-4 w-4 ml-1" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {items === null ? (
          <div className="space-y-2" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 rounded-lg bg-muted/60 animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon={Megaphone} title="No announcements yet" description="School and class news will appear here." />
        ) : (
          <div className="space-y-2">
            {items.map((a) => (
              <div key={a.id} className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {a.priority && a.priority !== 'normal' && (
                    <Badge variant={a.priority === 'urgent' ? 'destructive' : 'warning'} className="text-[10px] capitalize">
                      {a.priority}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-[10px]">
                    {a.scope_type === 'SCHOOL' ? 'School'
                      : a.scope_type === 'CLASS' ? a.class_name || 'Class'
                      : a.scope_type === 'YEAR_GROUP' ? a.year_group_name || 'Year group'
                      : 'Notice'}
                  </Badge>
                  {a.sent_at && (
                    <span className="text-xs text-tertiary ml-auto">{format(new Date(a.sent_at), 'd MMM')}</span>
                  )}
                </div>
                <p className="font-medium text-foreground text-sm">{a.title}</p>
                {a.body_short && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{a.body_short}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}