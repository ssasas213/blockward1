import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/ui/page-header';
import EmptyState from '@/components/ui/empty-state';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ClipboardList, AlertTriangle, FileText } from 'lucide-react';
import { format } from 'date-fns';

export default function AdminAssignments() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.functions.invoke('assignmentData', {})
      .then(res => { if (res.data?.ok) setData(res.data.data); })
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <DashboardSkeleton />;
  if (!data) return <EmptyState icon={ClipboardList} title="No assignment data" />;

  const t = data.totals || {};
  const assignments = data.assignments || [];

  return (
    <div className="space-y-6">
      <PageHeader title="Assignments" description="School-wide assignment activity and oversight" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="surface-card"><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Total</p><p className="text-2xl font-bold text-foreground">{t.total || 0}</p></CardContent></Card>
        <Card className="surface-card"><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Published</p><p className="text-2xl font-bold text-success">{t.published || 0}</p></CardContent></Card>
        <Card className="surface-card"><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Drafts</p><p className="text-2xl font-bold text-foreground">{t.draft || 0}</p></CardContent></Card>
        <Card className="surface-card"><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Overdue</p><p className="text-2xl font-bold text-destructive">{t.overdue || 0}</p></CardContent></Card>
      </div>
      {assignments.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No assignments created yet" />
      ) : (
        <Card className="surface-card">
          <CardHeader><CardTitle className="text-base">All Assignments ({assignments.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Title</th><th className="py-2 px-3 font-medium">Class</th>
                  <th className="py-2 px-3 font-medium">Teacher</th><th className="py-2 px-3 font-medium">Due</th>
                  <th className="py-2 px-3 font-medium">Status</th>
                </tr></thead>
                <tbody>
                  {assignments.map(a => (
                    <tr key={a.id} className="border-b border-border/50 hover:bg-hover/20">
                      <td className="py-3 pr-4 font-medium text-foreground">{a.title}</td>
                      <td className="py-3 px-3 text-muted-foreground">{a.class_name}</td>
                      <td className="py-3 px-3 text-muted-foreground">{a.teacher_name}</td>
                      <td className="py-3 px-3 text-muted-foreground">{a.due_date ? format(new Date(a.due_date), 'd MMM') : '—'}{a.due_status === 'overdue' && <AlertTriangle className="inline h-3 w-3 text-destructive ml-1" />}</td>
                      <td className="py-3 px-3">{a.status === 'published' ? <Badge className="bg-success/15 text-success text-[10px]">Published</Badge> : <Badge variant="secondary" className="text-[10px]">Draft</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}