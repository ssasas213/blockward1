import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import EmptyState from '@/components/ui/empty-state';
import { Check, X, Clock, ClipboardCheck, Loader2, Save, Users, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const STATUSES = [
  { key: 'present', label: 'Present', icon: Check, active: 'bg-success text-success-foreground', idle: 'text-success' },
  { key: 'late', label: 'Late', icon: Clock, active: 'bg-warning text-warning-foreground', idle: 'text-warning' },
  { key: 'absent', label: 'Absent', icon: X, active: 'bg-destructive text-destructive-foreground', idle: 'text-destructive' },
  { key: 'excused', label: 'Excused', icon: ClipboardCheck, active: 'bg-muted text-foreground', idle: 'text-muted-foreground' },
];

export default function AttendanceRegister({ classId, date }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [roster, setRoster] = useState([]);
  const [marks, setMarks] = useState({});
  const [serverMarks, setServerMarks] = useState({});

  useEffect(() => {
    if (!classId || !date) return;
    loadRegister();
  }, [classId, date]);

  const loadRegister = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('getAttendance', { class_id: classId, date });
      const data = res.data || {};
      if (data.error) throw new Error(data.error);
      const r = data.roster || [];
      setRoster(r);
      const existing = data.marks || {};
      setServerMarks(existing);
      const initial = {};
      for (const s of r) initial[s.student_email] = existing[s.student_email]?.status || 'present';
      setMarks(initial);
    } catch (e) {
      toast.error(e.message || 'Failed to load register');
      setRoster([]);
      setServerMarks({});
    } finally {
      setLoading(false);
    }
  };

  const setStatus = (email, status) => setMarks(prev => ({ ...prev, [email]: status }));
  const markAll = (status) => {
    const next = {};
    for (const s of roster) next[s.student_email] = status;
    setMarks(next);
  };

  const alreadyTaken = Object.keys(serverMarks).length > 0;

  const save = async () => {
    setSaving(true);
    try {
      const payload = roster.map(s => ({
        student_email: s.student_email,
        student_name: s.student_name,
        status: marks[s.student_email] || 'present',
      }));
      const res = await base44.functions.invoke('saveAttendance', { class_id: classId, date, marks: payload });
      if (res.data?.error) throw new Error(res.data.error);
      toast.success(alreadyTaken ? 'Attendance updated' : 'Attendance saved');
      await loadRegister();
    } catch (e) {
      toast.error(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (roster.length === 0) {
    return <EmptyState icon={Users} title="No students enrolled" description="Enrol students in this class to take attendance." />;
  }

  const presentCount = Object.values(marks).filter(m => m === 'present' || m === 'late').length;

  return (
    <div className="space-y-4">
      {alreadyTaken && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-info/10 border border-info/20">
          <CheckCircle2 className="h-4 w-4 text-info flex-shrink-0" />
          <p className="text-sm text-foreground">
            Register already taken for {format(new Date(date), 'dd MMM yyyy')} — saving will update it.
          </p>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground">Mark all:</span>
        {STATUSES.map(s => (
          <button
            key={s.key}
            onClick={() => markAll(s.key)}
            className={`inline-flex items-center h-7 px-2.5 rounded-md text-xs font-medium border border-border bg-background ${s.idle} hover:bg-hover`}
          >
            <s.icon className="h-3 w-3 mr-1" />{s.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {roster.map((s, i) => {
          const cur = marks[s.student_email];
          return (
            <div key={s.student_email} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-secondary text-xs font-medium text-foreground flex-shrink-0">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-sm truncate">{s.student_name}</p>
                <p className="text-xs text-muted-foreground truncate">{s.student_email}</p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {STATUSES.map(st => {
                  const active = cur === st.key;
                  const Ic = st.icon;
                  return (
                    <button
                      key={st.key}
                      onClick={() => setStatus(s.student_email, st.key)}
                      aria-label={st.label}
                      className={`h-9 w-9 rounded-lg flex items-center justify-center border transition-colors ${active ? `${st.active} border-transparent` : `border-border bg-background ${st.idle} hover:bg-hover`}`}
                    >
                      <Ic className="h-4 w-4" />
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="sticky bottom-0 -mx-4 px-4 py-3 bg-background/85 backdrop-blur border-t border-border flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{presentCount} of {roster.length} present</p>
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-lg text-sm font-medium bg-gradient-to-br from-brand-violet via-primary to-brand-pink text-primary-foreground shadow-button disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {alreadyTaken ? 'Update' : 'Save'} Attendance
        </button>
      </div>
    </div>
  );
}