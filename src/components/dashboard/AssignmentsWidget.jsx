import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ClipboardList, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';

export default function AssignmentsWidget() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.functions.invoke('assignmentData', {})
      .then(res => { if (res.data?.ok) setData(res.data.data); })
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <Card className="surface-card"><CardContent className="pt-6 flex items-center justify-center h-28"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></CardContent></Card>;
  if (!data || (data.assignments || []).length === 0) return null;
  const dueSoon = (data.due_soon || []).length;
  const overdue = (data.overdue || []).length;
  const next = (data.due_soon || [])[0] || (data.upcoming || [])[0];

  return (
    <Card className="surface-card card-hover">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center"><ClipboardList className="h-4 w-4 text-primary" /></div>
            <div><p className="text-sm font-semibold text-foreground">Assignments</p><p className="text-xs text-muted-foreground">Due soon & overdue</p></div>
          </div>
          <div className="flex gap-2">
            {overdue > 0 && <Badge className="bg-destructive/15 text-destructive">{overdue} overdue</Badge>}
            {dueSoon > 0 && <Badge className="bg-warning/15 text-warning">{dueSoon} due soon</Badge>}
          </div>
        </div>
        {next ? (
          <div className="p-3 rounded-lg bg-muted/40 border border-border">
            <p className="text-sm font-medium text-foreground truncate">{next.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{next.subject} · {next.due_date ? format(new Date(next.due_date), 'EEE d MMM') : 'No due date'}</p>
          </div>
        ) : overdue === 0 && <p className="text-xs text-muted-foreground">All caught up.</p>}
        <Button variant="outline" size="sm" asChild className="w-full mt-3"><Link to={createPageUrl('Assignments')}>View Assignments</Link></Button>
      </CardContent>
    </Card>
  );
}