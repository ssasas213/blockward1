import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ClipboardList, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';

export default function TeacherAssignmentsWidget() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.functions.invoke('assignmentData', {})
      .then(res => { if (res.data?.ok) setData(res.data.data); })
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <Card className="surface-card"><CardContent className="pt-6 flex items-center justify-center h-28"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></CardContent></Card>;
  const upcoming = (data?.upcoming || []);
  if (!data || (data.assignments || []).length === 0) return null;

  return (
    <Card className="surface-card card-hover">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center"><ClipboardList className="h-4 w-4 text-primary" /></div>
            <div><p className="text-sm font-semibold text-foreground">Assignments</p><p className="text-xs text-muted-foreground">{data.overdue_count || 0} overdue · {upcoming.length} due soon</p></div>
          </div>
        </div>
        {upcoming.length > 0 ? (
          <div className="space-y-2">
            {upcoming.slice(0, 3).map(a => (
              <div key={a.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40">
                <div className="min-w-0"><p className="text-sm text-foreground truncate">{a.title}</p><p className="text-xs text-muted-foreground">{a.class_name}</p></div>
                <Badge variant="secondary" className="text-[10px]">{a.due_date ? format(new Date(a.due_date), 'd MMM') : '—'}</Badge>
              </div>
            ))}
          </div>
        ) : <p className="text-xs text-muted-foreground">No upcoming deadlines.</p>}
        <Button variant="outline" size="sm" asChild className="w-full mt-3"><Link to={createPageUrl('Assignments')}>View Assignments</Link></Button>
      </CardContent>
    </Card>
  );
}