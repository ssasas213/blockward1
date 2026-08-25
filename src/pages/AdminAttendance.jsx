import React, { useEffect, useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useSchool } from '@/lib/SchoolContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import PageHeader from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import EmptyState from '@/components/ui/empty-state';
import { Loader2, ClipboardCheck, TrendingDown } from 'lucide-react';

function isoWeek(dStr) {
  const d = new Date(dStr);
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((date - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

const rateOf = (recs) => {
  if (!recs.length) return null;
  const attended = recs.filter(r => r.status === 'present' || r.status === 'late').length;
  return Math.round((attended / recs.length) * 100);
};

function AdminAttendanceContent() {
  const { activeSchool, loading } = useSchool();
  const [records, setRecords] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [threshold, setThreshold] = useState(85);

  useEffect(() => {
    if (!activeSchool?.id) { setLoadingData(false); return; }
    (async () => {
      try {
        const [recs, cls] = await Promise.all([
          base44.entities.AttendanceRecord.filter({ school_id: activeSchool.id }, '-date', 1000),
          base44.entities.Class.filter({ school_id: activeSchool.id }),
        ]);
        setRecords(recs);
        setClasses(cls);
      } catch (e) {
        console.error('AdminAttendance load error', e);
      } finally {
        setLoadingData(false);
      }
    })();
  }, [activeSchool?.id]);

  const className = (id) => classes.find(c => c.id === id)?.name || 'Unknown class';

  const byClass = useMemo(() => {
    const map = {};
    for (const r of records) { (map[r.class_id] = map[r.class_id] || []).push(r); }
    return Object.entries(map)
      .map(([id, recs]) => ({ class_id: id, name: className(id), rate: rateOf(recs), count: recs.length }))
      .sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1));
  }, [records, classes]);

  const byWeek = useMemo(() => {
    const map = {};
    for (const r of records) { const w = isoWeek(r.date); (map[w] = map[w] || []).push(r); }
    return Object.entries(map)
      .map(([week, recs]) => ({ week, rate: rateOf(recs), count: recs.length }))
      .sort((a, b) => a.week.localeCompare(b.week));
  }, [records]);

  const belowThreshold = useMemo(() => {
    const map = {};
    for (const r of records) {
      (map[r.student_email] = map[r.student_email] || { name: r.student_name, email: r.student_email, recs: [] });
      map[r.student_email].recs.push(r);
    }
    return Object.values(map)
      .map(s => ({ ...s, rate: rateOf(s.recs) }))
      .filter(s => s.rate !== null && s.rate < threshold)
      .sort((a, b) => a.rate - b.rate);
  }, [records, threshold]);

  if (loading || loadingData) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance Insights"
        description={activeSchool ? `School-wide attendance for ${activeSchool.name}` : 'School-wide attendance'}
      />

      {records.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="No attendance recorded yet"
          description="Once teachers start taking registers, attendance rates by class and week will appear here."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Attendance rate by class</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {byClass.map(c => (
                    <div key={c.class_id} className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-hover/50">
                      <span className="text-sm text-foreground truncate flex-1">{c.name}</span>
                      <span className="text-xs text-muted-foreground">{c.count} marks</span>
                      <Badge variant={c.rate >= threshold ? 'success' : 'destructive'} className="min-w-[3rem] justify-center">{c.rate}%</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Attendance rate by week</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {byWeek.map(w => (
                    <div key={w.week} className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-hover/50">
                      <span className="text-sm text-foreground font-mono">{w.week}</span>
                      <span className="text-xs text-muted-foreground">{w.count} marks</span>
                      <Badge variant={w.rate >= threshold ? 'success' : 'destructive'} className="min-w-[3rem] justify-center">{w.rate}%</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-destructive" />Students below threshold
              </CardTitle>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">Below</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={threshold}
                  onChange={e => setThreshold(Number(e.target.value))}
                  className="w-16 h-8 rounded-md bg-background border border-border px-2 text-sm text-foreground"
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </CardHeader>
            <CardContent>
              {belowThreshold.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No students below {threshold}%.</p>
              ) : (
                <div className="space-y-1.5">
                  {belowThreshold.map(s => (
                    <div key={s.email} className="flex items-center justify-between gap-3 p-2 rounded-lg bg-destructive/5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{s.email}</p>
                      </div>
                      <Badge variant="destructive" className="min-w-[3rem] justify-center">{s.rate}%</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

export default function AdminAttendance() {
  return (
    <ProtectedRoute>
      <AdminAttendanceContent />
    </ProtectedRoute>
  );
}