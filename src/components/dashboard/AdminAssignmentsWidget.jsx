import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ClipboardList, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function AdminAssignmentsWidget() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.functions.invoke('assignmentData', {})
      .then(res => { if (res.data?.ok) setData(res.data.data); })
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <Card className="surface-card"><CardContent className="pt-6 flex items-center justify-center h-28"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></CardContent></Card>;
  const t = data?.totals || {};
  if (!t.total) return null;

  return (
    <Card className="surface-card card-hover">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center"><ClipboardList className="h-4 w-4 text-primary" /></div>
            <div><p className="text-sm font-semibold text-foreground">Assignments</p><p className="text-xs text-muted-foreground">School-wide activity</p></div>
          </div>
          {t.overdue > 0 && <Badge className="bg-destructive/15 text-destructive"><AlertTriangle className="h-3 w-3 mr-1" />{t.overdue} overdue</Badge>}
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded-lg bg-muted/40"><p className="text-lg font-bold text-foreground">{t.total || 0}</p><p className="text-xs text-muted-foreground">Total</p></div>
          <div className="p-2 rounded-lg bg-muted/40"><p className="text-lg font-bold text-success">{t.published || 0}</p><p className="text-xs text-muted-foreground">Published</p></div>
          <div className="p-2 rounded-lg bg-muted/40"><p className="text-lg font-bold text-muted-foreground">{t.draft || 0}</p><p className="text-xs text-muted-foreground">Drafts</p></div>
        </div>
        <Button variant="outline" size="sm" asChild className="w-full mt-3"><Link to={createPageUrl('Assignments')}>View Assignments</Link></Button>
      </CardContent>
    </Card>
  );
}