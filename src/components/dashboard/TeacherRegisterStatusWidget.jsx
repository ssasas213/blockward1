import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useSchool } from '@/lib/SchoolContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ClipboardCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

const todayStr = () => format(new Date(), 'yyyy-MM-dd');

/**
 * TeacherRegisterStatusWidget — "today's registers" compact panel for the
 * teacher dashboard. Each scheduled lesson shows whether the class register
 * has been taken, the counts when it has, and a one-click Take Register
 * launch (preselects the class and links the session to the timetable
 * lesson). Register data only — BlockWard is not the statutory MIS.
 */
export default function TeacherRegisterStatusWidget() {
  const { activeSchool, effectiveEmail } = useSchool();
  const [loading, setLoading] = useState(true);
  const [lessons, setLessons] = useState([]);

  useEffect(() => {
    if (!activeSchool?.id || !effectiveEmail) { setLoading(false); return; }
    (async () => {
      try {
        const dayIndex = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
        const [entries, sessions] = await Promise.all([
          base44.entities.TimetableEntry.filter({ school_id: activeSchool.id, day_of_week: dayIndex }),
          base44.entities.AttendanceSession.filter({ school_id: activeSchool.id, date: todayStr() }),
        ]);
        const mine = (entries || [])
          .filter(e => e.teacher_email === effectiveEmail)
          .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
        setLessons(mine.map(e => ({ ...e, session: sessions.find(s => s.class_id === e.class_id) || null })));
      } catch (e) {
        console.error('TeacherRegisterStatusWidget load', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [activeSchool?.id, effectiveEmail]);

  if (loading) {
    return (
      <Card className="shadow-sm">
        <CardContent className="py-6 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }
  if (lessons.length === 0) return null;

  const completed = lessons.filter(l => l.session).length;
  const nowHM = format(new Date(), 'HH:mm');

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-primary" />
          Today's Registers
        </CardTitle>
        <Badge variant={completed === lessons.length ? 'success' : 'secondary'}>
          {completed}/{lessons.length} complete
        </Badge>
      </CardHeader>
      <CardContent className="space-y-2">
        {lessons.map(l => {
          const done = !!l.session;
          const past = (l.end_time || '23:59') < nowHM;
          return (
            <div key={l.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className="text-center min-w-[52px]">
                <p className="text-sm font-medium text-foreground">{l.start_time}</p>
                <p className="text-xs text-muted-foreground">{l.end_time}</p>
              </div>
              <div className="w-px h-10 bg-border" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-sm truncate">{l.class_name || l.subject}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {done
                    ? `${(l.session.present_count || 0) + (l.session.late_count || 0)} present · ${l.session.absent_count || 0} absent${l.session.late_count ? ` · ${l.session.late_count} late` : ''}`
                    : past ? 'Register missing' : 'Register not taken yet'}
                </p>
              </div>
              {done ? (
                <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
              ) : past ? (
                <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
              ) : null}
              <Button asChild size="sm" variant={done ? 'outline' : 'default'}>
                <Link to={createPageUrl(`Attendance?class=${l.class_id}&tt=${l.id}`)}>
                  {done ? 'View' : 'Take Register'}
                </Link>
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}