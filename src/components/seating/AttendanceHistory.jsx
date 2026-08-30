import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import EmptyState from '@/components/ui/empty-state';
import { Loader2, CalendarDays, ClipboardCheck } from 'lucide-react';
import { format } from 'date-fns';

export default function AttendanceHistory({ classId }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!classId) return;
    (async () => {
      try {
        const list = await base44.entities.AttendanceSession.filter({ class_id: classId }, '-date', 50);
        setSessions(list);
      } catch (e) { console.error('AttendanceHistory load', e); }
      finally { setLoading(false); }
    })();
  }, [classId]);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!sessions.length) return <EmptyState icon={ClipboardCheck} title="No attendance history yet" description="Saved registers will appear here." />;

  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" />Attendance History</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {sessions.map(s => (
          <div key={s.id} className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-border bg-background">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{s.date ? format(new Date(s.date), 'EEE dd MMM') : '—'}</p>
              {s.academic_term_name && <p className="text-xs text-muted-foreground truncate">{s.academic_term_name}</p>}
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Badge variant="success" className="justify-center min-w-[2rem]">{s.present_count}</Badge>
              <Badge variant="destructive" className="justify-center min-w-[2rem]">{s.absent_count}</Badge>
              <Badge variant="warning" className="justify-center min-w-[2rem]">{s.late_count}</Badge>
              <Badge variant="secondary" className="justify-center min-w-[2rem]">{s.excused_count}</Badge>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}