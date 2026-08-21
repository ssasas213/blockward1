import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { gradeColor } from '@/lib/grades';

export default function GradesWidget() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.functions.invoke('gradeData', {})
      .then(res => { if (res.data?.ok) setData(res.data.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card className="surface-card">
        <CardContent className="pt-6 flex items-center justify-center h-28">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!data || (data.grades || []).length === 0) return null;

  return (
    <Card className="surface-card card-hover">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Academic Performance</p>
              <p className="text-xs text-muted-foreground">Current average across subjects</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-foreground">{data.overall_average != null ? `${data.overall_average}%` : '—'}</p>
            <p className="text-xs text-muted-foreground">Overall</p>
          </div>
        </div>
        <div className="space-y-2">
          {(data.subject_averages || []).slice(0, 3).map(s => (
            <div key={s.subject} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground truncate">{s.subject}</span>
              <Badge className={gradeColor(s.average)}>{s.average != null ? `${s.average}%` : '—'}</Badge>
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" asChild className="w-full mt-4">
          <Link to={createPageUrl('StudentGrades')}>View Grades</Link>
        </Button>
      </CardContent>
    </Card>
  );
}