import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import RoleGuard from '@/components/auth/RoleGuard';
import PageHeader from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import EmptyState from '@/components/ui/empty-state';
import { Loader2, Check, X, Clock, ClipboardCheck, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';

const STATUS = {
  present: { label: 'Present', icon: Check, cls: 'bg-success/15 text-success' },
  late: { label: 'Late', icon: Clock, cls: 'bg-warning/15 text-warning' },
  absent: { label: 'Absent', icon: X, cls: 'bg-destructive/15 text-destructive' },
  excused: { label: 'Excused', icon: ClipboardCheck, cls: 'bg-muted text-muted-foreground' },
};

function StudentAttendanceContent() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await base44.functions.invoke('getStudentAttendance', {});
        const d = res.data || {};
        if (d.error) throw new Error(d.error);
        setData(d);
      } catch (e) { console.error('StudentAttendance load', e); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!data || data.total === 0) return <EmptyState icon={ClipboardCheck} title="No attendance recorded yet" description="Your teachers will mark your attendance in class." />;

  return (
    <div className="space-y-6">
      <PageHeader title="My Attendance" description="Your attendance record across all classes — read only." />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card><CardContent className="p-5 text-center"><p className="text-3xl font-bold text-foreground">{data.rate !== null ? `${data.rate}%` : '—'}</p><p className="text-xs text-muted-foreground mt-1">Overall Attendance</p></CardContent></Card>
        <Card><CardContent className="p-5 text-center"><p className="text-3xl font-bold text-success">{data.counts.present}</p><p className="text-xs text-muted-foreground mt-1">Present</p></CardContent></Card>
        <Card><CardContent className="p-5 text-center"><p className="text-3xl font-bold text-destructive">{data.counts.absent}</p><p className="text-xs text-muted-foreground mt-1">Absent</p></CardContent></Card>
        <Card><CardContent className="p-5 text-center"><p className="text-3xl font-bold text-warning">{data.counts.late}</p><p className="text-xs text-muted-foreground mt-1">Late</p></CardContent></Card>
      </div>

      {data.trend && data.trend.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" />Term Trend</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-end gap-1.5 h-32">
              {data.trend.map(t => (
                <div key={t.week} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full rounded-t bg-primary/30" style={{ height: `${t.rate ?? 0}%` }} title={`${t.week}: ${t.rate ?? '—'}%`} />
                  <span className="text-[9px] text-muted-foreground -rotate-45 origin-left whitespace-nowrap">{t.week.slice(-2)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Recent Attendance</CardTitle></CardHeader>
        <CardContent className="space-y-1.5">
          {data.recent.map((r, i) => {
            const st = STATUS[r.status] || STATUS.present;
            const Ic = st.icon;
            return (
              <div key={i} className="flex items-center justify-between gap-3 p-2 rounded-lg border border-border bg-background">
                <span className="text-sm text-muted-foreground truncate flex-1">{r.date ? format(new Date(r.date), 'dd MMM yyyy') : '—'} · {r.class_name || 'Class'}</span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs ${st.cls}`}><Ic className="h-3 w-3" />{st.label}</span>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

export default function StudentAttendance() {
  return <RoleGuard roles={['student']}><StudentAttendanceContent /></RoleGuard>;
}