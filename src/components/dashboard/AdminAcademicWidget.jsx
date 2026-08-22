import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, BarChart3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { gradeColor } from '@/lib/grades';

export default function AdminAcademicWidget() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.functions.invoke('gradeData', {})
      .then(res => { if (res.data?.ok) setData(res.data.data); })
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <Card className="surface-card"><CardContent className="pt-6 flex items-center justify-center h-28"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></CardContent></Card>;
  const totals = data?.totals || {};
  if (!totals.assessments) return null;

  return (
    <Card className="surface-card card-hover">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center"><BarChart3 className="h-4 w-4 text-primary" /></div>
            <div><p className="text-sm font-semibold text-foreground">Grade Activity</p><p className="text-xs text-muted-foreground">School-wide academic overview</p></div>
          </div>
          <Badge className={gradeColor(data?.school_average)}>{data?.school_average != null ? `${data.school_average}%` : '—'}</Badge>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded-lg bg-muted/40"><p className="text-lg font-bold text-foreground">{totals.assessments || 0}</p><p className="text-xs text-muted-foreground">Assessments</p></div>
          <div className="p-2 rounded-lg bg-muted/40"><p className="text-lg font-bold text-success">{totals.published_grades || 0}</p><p className="text-xs text-muted-foreground">Published</p></div>
          <div className="p-2 rounded-lg bg-muted/40"><p className="text-lg font-bold text-warning">{totals.missing_grades || 0}</p><p className="text-xs text-muted-foreground">Missing</p></div>
        </div>
        <Button variant="outline" size="sm" asChild className="w-full mt-3"><Link to={createPageUrl('GradeManagement')}>Grade Management</Link></Button>
      </CardContent>
    </Card>
  );
}