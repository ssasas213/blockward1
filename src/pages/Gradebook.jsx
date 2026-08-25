import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PageHeader from '@/components/ui/page-header';
import EmptyState from '@/components/ui/empty-state';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { gradeColor, gradebookToCSV, calcPercentage, calcGrade } from '@/lib/grades';
import CreateAssessmentDialog from '@/components/grades/CreateAssessmentDialog';
import { BookOpen, Plus, Download, Upload, Trash2, MessageSquare, Loader2, GraduationCap } from 'lucide-react';
import { toast } from 'sonner';
import { useSchool } from '@/lib/SchoolContext';

import RoleGuard from '@/components/auth/RoleGuard';
export default function Gradebook() { return <RoleGuard roles={['teacher']}><GradebookImpl/></RoleGuard>; }
function GradebookImpl() {
  const { profile } = useSchool();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [termFilter, setTermFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [edits, setEdits] = useState({}); // `${email}__${aid}` => raw_score string
  const [savingCell, setSavingCell] = useState(null);
  const [commentDialog, setCommentDialog] = useState(null); // { assessment, student_email, student_name }

  const load = async (classId = selectedClassId) => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('gradeData', { class_id: classId });
      if (res.data?.ok) {
        setData(res.data.data);
        if (classId && res.data.data.selected_class) setSelectedClassId(classId);
      }
    } catch (e) { toast.error('Failed to load gradebook'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(null); }, []);

  const bands = data?.grading_scale?.bands || null;
  const classes = data?.classes || [];
  const allAssessments = data?.assessments || [];
  const students = data?.students || [];
  const grades = data?.grades || [];

  const assessments = useMemo(() =>
    allAssessments.filter(a => termFilter === 'all' || (a.term_id || '') === termFilter),
    [allAssessments, termFilter]
  );

  const gradeFor = (email, aid) => grades.find(g => g.student_email === email && g.assessment_id === aid);

  const studentAverage = (email) => {
    const pcts = assessments.map(a => gradeFor(email, a.id)).filter(g => g && g.percentage != null).map(g => g.percentage);
    if (!pcts.length) return null;
    return Math.round((pcts.reduce((s, p) => s + p, 0) / pcts.length) * 10) / 10;
  };

  const saveGrade = async (email, aid) => {
    const key = `${email}__${aid}`;
    const val = edits[key];
    if (val === undefined) return;
    const assessment = allAssessments.find(a => a.id === aid);
    setSavingCell(key);
    try {
      const res = await base44.functions.invoke('gradebookAction', { action: 'save_grade', assessment_id: aid, student_email: email, raw_score: Number(val) });
      if (res.data?.ok) {
        // update local grades
        const updated = res.data.grade;
        setData(d => ({
          ...d,
          grades: d.grades.some(g => g.id === updated.id)
            ? d.grades.map(g => g.id === updated.id ? { ...g, ...updated } : g)
            : [...d.grades, updated],
        }));
        setEdits(e => { const n = { ...e }; delete n[key]; return n; });
      } else { toast.error(res.data?.message || 'Failed to save grade'); }
    } catch (e) { toast.error(e.message); }
    finally { setSavingCell(null); }
  };

  const handlePublish = async (aid) => {
    try {
      const res = await base44.functions.invoke('gradebookAction', { action: 'publish_assessment', assessment_id: aid });
      if (res.data?.ok) {
        toast.success(`Published — ${res.data.published_grades} grade(s) now visible to students`);
        load(selectedClassId);
      } else { toast.error(res.data?.message || 'Failed to publish'); }
    } catch (e) { toast.error(e.message); }
  };

  const handleDelete = async (aid) => {
    if (!confirm('Delete this assessment and all its grades?')) return;
    try {
      const res = await base44.functions.invoke('gradebookAction', { action: 'delete_assessment', assessment_id: aid });
      if (res.data?.ok) { toast.success('Assessment deleted'); load(selectedClassId); }
      else { toast.error(res.data?.message || 'Failed to delete'); }
    } catch (e) { toast.error(e.message); }
  };

  const exportCSV = () => {
    const csv = gradebookToCSV(students, assessments, grades);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `gradebook-${data?.selected_class?.name || 'class'}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  if (loading && !data) return <DashboardSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader title="Gradebook" description="Create assessments, enter grades, and publish when ready">
        <Button variant="outline" onClick={exportCSV} disabled={!selectedClassId || !assessments.length}>
          <Download className="h-4 w-4 mr-2" /> Export CSV
        </Button>
        <Button onClick={() => setShowCreate(true)} disabled={!selectedClassId}>
          <Plus className="h-4 w-4 mr-2" /> Create Assessment
        </Button>
      </PageHeader>

      {/* Class + Term selectors */}
      <Card className="surface-card">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Class</Label>
              <select value={selectedClassId || ''} onChange={e => { setSelectedClassId(e.target.value); load(e.target.value); }} className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 text-sm text-foreground focus:ring-2 focus:ring-primary">
                <option value="">Select a class…</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name} · {c.subject} ({c.student_count})</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Term</Label>
              <select value={termFilter} onChange={e => setTermFilter(e.target.value)} disabled={!selectedClassId} className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 text-sm text-foreground focus:ring-2 focus:ring-primary">
                <option value="all">All Terms</option>
                {(data?.terms || []).map(t => <option key={t.id} value={t.id}>{t.name}{t.academic_year ? ` (${t.academic_year})` : ''}</option>)}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {!selectedClassId ? (
        <EmptyState icon={BookOpen} title="Select a class to view its gradebook" description="Choose one of your classes above to start entering grades." />
      ) : assessments.length === 0 ? (
        <EmptyState icon={GraduationCap} title="No assessments yet" description="Create your first assessment to start entering grades.">
          <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-2" /> Create Assessment</Button>
        </EmptyState>
      ) : (
        <Card className="surface-card">
          <CardHeader>
            <CardTitle className="text-base">{data?.selected_class?.name} — {data?.selected_class?.subject}</CardTitle>
            {data?.grading_scale && <p className="text-xs text-muted-foreground">Grading scale: {data.grading_scale.name}</p>}
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="sticky left-0 z-10 bg-card text-left p-3 font-medium text-xs text-muted-foreground min-w-[160px]">Student</th>
                    {assessments.map(a => (
                      <th key={a.id} className="p-3 text-center min-w-[120px] border-l border-border">
                        <div className="space-y-1">
                          <p className="font-medium text-foreground text-sm">{a.title}</p>
                          <Badge variant="secondary" className="capitalize text-[10px]">{a.assessment_type}</Badge>
                          <p className="text-xs text-muted-foreground">Max: {a.max_score}</p>
                          <div className="flex items-center justify-center gap-1 pt-1">
                            {a.status === 'draft' ? (
                              <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => handlePublish(a.id)}>
                                <Upload className="h-3 w-3 mr-1" /> Publish
                              </Button>
                            ) : (
                              <Badge className="bg-success/15 text-success text-[10px]">Published</Badge>
                            )}
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handleDelete(a.id)}>
                              <Trash2 className="h-3 w-3 text-muted-foreground" />
                            </Button>
                          </div>
                        </div>
                      </th>
                    ))}
                    <th className="p-3 text-center min-w-[80px] border-l border-border font-medium text-xs text-muted-foreground">Average</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map(stu => {
                    const avg = studentAverage(stu.email);
                    return (
                      <tr key={stu.email} className="border-b border-border/50 hover:bg-hover/20">
                        <td className="sticky left-0 z-10 bg-card p-3 font-medium text-foreground">{stu.name}</td>
                        {assessments.map(a => {
                          const g = gradeFor(stu.email, a.id);
                          const key = `${stu.email}__${a.id}`;
                          const val = edits[key] !== undefined ? edits[key] : (g?.raw_score ?? '');
                          const pct = g?.percentage ?? calcPercentage(Number(val), a.max_score);
                          const gv = g?.grade_value ?? calcGrade(pct, bands);
                          return (
                            <td key={a.id} className="p-2 text-center border-l border-border">
                              <div className="flex flex-col items-center gap-1">
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    value={val}
                                    onChange={e => setEdits(ed => ({ ...ed, [key]: e.target.value }))}
                                    onBlur={() => edits[key] !== undefined && saveGrade(stu.email, a.id)}
                                    onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
                                    placeholder="—"
                                    disabled={savingCell === key}
                                    className="w-16 h-8 text-center rounded-md border border-input bg-background/50 px-1 text-sm text-foreground focus:ring-2 focus:ring-primary disabled:opacity-50"
                                  />
                                  {savingCell === key && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                                </div>
                                {pct != null && <Badge className={`${gradeColor(pct)} text-[10px]`}>{pct}% · {gv}</Badge>}
                                <button
                                  onClick={() => setCommentDialog({ assessment: a, student_email: stu.email, student_name: stu.name, grade: g })}
                                  className="text-muted-foreground hover:text-primary"
                                  title="Add comment"
                                >
                                  <MessageSquare className="h-3 w-3" />
                                </button>
                              </div>
                            </td>
                          );
                        })}
                        <td className="p-3 text-center border-l border-border">
                          {avg != null ? <Badge className={`${gradeColor(avg)}`}>{avg}%</Badge> : <span className="text-muted-foreground">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Grades save automatically when you leave a cell. Draft grades are hidden from students until you publish the assessment.
            </p>
          </CardContent>
        </Card>
      )}

      {showCreate && data?.selected_class && (
        <CreateAssessmentDialog
          open={showCreate}
          onClose={() => setShowCreate(false)}
          classInfo={data.selected_class}
          terms={data.terms || []}
          teacherEmail={data.teacher_email}
          teacherName={data.teacher_name}
          onCreated={() => load(selectedClassId)}
        />
      )}

      <CommentDialog
        state={commentDialog}
        bands={bands}
        onClose={() => setCommentDialog(null)}
        onSaved={() => load(selectedClassId)}
      />
    </div>
  );
}

function CommentDialog({ state, bands, onClose, onSaved }) {
  const [comment, setComment] = useState('');
  const [score, setScore] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (state) {
      setComment(state.grade?.teacher_comment || '');
      setScore(state.grade?.raw_score ?? '');
    }
  }, [state]);

  if (!state) return null;
  const { assessment, student_email, student_name, grade } = state;
  const pct = calcPercentage(Number(score), assessment.max_score);

  const save = async () => {
    setSaving(true);
    try {
      const res = await base44.functions.invoke('gradebookAction', {
        action: 'save_grade', assessment_id: assessment.id, student_email, raw_score: Number(score), teacher_comment: comment.trim() || null,
      });
      if (res.data?.ok) { toast.success('Saved'); onSaved(); onClose(); }
      else toast.error(res.data?.message || 'Failed to save');
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={!!state} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{assessment.title} — {student_name}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Score</Label>
              <Input type="number" value={score} onChange={e => setScore(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Result</Label>
              <div className="h-9 flex items-center">
                {pct != null && <Badge className={`${gradeColor(pct)}`}>{pct}% · {calcGrade(pct, bands)}</Badge>}
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Teacher Comment</Label>
            <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3} placeholder="Feedback for the student…" className="w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}