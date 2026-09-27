import React, { useState } from 'react';
import { Loader2, Check, X, Eye, EyeOff, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { gradeColor, averagePercentages } from '@/lib/grades';
import { ASSESSMENT_TYPES, assignmentStatusLabel } from '@/lib/grades';

const typeLabel = (v) => (ASSESSMENT_TYPES.find((t) => t.value === v) || {}).label || v;

/**
 * GradebookGrid — the teacher's class gradebook table: students as rows,
 * assessments as columns. Cells show the recorded score, percentage and
 * grade; clicking a cell opens an inline score entry (saved through
 * gradebookAction 'save_grade'). Assessment headers carry publish /
 * unpublish / delete controls. Kept as a dumb component — all actions are
 * performed by the parent via gradebookAction.
 */
export default function GradebookGrid({
  assessments = [],
  students = [],
  grades = [],
  savingCell,
  assessmentBusy,
  onSaveGrade,
  onPublishToggle,
  onDeleteAssessment,
}) {
  const [editing, setEditing] = useState(null); // `${assessment_id}:${student_email}`
  const [draftScore, setDraftScore] = useState('');

  const gradeFor = (assessmentId, email) =>
    grades.find((g) => g.assessment_id === assessmentId && g.student_email === email);

  const startEdit = (assessmentId, email, assessment, existing) => {
    setEditing(`${assessmentId}:${email}`);
    setDraftScore(existing ? String(existing.raw_score) : '');
  };

  const commit = (assessment) => {
    if (!editing) return;
    const raw = draftScore.trim();
    const [assessmentId, email] = editing.split(':');
    setEditing(null);
    if (raw === '') return;
    const score = Number(raw);
    if (Number.isNaN(score) || score < 0) return;
    onSaveGrade(assessmentId, email, score, assessment.max_score);
  };

  const studentAverage = (email) => {
    const pcts = grades.filter((g) => g.student_email === email && g.percentage != null).map((g) => g.percentage);
    return averagePercentages(pcts);
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm min-w-[640px]">
        <thead>
          <tr className="border-b border-border bg-secondary/50">
            <th className="text-left px-4 py-3 font-semibold text-foreground sticky left-0 bg-secondary/50 min-w-[180px]">Student</th>
            {assessments.map((a) => (
              <th key={a.id} className="text-left px-4 py-3 font-semibold text-foreground min-w-[150px]">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate" title={a.title}>{a.title}</p>
                    <p className="text-[11px] font-normal text-muted-foreground truncate">
                      {typeLabel(a.assessment_type)} · max {a.max_score}{a.date ? ` · ${a.date}` : ''}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Badge variant={a.status === 'published' ? 'success' : 'secondary'} className="text-[10px]">
                        {assignmentStatusLabel(a.status)}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button
                      size="icon" variant="ghost" className="h-7 w-7"
                      disabled={assessmentBusy === a.id}
                      title={a.status === 'published' ? 'Unpublish (back to draft)' : 'Publish to students'}
                      onClick={() => onPublishToggle(a)}
                    >
                      {assessmentBusy === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : a.status === 'published' ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </Button>
                    <Button
                      size="icon" variant="ghost" className="h-7 w-7"
                      disabled={assessmentBusy === a.id}
                      title="Delete assessment and its grades"
                      onClick={() => onDeleteAssessment(a)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              </th>
            ))}
            <th className="text-left px-4 py-3 font-semibold text-foreground min-w-[90px]">Average</th>
          </tr>
        </thead>
        <tbody>
          {students.map((stu, idx) => {
            const avg = studentAverage(stu.email);
            return (
              <tr key={stu.email} className={idx % 2 ? 'bg-background' : 'bg-secondary/20'}>
                <td className="px-4 py-2.5 sticky left-0 bg-inherit">
                  <p className="font-medium text-foreground truncate">{stu.name}</p>
                </td>
                {assessments.map((a) => {
                  const key = `${a.id}:${stu.email}`;
                  const g = gradeFor(a.id, stu.email);
                  if (editing === key) {
                    return (
                      <td key={a.id} className="px-4 py-2.5">
                        <div className="flex items-center gap-1">
                          <input
                            autoFocus
                            value={draftScore}
                            onChange={(e) => setDraftScore(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commit(a);
                              if (e.key === 'Escape') setEditing(null);
                            }}
                            onBlur={() => commit(a)}
                            type="number" min="0" step="0.5"
                            placeholder={`0–${a.max_score}`}
                            className="h-8 w-20 rounded-lg bg-secondary/60 border border-border text-foreground text-xs px-2 focus:outline-none focus:border-primary/40"
                          />
                          <span className="text-xs text-muted-foreground">/{a.max_score}</span>
                        </div>
                      </td>
                    );
                  }
                  const cellBusy = savingCell === key;
                  return (
                    <td key={a.id} className="px-4 py-2.5">
                      {g ? (
                        <button
                          type="button"
                          disabled={cellBusy}
                          onClick={() => startEdit(a.id, stu.email, a, g)}
                          className="text-left group"
                          title="Click to edit the score"
                        >
                          {cellBusy ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                          ) : (
                            <span className="inline-flex items-center gap-1.5">
                              <span className="font-medium text-foreground">{g.raw_score}<span className="text-muted-foreground font-normal">/{g.max_score}</span></span>
                              {g.percentage != null && (
                                <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${gradeColor(g.percentage)}`}>
                                  {g.percentage}%{g.grade_value ? ` · ${g.grade_value}` : ''}
                                </span>
                              )}
                            </span>
                          )}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={cellBusy}
                          onClick={() => startEdit(a.id, stu.email, a, null)}
                          className="text-muted-foreground hover:text-foreground text-xs transition-colors"
                          title="Enter a score"
                        >
                          {cellBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : '— enter'}
                        </button>
                      )}
                    </td>
                  );
                })}
                <td className="px-4 py-2.5">
                  {avg != null ? (
                    <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${gradeColor(avg)}`}>{avg}%</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}