import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import EmptyState from '@/components/ui/empty-state';
import { Loader2, GraduationCap, BarChart3 } from 'lucide-react';
import { format } from 'date-fns';

const avg = (nums) => {
  const valid = nums.filter((n) => n != null && !Number.isNaN(n));
  if (!valid.length) return null;
  return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
};

export default function GradesTab({ classId, classData, isTeacher }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.functions.invoke('gradeData', isTeacher ? { class_id: classId } : {})
      .then((res) => { if (res.data?.ok) setData(res.data.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [classId, isTeacher]);

  if (loading) {
    return (
      <Card className="surface-card">
        <CardContent className="py-16 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (isTeacher) {
    const assessments = data?.assessments || [];
    const grades = data?.grades || [];
    const published = grades.filter((g) => g.status === 'published');
    const classAvg = avg(published.map((g) => g.percentage));

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Card className="surface-card flex-1 min-w-[200px]">
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Class average</p>
                <p className="text-2xl font-bold text-foreground">
                  {classAvg != null ? `${classAvg}%` : '—'}
                </p>
              </div>
            </CardContent>
          </Card>
          <Button variant="outline" asChild>
            <Link to={createPageUrl('Gradebook')}>
              <GraduationCap className="h-4 w-4 mr-2" />
              Open full gradebook
            </Link>
          </Button>
        </div>

        {assessments.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="No assessments yet"
            description="Create graded assessments in the full gradebook — they'll appear here."
          />
        ) : (
          <Card className="surface-card">
            <CardHeader><CardTitle className="text-base">Assessments ({assessments.length})</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-4 font-medium">Assessment</th>
                      <th className="py-2 px-3 font-medium">Type</th>
                      <th className="py-2 px-3 font-medium">Date</th>
                      <th className="py-2 px-3 font-medium">Average</th>
                      <th className="py-2 pl-3 font-medium text-right">Graded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assessments.map((a) => {
                      const aGrades = published.filter((g) => g.assessment_id === a.id);
                      const aAvg = avg(aGrades.map((g) => g.percentage));
                      return (
                        <tr key={a.id} className="border-b border-border/50">
                          <td className="py-3 pr-4 font-medium text-foreground">{a.title}</td>
                          <td className="py-3 px-3">
                            <Badge variant="secondary" className="capitalize text-[10px]">
                              {(a.assessment_type || '').replace('_', ' ')}
                            </Badge>
                          </td>
                          <td className="py-3 px-3 text-muted-foreground">
                            {a.date ? format(new Date(a.date), 'd MMM yyyy') : '—'}
                          </td>
                          <td className="py-3 px-3 text-foreground tabular-nums">
                            {aAvg != null ? `${aAvg}%` : '—'}
                          </td>
                          <td className="py-3 pl-3 text-right text-muted-foreground tabular-nums">
                            {aGrades.length}/{data?.students?.length ?? '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Student view — own published grades, filtered to this class.
  const grades = (data?.grades || []).filter((g) => g.class_name === classData?.name);

  if (grades.length === 0) {
    return (
      <EmptyState
        icon={GraduationCap}
        title="No grades yet"
        description="Your published grades for this class will appear here."
      />
    );
  }

  return (
    <Card className="surface-card">
      <CardHeader><CardTitle className="text-base">My grades ({grades.length})</CardTitle></CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Assessment</th>
                <th className="py-2 px-3 font-medium">Date</th>
                <th className="py-2 px-3 font-medium">Score</th>
                <th className="py-2 pl-3 font-medium">Grade</th>
              </tr>
            </thead>
            <tbody>
              {grades.map((g) => (
                <tr key={g.id} className="border-b border-border/50">
                  <td className="py-3 pr-4 font-medium text-foreground">{g.assessment_title}</td>
                  <td className="py-3 px-3 text-muted-foreground">
                    {g.assessment_date ? format(new Date(g.assessment_date), 'd MMM yyyy') : '—'}
                  </td>
                  <td className="py-3 px-3 text-foreground tabular-nums">
                    {g.raw_score != null ? `${g.raw_score}/${g.max_score} (${g.percentage}%)` : '—'}
                  </td>
                  <td className="py-3 pl-3">
                    {g.grade_value ? <Badge variant="secondary">{g.grade_value}</Badge> : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}