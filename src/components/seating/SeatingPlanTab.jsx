import React, { useEffect, useMemo, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Loader2, Save, Shuffle, ClipboardCheck, CalendarDays, CheckCheck, Eraser,
  SortAsc, Expand, Undo2, LayoutGrid, Users, Plus, Star, Trash2, Printer, Presentation, FlipHorizontal,
} from 'lucide-react';
import { format } from 'date-fns';
import ClassroomCanvas from './ClassroomCanvas';
import UnassignedStudents from './UnassignedStudents';
import EditLayoutPanel from './EditLayoutPanel';
import AttendanceHistory from './AttendanceHistory';
import ProjectorView from './ProjectorView';
import PrintableSeatingPlan from './PrintableSeatingPlan';
import { TEMPLATES, autoArrange, clearSeats, ATTENDANCE_STATUSES } from './templates';

const todayStr = () => format(new Date(), 'yyyy-MM-dd');
const STATUS_CYCLE = ['present', 'late', 'absent', 'excused'];

export default function SeatingPlanTab({ classId, canEdit }) {
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState([]);
  const [activePlanId, setActivePlanId] = useState(null);
  const [className, setClassName] = useState('');
  const [layout, setLayout] = useState(null);
  const [roster, setRoster] = useState([]);
  const [mode, setMode] = useState('view'); // view | layout | assign | attendance
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // presentation / print
  const [mirror, setMirror] = useState(false);
  const [presenting, setPresenting] = useState(false);

  // plan management
  const [newPlanOpen, setNewPlanOpen] = useState(false);
  const [newPlanName, setNewPlanName] = useState('');

  // undo for the last auto-arrange
  const lastArrangeRef = useRef(null);
  const [canUndoArrange, setCanUndoArrange] = useState(false);

  // attendance
  const [attDate, setAttDate] = useState(todayStr());
  const [marks, setMarks] = useState({}); // email -> status
  const [serverMarks, setServerMarks] = useState({});
  const [savingAtt, setSavingAtt] = useState(false);

  useEffect(() => { if (classId) loadPlan(); }, [classId]);

  const loadPlan = async (planId) => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('seatingPlanData', { class_id: classId, plan_id: planId || undefined });
      const d = res.data || {};
      if (d.error) throw new Error(d.error);
      setPlans(d.plans || []);
      setRoster(d.roster || []);
      setClassName(d.class?.name || '');
      setActivePlanId(d.active_plan?.id || null);
      setLayout(d.active_layout || TEMPLATES.blank.build(0));
      // the undo snapshot belongs to the plan it was taken on
      lastArrangeRef.current = null;
      setCanUndoArrange(false);
    } catch (e) { toast.error(e.message || 'Failed to load seating plan'); }
    finally { setLoading(false); }
  };

  const switchPlan = (id) => {
    setDirty(false);
    setSelectedEmail(null);
    loadPlan(id);
  };

  const activePlan = plans.find(p => p.id === activePlanId) || null;

  const assignedEmails = useMemo(() => {
    const s = new Set();
    for (const el of (layout?.elements || [])) if (el.type === 'desk') for (const a of (el.assignments || [])) if (a) s.add(a);
    return s;
  }, [layout]);

  // ── Student placement (Assign mode) ──────────────────────────────────
  // Swap-aware: dropping onto an occupied seat swaps the two students; a
  // student dragged in from the unassigned list displaces the occupant.
  const placeStudent = (email, targetElId, targetIdx) => {
    setLayout(prev => {
      const elements = (prev?.elements || []).map(el => ({
        ...el,
        assignments: el.type === 'desk' ? [...(el.assignments || Array(el.seats || 1).fill(null))] : (el.assignments || []),
      }));
      const target = elements.find(el => el.id === targetElId && el.type === 'desk');
      if (!target) return prev;
      if (targetIdx >= (target.assignments || []).length) return prev;
      // no-op: dropped back on their own seat
      if ((target.assignments[targetIdx] || null) === email) return prev;

      // where does this student currently sit?
      let srcEl = null, srcIdx = null;
      for (const el of elements) {
        if (el.type !== 'desk') continue;
        const i = (el.assignments || []).indexOf(email);
        if (i !== -1) { srcEl = el; srcIdx = i; break; }
      }
      const occupant = target.assignments[targetIdx] || null;
      target.assignments[targetIdx] = email;
      if (srcEl) srcEl.assignments[srcIdx] = occupant; // swap
      return { ...prev, elements };
    });
    setDirty(true);
  };

  const onSeatClick = (elementId, seatIndex, currentEmail) => {
    if (mode === 'assign') {
      if (selectedEmail) {
        placeStudent(selectedEmail, elementId, seatIndex);
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
    placeStudent(email, elementId, freeIdx);
  };

  const onUnassign = (elementId, seatIndex) => {
    setLayout(prev => ({ ...prev, elements: (prev?.elements || []).map(el => el.id === elementId && el.type === 'desk' ? { ...el, assignments: (el.assignments || []).map((a, i) => i === seatIndex ? null : a) } : el) }));
    setDirty(true);
  };

  const onDropUnassign = (email) => {
    setLayout(prev => ({ ...prev, elements: (prev?.elements || []).map(el => el.type === 'desk' ? { ...el, assignments: (el.assignments || []).map(a => a === email ? null : a) } : el) }));
    setDirty(true);
  };

  // ── Layout mode ──────────────────────────────────────────────────────
  const onDropElement = (id, px, py) => {
    setLayout(prev => ({ ...prev, elements: (prev?.elements || []).map(el => el.id === id ? { ...el, x: Math.max(0, Math.round(px - el.w / 2)), y: Math.max(0, Math.round(py - el.h / 2)) } : el) }));
    setDirty(true);
  };
  const deleteElement = (id) => {
    setLayout(prev => ({ ...prev, elements: (prev?.elements || []).filter(el => el.id !== id) }));
    setDirty(true);
  };
  const addElement = (el) => { setLayout(prev => ({ ...prev, elements: [...(prev?.elements || []), el] })); setDirty(true); };
  const applyTemplate = (key) => { setLayout(TEMPLATES[key].build(roster.length)); setDirty(true); toast.success('Template applied — drag desks in Layout mode, then switch to Assign'); };

  // ── Auto-arrange (with one-step undo) ────────────────────────────────
  const doClearSeats = () => { setLayout(prev => clearSeats(prev)); setDirty(true); };
  const doAutoArrange = (modeKey) => {
    setLayout(prev => {
      lastArrangeRef.current = prev;
      return autoArrange(prev, roster, modeKey);
    });
    setCanUndoArrange(true);
    setDirty(true);
    toast.success(modeKey === 'random' ? 'Students randomised' : modeKey === 'spread' ? 'Students spread out' : 'Students arranged alphabetically');
  };
  const undoArrange = () => {
    if (!lastArrangeRef.current) return;
    setLayout(lastArrangeRef.current);
    lastArrangeRef.current = null;
    setCanUndoArrange(false);
    setDirty(true);
    toast.success('Last arrange undone');
  };

  // ── Plans ────────────────────────────────────────────────────────────
  const savePlan = async () => {
    setSaving(true);
    try {
      const res = await base44.functions.invoke('saveSeatingPlan', {
        class_id: classId, plan_id: activePlanId,
        name: activePlan?.name || 'Default',
        layout_json: layout,
        is_default: activePlan ? !!activePlan.is_default : true,
      });
      if (res.data?.error) throw new Error(res.data.error);
      toast.success('Seating plan saved');
      setDirty(false);
      await loadPlan(activePlanId || undefined);
    } catch (e) { toast.error(e.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const createPlan = async () => {
    const name = newPlanName.trim();
    if (!name) return;
    setSaving(true);
    try {
      const res = await base44.functions.invoke('saveSeatingPlan', {
        class_id: classId, plan_id: null, name,
        layout_json: TEMPLATES.blank.build(roster.length),
        is_default: plans.length === 0,
      });
      if (res.data?.error) throw new Error(res.data.error);
      toast.success(`Plan “${name}” created — starts with the teacher desk at the front`);
      setNewPlanOpen(false);
      setNewPlanName('');
      await loadPlan(res.data?.plan?.id);
    } catch (e) { toast.error(e.message || 'Failed to create plan'); }
    finally { setSaving(false); }
  };

  const makeDefault = async () => {
    if (!activePlan) return;
    setSaving(true);
    try {
      const res = await base44.functions.invoke('saveSeatingPlan', {
        class_id: classId, plan_id: activePlan.id, name: activePlan.name, layout_json: layout, is_default: true,
      });
      if (res.data?.error) throw new Error(res.data.error);
      toast.success(`“${activePlan.name}” is now the default plan`);
      await loadPlan(activePlan.id);
    } catch (e) { toast.error(e.message || 'Failed to set default'); }
    finally { setSaving(false); }
  };

  const deletePlan = async () => {
    if (!activePlan) return;
    if (!window.confirm(`Delete plan “${activePlan.name}”? This can't be undone.`)) return;
    try {
      const res = await base44.functions.invoke('deleteSeatingPlan', { class_id: classId, plan_id: activePlan.id });
      if (res.data?.error) throw new Error(res.data.error);
      toast.success('Plan deleted');
      await loadPlan();
    } catch (e) { toast.error(e.message || 'Failed to delete plan'); }
  };

  // ── Attendance ───────────────────────────────────────────────────────
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

  const editing = mode === 'layout' || mode === 'assign';

  return (
    <div className="space-y-4">
      {/* Top controls */}
      <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl border border-border bg-card">
        {/* Plan management */}
        <select
          value={activePlanId || ''}
          onChange={(e) => switchPlan(e.target.value)}
          className="h-9 rounded-lg bg-background border border-border px-2 text-sm text-foreground"
          aria-label="Seating plan"
        >
          {plans.length === 0 && <option value="">Default</option>}
          {plans.map(p => <option key={p.id} value={p.id}>{p.name}{p.is_default ? ' ★' : ''}</option>)}
        </select>
        {canEdit && (
          <>
            <Button variant="outline" size="sm" onClick={() => setNewPlanOpen(true)}><Plus className="h-4 w-4" />New plan</Button>
            {activePlan && !activePlan.is_default && (
              <Button variant="outline" size="sm" onClick={makeDefault} disabled={saving}><Star className="h-4 w-4" />Make default</Button>
            )}
            {plans.length > 1 && activePlan && (
              <Button variant="ghost" size="sm" onClick={deletePlan} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
            )}
          </>
        )}

        {canEdit && (
          <>
            {/* Two-step flow: Layout places furniture, Assign seats students */}
            <div className="flex items-center rounded-lg border border-border bg-background overflow-hidden">
              <button
                onClick={() => { setMode(m => m === 'layout' ? 'view' : 'layout'); setSelectedEmail(null); }}
                className={`px-3 h-9 inline-flex items-center gap-1.5 text-sm font-medium transition-colors ${mode === 'layout' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-hover hover:text-foreground'}`}
                title="Place and move desks and furniture"
              >
                <LayoutGrid className="h-4 w-4" />Layout
              </button>
              <button
                onClick={() => { setMode(m => m === 'assign' ? 'view' : 'assign'); setSelectedEmail(null); }}
                className={`px-3 h-9 inline-flex items-center gap-1.5 text-sm font-medium transition-colors border-l border-border ${mode === 'assign' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-hover hover:text-foreground'}`}
                title="Put students in seats"
              >
                <Users className="h-4 w-4" />Assign
              </button>
            </div>
            {editing && <Button size="sm" variant="ghost" onClick={() => { setMode('view'); setSelectedEmail(null); }}>Done</Button>}

            {/* Named arrange actions + undo */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground hidden sm:inline">Arrange:</span>
              <Button variant="outline" size="sm" onClick={() => doAutoArrange('alphabetical')}><SortAsc className="h-4 w-4" />Alphabetical</Button>
              <Button variant="outline" size="sm" onClick={() => doAutoArrange('random')}><Shuffle className="h-4 w-4" />Randomise</Button>
              <Button variant="outline" size="sm" onClick={() => doAutoArrange('spread')}><Expand className="h-4 w-4" />Spread out</Button>
              <Button variant="outline" size="sm" onClick={undoArrange} disabled={!canUndoArrange} title="Undo the last arrange"><Undo2 className="h-4 w-4" />Undo</Button>
            </div>

            <Button variant={mode === 'attendance' ? 'default' : 'outline'} size="sm"
              onClick={() => (mode === 'attendance' ? setMode('view') : startAttendance())}>
              <ClipboardCheck className="h-4 w-4" />Take Attendance
            </Button>
            <Button size="sm" onClick={savePlan} disabled={saving || !dirty}><Save className="h-4 w-4" />{saving ? 'Saving…' : 'Save'}</Button>
          </>
        )}

        <div className="flex items-center gap-2 ml-auto">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer" title="Show the plan as students see it (rotated)">
            <FlipHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">Student view</span>
            <Switch checked={mirror} onCheckedChange={setMirror} aria-label="Mirror the plan (student viewpoint)" />
          </label>
          <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4" />Print</Button>
          <Button variant="outline" size="sm" onClick={() => setPresenting(true)}><Presentation className="h-4 w-4" />Present</Button>
          <span className="text-xs text-muted-foreground">{roster.length} students · Room {layout?.room?.label || '—'}</span>
        </div>
      </div>

      {/* Mode guidance — the two-step flow made explicit */}
      {canEdit && mode === 'layout' && (
        <div className="rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Layout mode:</span> you're placing furniture. Drag desks to move them, hover an element and press ✕ to remove it, or apply a template below. When the room is set up, switch to <span className="font-medium text-foreground">Assign</span> to seat students.
        </div>
      )}
      {canEdit && mode === 'assign' && (
        <div className="rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Assign mode:</span> drag a student from the list onto a seat to seat them, drag between two seats to swap, or drop a seated student back on the list to unassign them.
        </div>
      )}

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
          {mode === 'layout' && <EditLayoutPanel layout={layout} onLayout={setLayout} onAddElement={addElement} onApplyTemplate={applyTemplate} onClearSeats={doClearSeats} />}
          {layout && (
            <ClassroomCanvas
              layout={layout} students={roster} marks={marks} mode={mode}
              selectedEmail={selectedEmail}
              onSeatClick={onSeatClick}
              onUnassign={onUnassign}
              onDropStudent={onDropStudent}
              onDropStudentAtSeat={placeStudent}
              onDropElement={onDropElement}
              onDeleteElement={deleteElement}
            />
          )}
          {mode === 'attendance' && (
            <div className="flex flex-wrap items-center gap-3 px-1 text-xs">
              {ATTENDANCE_STATUSES.map(s => <span key={s.key} className="inline-flex items-center gap-1.5"><span className={`h-3 w-3 rounded border ${s.ring} ${s.bg}`} />{s.label}</span>)}
            </div>
          )}
        </div>
        <div className="space-y-4">
          {canEdit && mode === 'assign' && (
            <UnassignedStudents
              roster={roster} assignedEmails={assignedEmails}
              selectedEmail={selectedEmail} onSelect={setSelectedEmail}
              onDropUnassign={onDropUnassign}
            />
          )}
          {canEdit && (mode === 'view' || mode === 'attendance') && <AttendanceHistory classId={classId} />}
        </div>
      </div>

      {/* New plan dialog */}
      <Dialog open={newPlanOpen} onOpenChange={setNewPlanOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New seating plan</DialogTitle>
            <DialogDescription>Keep several plans per class — e.g. Normal, Exam, Group work — and switch between them any time.</DialogDescription>
          </DialogHeader>
          <Input value={newPlanName} onChange={e => setNewPlanName(e.target.value)} placeholder="Plan name (e.g. Exam)" onKeyDown={(e) => { if (e.key === 'Enter') createPlan(); }} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewPlanOpen(false)}>Cancel</Button>
            <Button onClick={createPlan} disabled={saving || !newPlanName.trim()}>{saving ? 'Creating…' : 'Create plan'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print-only rendering */}
      <PrintableSeatingPlan
        layout={layout} students={roster} mirror={mirror}
        heading={className} planName={activePlan?.name || 'Seating plan'}
      />

      {/* Full-screen presentation */}
      {presenting && (
        <ProjectorView
          layout={layout} students={roster} mirror={mirror}
          heading={className} planName={activePlan?.name}
          onExit={() => setPresenting(false)}
        />
      )}
    </div>
  );
}