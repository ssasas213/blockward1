import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useSchool } from '@/lib/SchoolContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import PageHeader from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import EmptyState from '@/components/ui/empty-state';
import { ClipboardCheck, CalendarDays, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import AttendanceRegister from '@/components/attendance/AttendanceRegister';
import AttendanceWidget from '@/components/dashboard/AttendanceWidget';

const todayStr = () => format(new Date(), 'yyyy-MM-dd');

function AttendanceContent() {
  const { effectiveRole, effectiveEmail, activeSchool, loading } = useSchool();
  const navigate = useNavigate();
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [date, setDate] = useState(todayStr());
  const [loadingClasses, setLoadingClasses] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (effectiveRole === 'admin') {
      navigate(createPageUrl('AdminAttendance'), { replace: true });
      return;
    }
    if (effectiveRole === 'teacher' && activeSchool?.id && effectiveEmail) {
      loadClasses();
    } else {
      setLoadingClasses(false);
    }
  }, [effectiveRole, activeSchool, effectiveEmail, loading]);

  const loadClasses = async () => {
    try {
      const all = await base44.entities.Class.filter({ school_id: activeSchool.id });
      const mine = all.filter(c => c.teacher_email === effectiveEmail);
      setClasses(mine);
      if (mine.length > 0) setSelectedClass(mine[0].id);
    } catch (e) {
      console.error('Attendance loadClasses error', e);
    } finally {
      setLoadingClasses(false);
    }
  };

  if (loading || effectiveRole === 'admin') return null;

  if (effectiveRole === 'student') {
    return (
      <div className="space-y-6">
        <PageHeader title="My Attendance" description="Your attendance record and rate" />
        <AttendanceWidget />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <PageHeader title="Take Attendance" description="Mark your class register" />

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Class</label>
              <select
                value={selectedClass || ''}
                onChange={e => setSelectedClass(e.target.value)}
                className="w-full h-10 rounded-lg bg-background border border-border px-3 text-sm text-foreground focus:outline-none focus:border-primary/40"
              >
                {classes.length === 0 && <option value="">No classes</option>}
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Date</label>
              <div className="relative">
                <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  type="date"
                  value={date}
                  max={todayStr()}
                  onChange={e => setDate(e.target.value)}
                  className="w-full h-10 pl-9 pr-3 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:border-primary/40"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {loadingClasses ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !selectedClass ? (
        <EmptyState icon={ClipboardCheck} title="No classes yet" description="Create a class first to take attendance." />
      ) : (
        <AttendanceRegister classId={selectedClass} date={date} />
      )}
    </div>
  );
}

export default function Attendance() {
  return (
    <ProtectedRoute>
      <AttendanceContent />
    </ProtectedRoute>
  );
}