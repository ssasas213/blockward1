import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/ui/page-header';
import EmptyState from '@/components/ui/empty-state';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import AssignmentCard from '@/components/assignments/AssignmentCard';
import { ClipboardList, AlertCircle, CalendarClock, CheckCircle2 } from 'lucide-react';

export default function StudentAssignments() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await base44.functions.invoke('assignmentData', {});
      if (res.data?.ok) setData(res.data.data);
    } catch (e) { console.error('assignmentData error', e); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  if (loading) return <DashboardSkeleton />;

  const sections = [
    { label: 'Overdue', icon: AlertCircle, items: data?.overdue || [], color: 'text-destructive' },
    { label: 'Due Soon', icon: CalendarClock, items: data?.due_soon || [], color: 'text-warning' },
    { label: 'Upcoming', icon: ClipboardList, items: data?.upcoming || [], color: 'text-primary' },
    { label: 'Completed', icon: CheckCircle2, items: data?.completed || [], color: 'text-success' },
  ];

  if (!data || data.assignments?.length === 0) {
    return <EmptyState icon={ClipboardList} title="No assignments yet" description="Your teachers will post assignments here. Check back soon." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Assignments" description="Your homework and assignments across all classes" />
      {sections.map(s => s.items.length > 0 && (
        <div key={s.label}>
          <h2 className={`flex items-center gap-2 text-sm font-semibold mb-3 ${s.color}`}><s.icon className="h-4 w-4" />{s.label} ({s.items.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {s.items.map(a => <AssignmentCard key={a.id} assignment={a} />)}
          </div>
        </div>
      ))}
    </div>
  );
}