import React, { useEffect, useRef, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import EmptyState from '@/components/ui/empty-state';
import { Check, X, Clock, ClipboardCheck, Loader2, Save, Users, CheckCircle2, Keyboard, CloudUpload } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const STATUSES = [
  { key: 'present', label: 'Present', letter: 'P', keyHint: '/ or Space', icon: Check, active: 'bg-success text-success-foreground', idle: 'text-success' },
  { key: 'late', label: 'Late', letter: 'L', keyHint: 'L', icon: Clock, active: 'bg-warning text-warning-foreground', idle: 'text-warning' },
  { key: 'absent', label: 'Absent', letter: 'A', keyHint: 'N', icon: X, active: 'bg-destructive text-destructive-foreground', idle: 'text-destructive' },
  { key: 'excused', label: 'Excused', letter: 'E', keyHint: 'E', icon: ClipboardCheck, active: 'bg-muted text-foreground', idle: 'text-muted-foreground' },
];
const STATUS_OF = Object.fromEntries(STATUSES.map(s => [s.key, s]));

const Key = ({ children }) => (
  <kbd className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-md border border-border bg-secondary text-[10px] font-semibold text-foreground shadow-sm">
    {children}
  </kbd>
);

/**
 * AttendanceRegister — fast by keyboard first, mouse/touch still fully working.
 * One row is focused at a time; marking keys mark AND auto-advance. The
 * register autosaves each change (only the changed students) with a quiet
 * saved indicator, so a closed tab or flat battery never loses the register.
 * All writes go through saveAttendance, so the audit log behaviour
 * (who made each change and when) is unchanged.
 */
export default function AttendanceRegister({ classId, date }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [roster, setRoster] = useState([]);
  const [marks, setMarks] = useState({});
  const [serverMarks, setServerMarks] = useState({});
  const [focusedIdx, setFocusedIdx] = useState(0);
  const [autosave, setAutosave] = useState({ state: 'idle', at: null }); // idle | saving | saved | failed

  const containerRef = useRef(null);
  const saveRef = useRef(null);
  const rowRefs = useRef({});
  const touchedRef = useRef(new Set()); // students explicitly marked this session
  const dirtyRef = useRef(new Set()); // students with unsaved changes
  const inFlightRef = useRef(false);
  const timerRef = useRef(null);
  const marksRef = useRef({});

  useEffect(() => { marksRef.current = marks; }, [marks]);

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
      marksRef.current = initial;
      touchedRef.current = new Set();
      dirtyRef.current = new Set();
      // Focus the first unmarked student when the register opens
      setFocusedIdx(0);
      requestAnimationFrame(() => containerRef.current?.focus({ preventScroll: true }));
    } catch (e) {
      toast.error(e.message || 'Failed to load register');
      setRoster([]);
      setServerMarks({});
    } finally {
      setLoading(false);
    }
  };

  // ─────────────── autosave (only the changed students) ───────────────
  const flushAutosave = useCallback(async () => {
    if (inFlightRef.current || dirtyRef.current.size === 0 || !classId || !date) return;
    const emails = [...dirtyRef.current];
    dirtyRef.current = new Set();
    const payload = emails
      .map((e) => {
        const s = roster.find(r => r.student_email === e);
        if (!s) return null;
        return { student_email: e, student_name: s.student_name, status: marksRef.current[e] || 'present' };
      })
      .filter(Boolean);
    if (!payload.length) return;
    inFlightRef.current = true;
    setAutosave({ state: 'saving', at: null });
    try {
      const res = await base44.functions.invoke('saveAttendance', { class_id: classId, date, marks: payload });
      if (res.data?.error) throw new Error(res.data.error);
      setServerMarks(prev => {
        const next = { ...prev };
        for (const m of payload) next[m.student_email] = { ...(next[m.student_email] || {}), status: m.status };
        return next;
      });
      setAutosave({ state: 'saved', at: new Date() });
    } catch {
      dirtyRef.current = new Set([...emails, ...dirtyRef.current]);
      setAutosave({ state: 'failed', at: null });
    } finally {
      inFlightRef.current = false;
      if (dirtyRef.current.size) scheduleAutosave();
    }
  }, [classId, date, roster]);

  const scheduleAutosave = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => flushAutosave(), 600);
  }, [flushAutosave]);

  useEffect(() => {
    const onHide = () => { if (dirtyRef.current.size) flushAutosave(); };
    window.addEventListener('pagehide', onHide);
    window.addEventListener('blur', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('blur', onHide);
      clearTimeout(timerRef.current);
    };
  }, [flushAutosave]);

  // ─────────────── marking ───────────────
  const mark = (email, status) => {
    setMarks(prev => ({ ...prev, [email]: status }));
    marksRef.current = { ...marksRef.current, [email]: status };
    touchedRef.current.add(email);
    dirtyRef.current.add(email);
    scheduleAutosave();
  };

  const setStatus = (email, status) => {
    mark(email, status);
    containerRef.current?.focus({ preventScroll: true }); // keep the keyboard flow going
  };

  const markAll = (status) => {
    const next = {};
    for (const s of roster) next[s.student_email] = status;
    setMarks(next);
    marksRef.current = next;
    for (const s of roster) { touchedRef.current.add(s.student_email); dirtyRef.current.add(s.student_email); }
    scheduleAutosave();
    // Every student is marked → hand focus to Save
    setFocusedIdx(-1);
    requestAnimationFrame(() => saveRef.current?.focus());
  };

  const advanceAfterMark = () => {
    const next = focusedIdx + 1;
    if (next >= roster.length) {
      setFocusedIdx(-1); // all rows done → Save button, never wrap around
      requestAnimationFrame(() => saveRef.current?.focus());
    } else {
      setFocusedIdx(next);
    }
  };

  const onKeyDown = (e) => {
    const key = e.key;
    const lower = key.toLowerCase();
    if (focusedIdx < 0 || focusedIdx >= roster.length) {
      if (key === 'Enter') { e.preventDefault(); save(); }
      return;
    }
    if (key === '/' || lower === 'l' || lower === 'n' || lower === 'e' || key === ' ') {
      e.preventDefault();
      const status = key === '/' || key === ' ' ? 'present' : lower === 'l' ? 'late' : lower === 'n' ? 'absent' : 'excused';
      mark(roster[focusedIdx].student_email, status);
      advanceAfterMark();
    } else if (key === 'Backspace') {
      e.preventDefault();
      // Clear the current row and move BACK one student
      const s = roster[focusedIdx];
      setMarks(prev => ({ ...prev, [s.student_email]: 'present' }));
      marksRef.current = { ...marksRef.current, [s.student_email]: 'present' };
      touchedRef.current.delete(s.student_email);
      dirtyRef.current.add(s.student_email);
      scheduleAutosave();
      setFocusedIdx(Math.max(0, focusedIdx - 1));
    } else if (key === 'ArrowDown') {
      e.preventDefault();
      if (focusedIdx < roster.length - 1) setFocusedIdx(focusedIdx + 1);
    } else if (key === 'ArrowUp') {
      e.preventDefault();
      if (focusedIdx > 0) setFocusedIdx(focusedIdx - 1);
      else { setFocusedIdx(-1); requestAnimationFrame(() => saveRef.current?.focus()); }
    } else if (key === 'Enter') {
      e.preventDefault();
      save();
    }
  };

  // Scroll the focused row into view
  useEffect(() => {
    if (focusedIdx >= 0 && rowRefs.current[focusedIdx]) {
      rowRefs.current[focusedIdx].scrollIntoView({ block: 'nearest' });
    }
  }, [focusedIdx]);

  const save = async () => {
    if (saving || !roster.length) return;
    if (inFlightRef.current) { setTimeout(save, 300); return; }
    clearTimeout(timerRef.current);
    setSaving(true);
    try {
      const payload = roster.map(s => ({
        student_email: s.student_email,
        student_name: s.student_name,
        status: marksRef.current[s.student_email] || 'present',
      }));
      const res = await base44.functions.invoke('saveAttendance', { class_id: classId, date, marks: payload });
      if (res.data?.error) throw new Error(res.data.error);
      dirtyRef.current = new Set();
      toast.success(alreadyTaken ? 'Attendance updated' : 'Attendance saved');
      setAutosave({ state: 'saved', at: new Date() });
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

  const alreadyTaken = Object.keys(serverMarks).length > 0;
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

      {/* Permanent key legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3 rounded-xl border border-border bg-card">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Keyboard className="h-4 w-4 text-primary" />Keyboard
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Key>/</Key><Key>Space</Key> Present</span>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Key>L</Key> Late</span>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Key>N</Key> Absent</span>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Key>E</Key> Excused</span>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Key>↑</Key><Key>↓</Key> Move</span>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Key>Backspace</Key> Clear &amp; back</span>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Key>Enter</Key> Save</span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => markAll('present')}
          className="inline-flex items-center h-8 px-3 rounded-md text-xs font-semibold bg-success/15 border border-success/40 text-success hover:bg-success/25 transition-colors"
        >
          <Check className="h-3.5 w-3.5 mr-1" />Mark all present
        </button>
        <span className="text-xs text-muted-foreground">then change only the exceptions — or mark all:</span>
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

      <div
        ref={containerRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="space-y-2 outline-none focus:ring-1 focus:ring-primary/30 rounded-xl"
        aria-label="Attendance register — use the keyboard to mark each student"
      >
        {roster.map((s, i) => {
          const cur = marks[s.student_email] || 'present';
          const st = STATUS_OF[cur] || STATUS_OF.present;
          const focused = i === focusedIdx;
          return (
            <div
              key={s.student_email}
              ref={(el) => { rowRefs.current[i] = el; }}
              className={`flex items-center gap-3 p-3 rounded-xl bg-card border transition-all ${focused ? 'border-primary ring-2 ring-primary/30 shadow-md' : 'border-border'}`}
            >
              <div className={`flex items-center justify-center h-8 w-8 rounded-full text-xs font-medium flex-shrink-0 ${focused ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'}`}>
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-sm truncate">{s.student_name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {s.student_email}
                  <span className={`ml-2 inline-flex items-center gap-1 font-medium ${st.idle}`}>
                    <st.icon className="h-3 w-3" />{st.letter} · {st.label}
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {STATUSES.map(st2 => {
                  const active = cur === st2.key;
                  const Ic = st2.icon;
                  return (
                    <button
                      key={st2.key}
                      onClick={() => setStatus(s.student_email, st2.key)}
                      aria-label={`${st2.label} — ${s.student_name}`}
                      aria-pressed={active}
                      title={`${st2.label} (${st2.keyHint})`}
                      className={`h-9 w-9 rounded-lg flex items-center justify-center border transition-colors ${active ? `${st2.active} border-transparent` : `border-border bg-background ${st2.idle} hover:bg-hover`}`}
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

      <div className="sticky bottom-0 -mx-4 px-4 py-3 bg-background border-t border-border flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">{presentCount} of {roster.length} present</p>
          {/* Quiet autosave indicator */}
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            {autosave.state === 'saving' && (<><CloudUpload className="h-3.5 w-3.5 animate-pulse" />Saving…</>)}
            {autosave.state === 'saved' && (<><CheckCircle2 className="h-3.5 w-3.5 text-success" />Saved {autosave.at ? format(autosave.at, 'HH:mm') : ''}</>)}
            {autosave.state === 'failed' && (<><X className="h-3.5 w-3.5 text-destructive" />Save failed — retrying</>)}
          </span>
        </div>
        <button
          ref={saveRef}
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