import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useSchool } from '@/lib/SchoolContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import EmptyState from '@/components/ui/empty-state';
import { Check, X, Clock, ClipboardCheck } from 'lucide-react';
import { format } from 'date-fns';

const STATUS = {
  present: { label: 'Present', icon: Check, cls: 'bg-success/15 text-success' },
  late: { label: 'Late', icon: Clock, cls: 'bg-warning/15 text-warning' },
  absent: { label: 'Absent', icon: X, cls: 'bg-destructive/15 text-destructive' },
  excused: { label: 'Excused', icon: ClipboardCheck, cls: 'bg-muted text-muted-foreground' },
};

export default function AttendanceWidget() {
  const { effectiveEmail } = useSchool();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!effectiveEmail) { setLoading(false); return; }
    (async () => {
      try {
        const recs = await base44.entities.AttendanceRecord.filter({ student_email: effectiveEmail }, '-date', 30);
        setRecords(recs);
      } catch (e) {
        console.error('AttendanceWidget load error', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [effectiveEmail]);

  const total = records.length;
  const attended = records.filter(r => r.status === 'present' || r.status === 'late').length;
  const rate = total ? Math.round((attended / total) * 100) : null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">My Attendance</CardTitle>
        {rate !== null && (
          <Badge variant={rate >= 85 ? 'success' : 'destructive'} className="min-w-[3rem] justify-center">
            {rate}%
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-16 animate-pulse bg-muted/40 rounded-lg" />
        ) : total === 0 ? (
          <EmptyState icon={ClipboardCheck} title="No attendance recorded yet" />
        ) : (
          <div className="space-y-1.5">
            {records.slice(0, 6).map(r => {
              const st = STATUS[r.status] || STATUS.present;
              const Ic = st.icon;
              return (
                <div key={r.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground truncate flex-1">
                    {r.date ? format(new Date(r.date), 'dd MMM') : '—'} · {r.class_name || 'Class'}
                  </span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs ${st.cls}`}>
                    <Ic className="h-3 w-3" />{st.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}