import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/ui/page-header';
import EmptyState from '@/components/ui/empty-state';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import CreateAssignmentDialog from '@/components/assignments/CreateAssignmentDialog';
import { Plus, ClipboardList, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

export default function TeacherAssignments() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    try {
      const res = await base44.functions.invoke('assignmentData', {});
      if (res.data?.ok) setData(res.data.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  if (loading) return <DashboardSkeleton />;

  const assignments = data?.assignments || [];
  const classes = data?.classes || [];

  return (
    <div className="space-y-6">
      <PageHeader title="Assignments" description="Create and manage homework for your classes">
        <Button onClick={() => setShowCreate(true)} disabled={!classes.length}><Plus className="h-4 w-4 mr-2" />Create Assignment</Button>
      </PageHeader>
      {!classes.length ? (
        <EmptyState icon={ClipboardList} title="No classes assigned" description="You need a class before you can create assignments." />
      ) : assignments.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No assignments yet" description="Create your first assignment for one of your classes.">
          <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-2" />Create Assignment</Button>
        </EmptyState>
      ) : (
        <Card className="surface-card">
          <CardHeader><CardTitle className="text-base">All Assignments ({assignments.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Title</th><th className="py-2 px-3 font-medium">Class</th>
                  <th className="py-2 px-3 font-medium">Type</th><th className="py-2 px-3 font-medium">Due</th>
                  <th className="py-2 px-3 font-medium">Status</th><th className="py-2 px-3 font-medium text-right">Students</th>
                </tr></thead>
                <tbody>
                  {assignments.map(a => (
                    <tr key={a.id} className="border-b border-border/50 hover:bg-hover/20">
                      <td className="py-3 pr-4 font-medium text-foreground">{a.title}</td>
                      <td className="py-3 px-3 text-muted-foreground">{a.class_name}</td>
                      <td className="py-3 px-3"><Badge variant="secondary" className="capitalize text-[10px]">{a.assessment_type?.replace('_', ' ')}</Badge></td>
                      <td className="py-3 px-3 text-muted-foreground">{a.due_date ? format(new Date(a.due_date), 'd MMM') : '—'}</td>
                      <td className="py-3 px-3">
                        {a.status === 'published' ? <Badge className="bg-success/15 text-success text-[10px]">Published</Badge> : <Badge variant="secondary" className="text-[10px]">Draft</Badge>}
                        {a.due_status === 'overdue' && <AlertCircle className="inline h-3 w-3 text-destructive ml-1" />}
                      </td>
                      <td className="py-3 px-3 text-right text-muted-foreground tabular-nums">{a.student_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
      {showCreate && <CreateAssignmentDialog open={showCreate} onClose={() => setShowCreate(false)} classes={classes} onCreated={load} />}
    </div>
  );
}