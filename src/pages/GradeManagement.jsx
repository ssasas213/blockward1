import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import PageHeader from '@/components/ui/page-header';
import EmptyState from '@/components/ui/empty-state';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { gradeColor } from '@/lib/grades';
import { BarChart3, AlertTriangle, GraduationCap, BookOpen, Settings, Users, ClipboardList } from 'lucide-react';

export default function GradeManagement() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.functions.invoke('gradeData', {})
      .then(res => { if (res.data?.ok) setData(res.data.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <DashboardSkeleton />;
  if (!data) return <EmptyState icon={BarChart3} title="No grade data available" />;

  const distData = Object.entries(data.grade_distribution || {}).map(([grade, count]) => ({ grade, count }));
  const totals = data.totals || {};

  return (
    <div className="space-y-6">
      <PageHeader title="Grade Management" description="School-wide academic performance overview">
        <Button variant="outline" asChild>
          <Link to={createPageUrl('AcademicSettings')}>
            <Settings className="h-4 w-4 mr-2" /> Academic Settings
          </Link>
        </Button>
      </PageHeader>

      {/* Totals */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatTile icon={ClipboardList} label="Assessments" value={totals.assessments || 0} sub={`${totals.published_assessments || 0} published`} />
        <StatTile icon={GraduationCap} label="Published Grades" value={totals.published_grades || 0} />
        <StatTile icon={AlertTriangle} label="Missing Grades" value={totals.missing_grades || 0} sub={totals.missing_grades > 0 ? 'needs attention' : 'all caught up'} warn={totals.missing_grades > 0} />
        <StatTile icon={BookOpen} label="Classes" value={totals.classes || 0} />
        <StatTile icon={BarChart3} label="School Average" value={data.school_average != null ? `${data.school_average}%` : '—'} />
      </div>

      {/* Grade distribution */}
      {distData.length > 0 && (
        <Card className="surface-card">
          <CardHeader><CardTitle className="text-base">Grade Distribution</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={distData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="grade" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {distData.map((entry, i) => <Cell key={i} fill="hsl(var(--primary))" />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Class averages */}
      <Card className="surface-card">
        <CardHeader><CardTitle className="text-base">Class Performance</CardTitle></CardHeader>
        <CardContent>
          {(data.class_averages || []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No published grades yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Class</th><th className="py-2 px-3 font-medium">Subject</th>
                  <th className="py-2 px-3 font-medium text-right">Assessments</th><th className="py-2 px-3 font-medium text-right">Grades</th>
                  <th className="py-2 px-3 font-medium text-right">Average</th>
                </tr></thead>
                <tbody>
                  {data.class_averages.map(c => (
                    <tr key={c.id} className="border-b border-border/50 hover:bg-hover/30">
                      <td className="py-3 pr-4 font-medium text-foreground">{c.name}</td>
                      <td className="py-3 px-3 text-muted-foreground">{c.subject}</td>
                      <td className="py-3 px-3 text-right tabular-nums">{c.assessment_count}</td>
                      <td className="py-3 px-3 text-right tabular-nums">{c.grade_count}</td>
                      <td className="py-3 px-3 text-right">{c.average != null ? <Badge className={gradeColor(c.average)}>{c.average}%</Badge> : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Subject averages */}
        <Card className="surface-card">
          <CardHeader><CardTitle className="text-base">Subject Averages</CardTitle></CardHeader>
          <CardContent>
            {(data.subject_averages || []).length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">No data.</p> : (
              <div className="space-y-2">
                {data.subject_averages.map(s => (
                  <div key={s.subject} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <span className="text-sm font-medium text-foreground">{s.subject}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{s.count} grades</span>
                      <Badge className={gradeColor(s.average)}>{s.average != null ? `${s.average}%` : '—'}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Teacher completion */}
        <Card className="surface-card">
          <CardHeader><CardTitle className="text-base">Teacher Gradebook Activity</CardTitle></CardHeader>
          <CardContent>
            {(data.teacher_completion || []).length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">No teachers.</p> : (
              <div className="space-y-2">
                {data.teacher_completion.map(t => (
                  <div key={t.email} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium text-foreground">{t.name || t.email}</p>
                        <p className="text-xs text-muted-foreground">{t.class_count} classes · {t.assessment_count} assessments</p>
                      </div>
                    </div>
                    <Badge variant={t.published > 0 ? 'default' : 'secondary'}>{t.published} published</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Term averages */}
      {(data.term_averages || []).length > 0 && (
        <Card className="surface-card">
          <CardHeader><CardTitle className="text-base">Term Performance</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {data.term_averages.map(t => (
                <div key={t.term} className="p-4 rounded-lg bg-muted/30 border border-border">
                  <p className="text-sm text-muted-foreground">{t.term}</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{t.average != null ? `${t.average}%` : '—'}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t.count} grades</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatTile({ icon: Icon, label, value, sub, warn }) {
  return (
    <Card className="surface-card">
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${warn ? 'bg-warning/15' : 'bg-primary/10'}`}>
            <Icon className={`h-5 w-5 ${warn ? 'text-warning' : 'text-primary'}`} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-bold text-foreground">{value}</p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}