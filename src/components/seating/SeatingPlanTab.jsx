import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, Save, ClipboardCheck, Users, LayoutTemplate, Printer, Presentation } from 'lucide-react';
import ClassroomCanvas from './ClassroomCanvas';
import UnassignedStudents from './UnassignedStudents';
import EditLayoutPanel from './EditLayoutPanel';
import AttendanceHistory from './AttendanceHistory';
import PlanBar from './PlanBar';
import ArrangeBar from './ArrangeBar';
import SeatingPrintView from './SeatingPrintView';
import { TEMPLATES, autoArrange, clearSeats, flattenSeats, ATTENDANCE_STATUSES } from './templates';

const todayStr = () => new Date().toISOString().slice(0, 10);
const STATUS_CYCLE = ['present', 'late', 'absent', 'excused'];

/**
 * SeatingPlanTab — the two-step flow is explicit:
 *   LAYOUT mode: place and move furniture (templates, desks, teacher desk, room size).
 *   ASSIGN mode: put students in seats (drag from Unassigned onto a seat,
 *   drag between two occupied seats to swap, drag off the plan to unassign).
 * Attendance mode stays as before, plus Print / Project for any plan.
 */
export default function SeatingPlanTab({ classId, canEdit }) {
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState([]);
  const [classInfo, setClassInfo] = useState(null);
  const [activePlanId, setActivePlanId] = useState(null);
  const [layout, setLayout] = useState(null);
  const [roster, setRoster] = useState([]);
  const [mode, setMode] = useState('view'); // view | layout | assign | attendance
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [undoLayout, setUndoLayout] = useState(null); // snapshot before the last arrange
  const [printOpen, setPrintOpen] = useState(false);

  // attendance
  const [attDate, setAttDate] = useState(todayStr());
  const [marks, setMarks] = useState({});
  const [serverMarks, setServerMarks] = useState({});
  const [savingAtt, setSavingAtt] = useState(false);

  useEffect(() => { if (classId) loadPlan(); }, [classId]);

  const loadPlan = async (selectPlanId = null) => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('seatingPlanData', { class_id: classId, plan_id: selectPlanId });
      const d = res.data || {};
      if (d.error) throw new Error(d.error);
      setPlans(d.plans || []);
      setRoster(d.roster || []);
      setClassInfo(d.class || null);
      setActivePlanId(d.active_plan?.id || null);
      setLayout(d.active_layout || TEMPLATES.blank.build(0));
      setDirty(false);
      setUndoLayout(null);
    } catch (e) {
      toast.error(e.message || 'Failed to load seating plan');
    } finally {
      setLoading(false);
    }
  };

  const activePlan = plans.find(p => p.id === activePlanId) || null;

  const assignedEmails = useMemo(() => {
    const s = new Set();
    for (const seat of flattenSeats(layout)) if (seat.student_email) s.add(seat.student_email);
    return s;
  }, [layout]);

  // ─────────────────── Layout mode actions ───────────────────
  const addElement = (el) => { setLayout(prev => ({ ...prev, elements: [...(prev?.elements || []), el] })); setDirty(true); };
  const applyTemplate = (key) => {
    setLayout(TEMPLATES[key].build(roster.length));
    setDirty(true);
    toast.success('Template applied — switch to Assign to seat students');
  };
  const deleteElement = (id) => {
    setLayout(prev => ({ ...prev, elements: (prev?.elements || []).filter(el => el.id !== id) }));
    setDirty(true);
  };
  const onDropElement = (id, px, py) => {
    setLayout(prev => ({
      ...prev,
      elements: (prev?.elements || []).map(el => el.id === id
        ? { ...el, x: Math.max(0, Math.round(px - el.w / 2)), y: Math.max(0, Math.round(py - el.h / 2)) }
        : el),
    }));
    setDirty(true);
  };

  // ─────────────────── Assign mode actions ───────────────────
  // Place/swap a student. When the target seat is occupied and the student came
  // from another seat, the two students swap; when they came from the
  // Unassigned panel the occupant is displaced back to the panel.
  const assignSeat = (elementId, seatIndex, email, fromElementId = null, fromSeatIndex = null) => {
    if (!email) return;
    const elements = layout?.elements || [];
    const target = elements.find(e => e.id === elementId);
    if (!target) return;
    const occupant = target.assignments?.[seatIndex] || null;
    if (occupant === email) return;

    let srcEl = fromElementId, srcIdx = fromSeatIndex;
    if (!srcEl) {
      for (const e of elements) {
        if (e.type !== 'desk') continue;
        (e.assignments || []).forEach((a, i) => { if (a === email) { srcEl = e.id; srcIdx = i; } });
      }
    }

    setLayout(prev => {
      const next = prev.elements.map(e => e.type === 'desk' ? { ...e, assignments: [...(e.assignments || Array(e.seats || 1).fill(null))] } : e);
      const get = (id) => next.find(e => e.id === id);
      const t = get(elementId);
      t.assignments[seatIndex] = email;
      if (occupant && srcEl && get(srcEl)) {
        get(srcEl).assignments[srcIdx] = occupant; // swap
      } else if (srcEl && get(srcEl)) {
        get(srcEl).assignments[srcIdx] = null;
      }
      // occupant displaced (no source seat) simply returns to the Unassigned panel
      return { ...prev, elements: next };
    });
    setDirty(true);
  };

  const onUnassign = (elementId, seatIndex) => {
    setLayout(prev => ({
      ...prev,
      elements: prev.elements.map(el => el.id === elementId && el.type === 'desk'
        ? { ...el, assignments: (el.assignments || []).map((a, i) => (i === seatIndex ? null : a)) }
        : el),
    }));
    setDirty(true);
  };

  const onUnassignByEmail = (email) => {
    if (!email || !assignedEmails.has(email)) return; // ignore drops of already-unassigned students
    setLayout(prev => ({
      ...prev,
      elements: prev.elements.map(el => el.type === 'desk'
        ? { ...el, assignments: (el.assignments || []).map(a => (a === email ? null : a)) }
        : el),
    }));
    setDirty(true);
  };

  const onSeatClick = (elementId, seatIndex, currentEmail) => {
    if (mode === 'assign') {
      if (selectedEmail) {
        assignSeat(elementId, seatIndex, selectedEmail);
        setSelectedEmail(null);
      } else if (currentEmail) {
        setSelectedEmail(currentEmail); // pick up to move
      }
    } else if (mode === 'attendance') {
      if (!currentEmail) return;
      const cur = marks[currentEmail] || 'unmarked';
      const next = cur === 'unmarked' ? 'present' : STATUS_CYCLE[(STATUS_CYCLE.indexOf(cur) + 1) % STATUS_CYCLE.length];
      setMarks(prev => ({ ...prev, [currentEmail]: next }));
    }
  };

  const arrange = (modeKey) => {
    setUndoLayout(layout); // one-level undo for the last arrange
    setLayout(prev => autoArrange(prev, roster, modeKey));
    setDirty(true);
    toast.success(modeKey === 'random' ? 'Students randomised — Undo is available if that wasn\u2019t intended' : 'Students arranged');
  };
  const undoArrange = () => {
    if (!undoLayout) return;
    setLayout(undoLayout);
    setUndoLayout(null);
    setDirty(true);
    toast.success('Arrange undone');
  };
  const doClearSeats = () => {
    setLayout(prev => clearSeats(prev));
    setDirty(true);
  };

  // ─────────────────── Plan management ───────────────────
  const savePlan = async (overrides = {}) => {
    setSaving(true);
    try {
      const payload = {
        class_id: classId,
        plan_id: overrides.plan_id !== undefined ? overrides.plan_id : activePlanId,
        name: overrides.name !== undefined ? overrides.name : (activePlan?.name || 'Default'),
        layout_json: overrides.layout_json || layout,
        is_default: overrides.is_default !== undefined ? overrides.is_default : (activePlan?.is_default ?? plans.length === 0),
      };
      const res = await base44.functions.invoke('saveSeatingPlan', payload);
      if (res.data?.error) throw new Error(res.data.error);
      setDirty(false);
      return res.data?.plan || null;
    } catch (e) {
      toast.error(e.message || 'Failed to save');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const createPlan = async (name, templateKey) => {
    const built = TEMPLATES[templateKey]?.build(roster.length) || TEMPLATES.blank.build(0);
    const plan = await savePlan({ plan_id: null, name, layout_json: built, is_default: plans.length === 0 });
    if (plan) { toast.success(`Plan “${name}” created`); await loadPlan(plan.id); }
  };
  const duplicatePlan = async () => {
    const plan = await savePlan({ plan_id: null, name: `${activePlan?.name || 'Plan'} (copy)`, is_default: false });
    if (plan) { toast.success('Plan duplicated'); await loadPlan(plan.id); }
  };
  const renamePlan = async (name) => {
    const plan = await savePlan({ name });
    if (plan) { toast.success('Plan renamed'); await loadPlan(plan.id); }
  };
  const makeDefault = async () => {
    const plan = await savePlan({ is_default: true });
    if (plan) { toast.success('This plan now loads by default'); await loadPlan(activePlanId); }
  };
  const deletePlan = async () => {
    try {
      const res = await base44.functions.invoke('deleteSeatingPlan', { class_id: classId, plan_id: activePlanId });
      if (res.data?.error) throw new Error(res.data.error);
      toast.success('Plan deleted');
      await loadPlan();
    } catch (e) {
      toast.error(e.message || 'Failed to delete plan');
    }
  };

  // ─────────────────── Attendance ───────────────────
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
    } catch (e) {
      toast.error(e.message || 'Failed to load attendance');
    }
  };

  const startAttendance = async () => {
    setMode('attendance');
    setSelectedEmail(null);
    await loadAttendance(attDate);
  };

  const markAll = (status) => { const next = {}; for (const s of roster) next[s.student_email] = status; setMarks(next); };
  const clearAtt = () => markAll('present');

  const saveAttendance = async () => {
    setSavingAtt(true);
    try {
      const payload = roster.map(s => ({ student_email: s.student_email, student_name: s.student_name, status: marks[s.student_email] || 'present' }));
      const res = await base44.functions.invoke('saveAttendance', { class_id: classId, date: attDate, marks: payload });
      if (res.data?.error) throw new Error(res.data.error);
      toast.success('Attendance saved');
      await loadAttendance(attDate);
    } catch (e) {
      toast.error(e.message || 'Failed to save attendance');
    } finally {
      setSavingAtt(false);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const modeBtn = (key, icon, label) => (
    <Button
      variant={mode === key ? 'default' : 'outline'}
      size="sm"
      onClick={() => { setMode(mode === key ? 'view' : key); setSelectedEmail(null); }}
    >
      {icon} {label}
    </Button>
  );

  return (
    <div className="space-y-4">
      {/* Top controls */}
      <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl border border-border bg-card">
        <PlanBar
          plans={plans}
          activePlanId={activePlanId}
          canManage={canEdit}
          onSelectPlan={async (id) => {
            setActivePlanId(id);
            setSelectedEmail(null);
            setDirty(false);
            setUndoLayout(null);
            try {
              const res = await base44.functions.invoke('seatingPlanData', { class_id: classId, plan_id: id });
              const d = res.data || {};
              if (d.error) throw new Error(d.error);
              setLayout(d.active_layout || TEMPLATES.blank.build(0));
            } catch (e) {
              toast.error(e.message || 'Could not load plan');
            }
          }}
          onCreatePlan={createPlan}
          onDuplicatePlan={duplicatePlan}
          onRenamePlan={renamePlan}
          onMakeDefault={makeDefault}
          onDeletePlan={deletePlan}
        />
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            {modeBtn('layout', <LayoutTemplate className="h-4 w-4" />, 'Layout')}
            {modeBtn('assign', <Users className="h-4 w-4" />, 'Assign')}
            {modeBtn('attendance', <ClipboardCheck className="h-4 w-4" />, 'Attendance')}
            <Button size="sm" onClick={() => savePlan()} disabled={saving || !dirty}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        )}
        <Button variant="outline" size="sm" onClick={() => setPrintOpen('print')}>
          <Printer className="h-4 w-4" />Print
        </Button>
        <Button variant="outline" size="sm" onClick={() => setPrintOpen('present')}>
          <Presentation className="h-4 w-4" />Project
        </Button>
        <span className="text-xs text-muted-foreground ml-auto">{roster.length} students · Room {layout?.room?.label || '—'}</span>
      </div>

      {mode !== 'view' && (
        <p className="text-xs text-muted-foreground px-1">
          {mode === 'layout' && 'Layout mode — place and move furniture. The teacher\u2019s desk starts at the front of the room (bottom); drag it to move it, hover an element to delete it.'}
          {mode === 'assign' && 'Assign mode — drag a student from the panel onto an empty seat, drag between two occupied seats to swap, or drag a seated student off the plan to unassign them.'}
          {mode === 'attendance' && 'Attendance mode — tap a seat to cycle Present → Late → Absent → Excused.'}
        </p>
      )}

      {mode === 'attendance' && (
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl border border-info/30 bg-info/10">
          <input type="date" value={attDate} max={todayStr()} onChange={e => { setAttDate(e.target.value); loadAttendance(e.target.value); }} className="h-9 rounded-lg bg-background border border-border px-2 text-sm text-foreground" />
          <Button variant="outline" size="sm" onClick={() => markAll('present')}>Mark All Present</Button>
          <Button variant="outline" size="sm" onClick={clearAtt}>Reset</Button>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{Object.values(marks).filter(m => m === 'present' || m === 'late').length} / {roster.length} present</span>
            <Button size="sm" onClick={saveAttendance} disabled={savingAtt}>{savingAtt ? 'Saving…' : 'Save Attendance'}</Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
        <div className="space-y-3">
          {mode === 'assign' && (
            <ArrangeBar onArrange={arrange} onUndo={undoArrange} canUndo={!!undoLayout} onClearSeats={doClearSeats} disabled={saving} />
          )}
          {mode === 'layout' && (
            <EditLayoutPanel layout={layout} onLayout={(l) => { setLayout(l); setDirty(true); }} onAddElement={addElement} onApplyTemplate={applyTemplate} />
          )}
          {layout && (
            <ClassroomCanvas
              layout={layout}
              students={roster}
              marks={marks}
              mode={mode}
              selectedEmail={selectedEmail}
              onSeatClick={onSeatClick}
              onSeatDrop={assignSeat}
              onUnassign={onUnassign}
              onUnassignByEmail={onUnassignByEmail}
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
          {canEdit && mode === 'assign' && <UnassignedStudents roster={roster} assignedEmails={assignedEmails} selectedEmail={selectedEmail} onSelect={setSelectedEmail} />}
          {canEdit && mode !== 'assign' && <AttendanceHistory classId={classId} />}
        </div>
      </div>

      <SeatingPrintView
        open={!!printOpen}
        onClose={() => setPrintOpen(false)}
        layout={layout}
        students={roster}
        classInfo={classInfo}
        planName={activePlan?.name || 'Plan'}
      />
    </div>
  );
}