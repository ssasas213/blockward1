import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Loader2, Save, Shuffle, ClipboardCheck, Pencil, Eye, CalendarDays, CheckCheck, Eraser } from 'lucide-react';
import { format } from 'date-fns';
import ClassroomCanvas from './ClassroomCanvas';
import UnassignedStudents from './UnassignedStudents';
import EditLayoutPanel from './EditLayoutPanel';
import AttendanceHistory from './AttendanceHistory';
import { TEMPLATES, autoArrange, clearSeats, flattenSeats, ATTENDANCE_STATUSES } from './templates';

const todayStr = () => format(new Date(), 'yyyy-MM-dd');
const STATUS_CYCLE = ['present', 'late', 'absent', 'excused'];

export default function SeatingPlanTab({ classId, canEdit }) {
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState([]);
  const [activePlanId, setActivePlanId] = useState(null);
  const [layout, setLayout] = useState(null);
  const [roster, setRoster] = useState([]);
  const [mode, setMode] = useState('view'); // view | edit | attendance
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // attendance
  const [attDate, setAttDate] = useState(todayStr());
  const [marks, setMarks] = useState({}); // email -> status
  const [serverMarks, setServerMarks] = useState({});
  const [savingAtt, setSavingAtt] = useState(false);

  useEffect(() => { if (classId) loadPlan(); }, [classId]);

  const loadPlan = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('seatingPlanData', { class_id: classId });
      const d = res.data || {};
      if (d.error) throw new Error(d.error);
      setPlans(d.plans || []);
      setRoster(d.roster || []);
      setActivePlanId(d.active_plan?.id || null);
      setLayout(d.active_layout || TEMPLATES.blank.build(0));
    } catch (e) { toast.error(e.message || 'Failed to load seating plan'); }
    finally { setLoading(false); }
  };

  const assignedEmails = useMemo(() => {
    const s = new Set();
    for (const el of (layout?.elements || [])) if (el.type === 'desk') for (const a of (el.assignments || [])) if (a) s.add(a);
    return s;
  }, [layout]);

  const setSeat = (elementId, seatIndex, email) => {
    setLayout(prev => {
      const elements = (prev?.elements || []).map(el => {
        if (el.id !== elementId || el.type !== 'desk') return el;
        const assignments = [...(el.assignments || Array(el.seats || 1).fill(null))];
        // if swapping, find where this student currently sits and clear it
        if (email) {
          for (const e2 of (prev?.elements || [])) if (e2.type === 'desk') {
            (e2.assignments || []).forEach((a, i) => { if (a === email) e2.assignments[i] = null; });
          }
        }
        assignments[seatIndex] = email;
        return { ...el, assignments };
      });
      return { ...prev, elements };
    });
    setDirty(true);
  };

  const onSeatClick = (elementId, seatIndex, currentEmail) => {
    if (mode === 'edit') {
      if (selectedEmail) {
        // place selected student here (swap handles existing occupant)
        setSeat(elementId, seatIndex, selectedEmail);
        setSelectedEmail(null);
      } else if (currentEmail) {
        setSelectedEmail(currentEmail); // pick up to move
      }
    } else if (mode === 'attendance') {
      const cur = marks[currentEmail] || 'unmarked';
      let next;
      if (cur === 'unmarked') next = 'present';
      else next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(cur) + 1) % STATUS_CYCLE.length];
      setMarks(prev => ({ ...prev, [currentEmail]: next }));
    }
  };

  const onDropStudent = (email, elementId) => {
    const el = (layout?.elements || []).find(e => e.id === elementId);
    if (!el) return;
    const freeIdx = (el.assignments || []).findIndex(a => !a);
    if (freeIdx === -1) { toast.error('That desk is full'); return; }
    setSeat(elementId, freeIdx, email);
  };

  const onUnassign = (elementId, seatIndex) => {
    setLayout(prev => ({ ...prev, elements: (prev?.elements || []).map(el => el.id === elementId && el.type === 'desk' ? { ...el, assignments: (el.assignments || []).map((a, i) => i === seatIndex ? null : a) } : el) }));
    setDirty(true);
  };

  const onDropElement = (id, px, py) => {
    setLayout(prev => ({ ...prev, elements: (prev?.elements || []).map(el => el.id === id ? { ...el, x: Math.max(0, Math.round(px - el.w / 2)), y: Math.max(0, Math.round(py - el.h / 2)) } : el) }));
    setDirty(true);
  };

  const addElement = (el) => { setLayout(prev => ({ ...prev, elements: [...(prev?.elements || []), el] })); setDirty(true); };
  const applyTemplate = (key) => { setLayout(TEMPLATES[key].build(roster.length)); setDirty(true); toast.success('Template applied — drag desks to arrange'); };
  const doClearSeats = () => { setLayout(prev => clearSeats(prev)); setDirty(true); };
  const doAutoArrange = (modeKey) => { setLayout(prev => autoArrange(prev, roster, modeKey)); setDirty(true); toast.success('Students arranged'); };

  const savePlan = async () => {
    setSaving(true);
    try {
      const res = await base44.functions.invoke('saveSeatingPlan', { class_id: classId, plan_id: activePlanId, name: plans.find(p => p.id === activePlanId)?.name || 'Default', layout_json: layout, is_default: true });
      if (res.data?.error) throw new Error(res.data.error);
      toast.success('Seating plan saved');
      setDirty(false);
      await loadPlan();
    } catch (e) { toast.error(e.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const loadAttendance = async (date) => {
    if (!date) return;
    try {
      const res = await base44.functions.invoke('getAttendance', { class_id: classId, date });
      const d = res.data || {};
      const existing = d.marks || {};
      setServerMarks(existing);
      const init = {};
      for (const s of roster) init[s.student_email] = existing[s.student_email]?.status || 'present';
      setMarks(init);
    } catch (e) { toast.error(e.message || 'Failed to load attendance'); }
  };

  const startAttendance = async () => {
    setMode('attendance');
    setSelectedEmail(null);
    await loadAttendance(attDate);
  };

  const markAll = (status) => { const next = {}; for (const s of roster) next[s.student_email] = status; setMarks(next); };
  const clearAtt = () => { const next = {}; for (const s of roster) next[s.student_email] = 'present'; setMarks(next); };

  const saveAttendance = async () => {
    setSavingAtt(true);
    try {
      const payload = roster.map(s => ({ student_email: s.student_email, student_name: s.student_name, status: marks[s.student_email] || 'present' }));
      const res = await base44.functions.invoke('saveAttendance', { class_id: classId, date: attDate, marks: payload });
      if (res.data?.error) throw new Error(res.data.error);
      toast.success('Attendance saved');
      await loadAttendance(attDate);
    } catch (e) { toast.error(e.message || 'Failed to save attendance'); }
    finally { setSavingAtt(false); }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      {/* Top controls */}
      <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2">
          <select value={activePlanId || ''} onChange={async e => { const id = e.target.value; setActivePlanId(id); setDirty(false); try { const found = await base44.entities.SeatingPlan.filter({ id }); if (found[0]) setLayout(found[0].layout_json || TEMPLATES.blank.build(0)); } catch (err) { toast.error('Could not load plan'); } }} className="h-9 rounded-lg bg-background border border-border px-2 text-sm text-foreground">
            {plans.length === 0 && <option value="">Default</option>}
            {plans.map(p => <option key={p.id} value={p.id}>{p.name}{p.is_default ? ' ★' : ''}</option>)}
          </select>
        </div>
        {canEdit && (
          <>
            <Button variant={mode === 'edit' ? 'default' : 'outline'} size="sm" onClick={() => { setMode(mode === 'edit' ? 'view' : 'edit'); setSelectedEmail(null); }}><Pencil className="h-4 w-4" />{mode === 'edit' ? 'Done Editing' : 'Edit Layout'}</Button>
            <div className="relative group">
              <Button variant="outline" size="sm" onClick={() => doAutoArrange('alphabetical')}><Shuffle className="h-4 w-4" />Auto Arrange</Button>
              <div className="absolute left-0 top-9 z-10 hidden group-hover:flex flex-col bg-popover border border-border rounded-lg shadow-lg p-1 min-w-[160px]">
                {['alphabetical', 'random', 'spread'].map(m => <button key={m} onClick={() => doAutoArrange(m)} className="text-left px-2.5 py-1.5 rounded text-xs text-foreground hover:bg-hover capitalize">{m.replace('_', ' ')}</button>)}
              </div>
            </div>
            <Button variant={mode === 'attendance' ? 'default' : 'outline'} size="sm" onClick={startAttendance}><ClipboardCheck className="h-4 w-4" />Take Attendance</Button>
            <Button size="sm" onClick={savePlan} disabled={saving || !dirty}><Save className="h-4 w-4" />{saving ? 'Saving…' : 'Save'}</Button>
          </>
        )}
        <span className="text-xs text-muted-foreground ml-auto">{roster.length} students · Room {layout?.room?.label || '—'}</span>
      </div>

      {mode === 'attendance' && (
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl border border-info/30 bg-info/10">
          <CalendarDays className="h-4 w-4 text-info" />
          <input type="date" value={attDate} max={todayStr()} onChange={e => { setAttDate(e.target.value); loadAttendance(e.target.value); }} className="h-9 rounded-lg bg-background border border-border px-2 text-sm text-foreground" />
          <Button variant="outline" size="sm" onClick={() => markAll('present')}><CheckCheck className="h-4 w-4" />Mark All Present</Button>
          <Button variant="outline" size="sm" onClick={clearAtt}><Eraser className="h-4 w-4" />Clear</Button>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{Object.values(marks).filter(m => m === 'present' || m === 'late').length} / {roster.length} present</span>
            <Button size="sm" onClick={saveAttendance} disabled={savingAtt}><Save className="h-4 w-4" />{savingAtt ? 'Saving…' : 'Save Attendance'}</Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
        <div className="space-y-3">
          {mode === 'edit' && <EditLayoutPanel layout={layout} onLayout={setLayout} onAddElement={addElement} onApplyTemplate={applyTemplate} onClearSeats={doClearSeats} />}
          {layout && <ClassroomCanvas layout={layout} students={roster} marks={marks} mode={mode} selectedEmail={selectedEmail} onSeatClick={onSeatClick} onUnassign={onUnassign} onDropStudent={onDropStudent} onDropElement={onDropElement} />}
          {/* Status legend in attendance mode */}
          {mode === 'attendance' && (
            <div className="flex flex-wrap items-center gap-3 px-1 text-xs">
              {ATTENDANCE_STATUSES.map(s => <span key={s.key} className="inline-flex items-center gap-1.5"><span className={`h-3 w-3 rounded border ${s.ring} ${s.bg}`} />{s.label}</span>)}
            </div>
          )}
        </div>
        <div className="space-y-4">
          {canEdit && mode === 'edit' && <UnassignedStudents roster={roster} assignedEmails={assignedEmails} selectedEmail={selectedEmail} onSelect={setSelectedEmail} />}
          {canEdit && mode !== 'edit' && <AttendanceHistory classId={classId} />}
        </div>
      </div>
    </div>
  );
}