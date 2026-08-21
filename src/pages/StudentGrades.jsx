import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import PageHeader from '@/components/ui/page-header';
import EmptyState from '@/components/ui/empty-state';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import { gradeColor, ASSESSMENT_TYPES } from '@/lib/grades';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { GraduationCap, TrendingUp, BookOpen, Filter } from 'lucide-react';
import { useSchool } from '@/lib/SchoolContext';

export default function StudentGrades() {
  const { profile } = useSchool();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ subject: 'all', term: 'all', type: 'all' });

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const res = await base44.functions.invoke('gradeData', {});
      if (res.data?.ok) setData(res.data.data);
    } catch (e) { console.error('gradeData error', e); }
    finally { setLoading(false); }
  };

  const subjects = useMemo(() => {
    if (!data) return [];
    return Array.from(new Set(data.grades.map(g => g.subject || g.class_name))).sort();
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.grades.filter(g =>
      (filters.subject === 'all' || (g.subject || g.class_name) === filters.subject) &&
      (filters.term === 'all' || (g.term_name || 'Unassigned') === filters.term) &&
      (filters.type === 'all' || g.assessment_type === filters.type)
    );
  }, [data, filters]);

  const filteredAverage = useMemo(() => {
    const pcts = filtered.map(g => g.percentage).filter(p => p != null);
    if (!pcts.length) return null;
    return Math.round((pcts.reduce((s, p) => s + p, 0) / pcts.length) * 10) / 10;
  }, [filtered]);

  const trendData = useMemo(() => {
    return [...filtered]
      .filter(g => g.assessment_date)
      .sort((a, b) => new Date(a.assessment_date) - new Date(b.assessment_date))
      .map(g => ({ date: g.assessment_date, percentage: g.percentage, label: `${g.assessment_title} (${g.subject})` }));
  }, [filtered]);

  const grouped = useMemo(() => {
    const map = {};
    for (const g of filtered) {
      const key = g.subject || g.class_name || 'General';
      if (!map[key]) map[key] = [];
      map[key].push(g);
    }
    return map;
  }, [filtered]);

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader title="My Grades" description="Your academic performance across all classes" />

      {/* Overall + Subject averages */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="surface-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center">
                <GraduationCap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Overall Average</p>
                <p className="text-2xl font-bold text-foreground">{data?.overall_average != null ? `${data.overall_average}%` : '—'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        {(data?.subject_averages || []).slice(0, 3).map(s => (
          <Card key={s.subject} className="surface-card">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-secondary flex items-center justify-center">
                  <BookOpen className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{s.subject}</p>
                  <p className="text-2xl font-bold text-foreground">{s.average != null ? `${s.average}%` : '—'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="surface-card">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Filter Grades</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select value={filters.subject} onChange={e => setFilters(f => ({ ...f, subject: e.target.value }))} className="h-9 rounded-md border border-input bg-background/50 px-3 text-sm text-foreground focus:ring-2 focus:ring-primary">
              <option value="all">All Subjects</option>
              {subjects.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filters.term} onChange={e => setFilters(f => ({ ...f, term: e.target.value }))} className="h-9 rounded-md border border-input bg-background/50 px-3 text-sm text-foreground focus:ring-2 focus:ring-primary">
              <option value="all">All Terms</option>
              {(data?.terms || []).map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
            </select>
            <select value={filters.type} onChange={e => setFilters(f => ({ ...f, type: e.target.value }))} className="h-9 rounded-md border border-input bg-background/50 px-3 text-sm text-foreground focus:ring-2 focus:ring-primary">
              <option value="all">All Assessment Types</option>
              {ASSESSMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          {filteredAverage != null && (
            <p className="text-sm text-muted-foreground mt-3">Filtered average: <span className="font-semibold text-foreground">{filteredAverage}%</span> across {filtered.length} grades</p>
          )}
        </CardContent>
      </Card>

      {/* Trend chart */}
      {trendData.length >= 2 && (
        <Card className="surface-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="h-4 w-4 text-primary" /> Grade Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                <Line type="monotone" dataKey="percentage" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Grades by subject */}
      {Object.keys(grouped).length === 0 ? (
        <EmptyState icon={GraduationCap} title="No grades published yet" description="Your teachers will publish grades here once assessments are marked." />
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([subject, grades]) => {
            const avg = grades.map(g => g.percentage).filter(p => p != null);
            const subjectAvg = avg.length ? Math.round((avg.reduce((s, p) => s + p, 0) / avg.length) * 10) / 10 : null;
            return (
              <Card key={subject} className="surface-card">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">{subject}</CardTitle>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">Average</span>
                    <Badge className={gradeColor(subjectAvg)}>{subjectAvg != null ? `${subjectAvg}%` : '—'}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-xs text-muted-foreground">
                          <th className="py-2 pr-4 font-medium">Assessment</th>
                          <th className="py-2 px-3 font-medium">Type</th>
                          <th className="py-2 px-3 font-medium">Date</th>
                          <th className="py-2 px-3 font-medium text-right">Score</th>
                          <th className="py-2 px-3 font-medium text-right">%</th>
                          <th className="py-2 px-3 font-medium">Grade</th>
                          <th className="py-2 px-3 font-medium">Teacher</th>
                        </tr>
                      </thead>
                      <tbody>
                        {grades.map(g => (
                          <tr key={g.id} className="border-b border-border/50 hover:bg-hover/30">
                            <td className="py-3 pr-4 font-medium text-foreground">{g.assessment_title}</td>
                            <td className="py-3 px-3"><Badge variant="secondary" className="capitalize">{g.assessment_type}</Badge></td>
                            <td className="py-3 px-3 text-muted-foreground">{g.assessment_date ? new Date(g.assessment_date).toLocaleDateString() : '—'}</td>
                            <td className="py-3 px-3 text-right tabular-nums text-foreground">{g.raw_score}/{g.max_score}</td>
                            <td className="py-3 px-3 text-right tabular-nums font-medium text-foreground">{g.percentage != null ? `${g.percentage}%` : '—'}</td>
                            <td className="py-3 px-3"><Badge className={gradeColor(g.percentage)}>{g.grade_value || '—'}</Badge></td>
                            <td className="py-3 px-3 text-muted-foreground">{g.teacher_name || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {grades.some(g => g.teacher_comment) && (
                    <div className="mt-4 space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Teacher Comments</p>
                      {grades.filter(g => g.teacher_comment).map(g => (
                        <div key={g.id} className="p-3 rounded-lg bg-muted/40 border border-border">
                          <p className="text-sm font-medium text-foreground">{g.assessment_title}</p>
                          <p className="text-sm text-muted-foreground mt-1">{g.teacher_comment}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}