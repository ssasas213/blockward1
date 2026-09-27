import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import EmptyState from '@/components/ui/empty-state';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import CreateAssessmentDialog from '@/components/grades/CreateAssessmentDialog';
import GradebookGrid from '@/components/grades/GradebookGrid';
import { Loader2, BookOpenCheck, Plus, Download } from 'lucide-react';
import { toast } from 'sonner';
import { gradebookToCSV } from '@/lib/grades';

/**
 * Gradebook — the teacher's class gradebook (rendered by the /Grades
 * dispatcher for teachers, and as the Gradebook tab in MyTeaching).
 * Loads the teacher gradebook view from gradeData, supports creating
 * assessments (draft), entering/editing scores, publishing assessments
 * (which publishes their draft grades and notifies students), unpublishing,
 * deleting, and a CSV export of the current grid.
 */
export default function Gradebook() {
  const [data, setData] = useState(null);
  const [classId, setClassId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingCell, setSavingCell] = useState(null);
  const [assessmentBusy, setAssessmentBusy] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async (selectedId) => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('gradeData', selectedId ? { class_id: selectedId } : {});
      if (!res.data?.ok) throw new Error(res.data?.message || 'Failed to load the gradebook');
      const d = res.data.data;
      setData(d);
      // Keep the current selection when it still exists; otherwise first class.
      if (selectedId && d.selected_class) setClassId(d.selected_class.id);
      else if (!selectedId && d.classes?.length && !d.selected_class) setClassId(null);
    } catch (e) {
      toast.error(e.message || 'Failed to load the gradebook');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(classId); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const selectClass = async (id) => {
    setClassId(id);
    setLoading(true);
    try {
      const res = await base44.functions.invoke('gradeData', { class_id: id });
      if (!res.data?.ok) throw new Error(res.data?.message || 'Failed to load the gradebook');
      setData(res.data.data);
    } catch (e) {
      toast.error(e.message || 'Failed to load the gradebook');
    } finally {
      setLoading(false);
    }
  };

  const action = async (payload, successMessage) => {
    const res = await base44.functions.invoke('gradebookAction', payload);
    if (!res.data?.ok) throw new Error(res.data?.message || 'This change could not be saved');
    if (successMessage) toast.success(successMessage);
  };

  const handleSaveGrade = async (assessmentId, studentEmail, score) => {
    const key = `${assessmentId}:${studentEmail}`;
    setSavingCell(key);
    try {
      await action({ action: 'save_grade', assessment_id: assessmentId, student_email: studentEmail, raw_score: score }, 'Grade saved');
      await selectClass(classId);
    } catch (e) { toast.error(e.message); }
    finally { setSavingCell(null); }
  };

  const handlePublishToggle = async (a) => {
    setAssessmentBusy(a.id);
    try {
      await action(
        { action: a.status === 'published' ? 'unpublish_assessment' : 'publish_assessment', assessment_id: a.id },
        a.status === 'published' ? 'Assessment moved back to draft' : 'Assessment published to students',
      );
      await selectClass(classId);
    } catch (e) { toast.error(e.message); }
    finally { setAssessmentBusy(null); }
  };

  const handleDelete = async (a) => {
    if (!confirm(`Delete "${a.title}" and all its grades? This cannot be undone.`)) return;
    setAssessmentBusy(a.id);
    try {
      await action({ action: 'delete_assessment', assessment_id: a.id }, 'Assessment deleted');
      await selectClass(classId);
    } catch (e) { toast.error(e.message); }
    finally { setAssessmentBusy(null); }
  };

  const exportCsv = () => {
    try {
      const csv = gradebookToCSV(data.students, data.assessments, data.grades);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `gradebook-${(data.selected_class?.name || 'class').toLowerCase().replace(/\s+/g, '-')}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Could not build the CSV export'); }
  };

  const classes = data?.classes || [];
  const hasClass = !!data?.selected_class;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gradebook</h1>
          <p className="text-muted-foreground mt-1">Assessments, scores and published grades for your classes</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={classId || ''} onValueChange={selectClass}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Choose a class" /></SelectTrigger>
            <SelectContent>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}{c.subject ? ` · ${c.subject}` : ''} ({c.student_count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasClass && (
            <>
              <Button size="sm" variant="outline" onClick={exportCsv}>
                <Download className="h-4 w-4 mr-1" /> Export
              </Button>
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> New assessment
              </Button>
            </>
          )}
        </div>
      </div>

      {loading && !data ? (
        <DashboardSkeleton />
      ) : !classes.length ? (
        <EmptyState
          icon={BookOpenCheck}
          title="No classes to grade yet"
          description="Once you have a class with students, its gradebook appears here."
        />
      ) : loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : !hasClass ? (
        <EmptyState
          icon={BookOpenCheck}
          title="Choose a class"
          description="Select one of your classes to open its gradebook."
        />
      ) : (
        <Card className="surface-card">
          <CardContent className="pt-6">
            {!data.assessments.length ? (
              <EmptyState
                icon={BookOpenCheck}
                title="No assessments yet"
                description="Create the first assessment for this class — it starts as a draft and only students see it once published."
              >
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" /> New assessment
                </Button>
              </EmptyState>
            ) : !data.students.length ? (
              <EmptyState
                icon={BookOpenCheck}
                title="No students enrolled"
                description="Add students to this class to start recording grades."
              />
            ) : (
              <GradebookGrid
                assessments={data.assessments}
                students={data.students}
                grades={data.grades}
                savingCell={savingCell}
                assessmentBusy={assessmentBusy}
                onSaveGrade={handleSaveGrade}
                onPublishToggle={handlePublishToggle}
                onDeleteAssessment={handleDelete}
              />
            )}
          </CardContent>
        </Card>
      )}

      <CreateAssessmentDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        classInfo={data?.selected_class || null}
        terms={data?.terms || []}
        teacherEmail={data?.teacher_email || null}
        teacherName={data?.teacher_name || null}
        onCreated={() => selectClass(classId)}
      />
    </div>
  );
}