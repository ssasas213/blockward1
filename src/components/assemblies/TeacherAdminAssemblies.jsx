import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/ui/page-header';
import EmptyState from '@/components/ui/empty-state';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import AssemblyCard from '@/components/assemblies/AssemblyCard';
import CreateAssemblyDialog from '@/components/assemblies/CreateAssemblyDialog';
import { Plus, MoreVertical, XCircle, Calendar } from 'lucide-react';
import { toast } from 'sonner';

export default function TeacherAdminAssemblies({ isAdmin }) {
  const [assemblies, setAssemblies] = useState([]);
  const [classes, setClasses] = useState([]);
  const [yearGroups, setYearGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    try {
      const [res, clsRes, ygRes] = await Promise.all([
        base44.functions.invoke('assemblyAction', { action: 'list' }),
        base44.entities.Class.filter({}).catch(() => []),
        isAdmin ? base44.entities.YearGroup.filter({}).catch(() => []) : Promise.resolve([]),
      ]);
      if (res.data?.ok) setAssemblies(res.data.assemblies || []);
      setClasses(clsRes || []);
      setYearGroups(ygRes || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const cancel = async (id) => {
    if (!confirm('Cancel this assembly? Affected students will be notified.')) return;
    try {
      const res = await base44.functions.invoke('assemblyAction', { action: 'cancel', event_id: id });
      if (res.data?.ok) { toast.success('Assembly cancelled'); load(); }
      else toast.error(res.data?.message || 'Failed');
    } catch (e) { toast.error(e.message); }
  };

  if (loading) return <DashboardSkeleton />;
  const upcoming = assemblies.filter(a => new Date(a.start_time) >= new Date() && a.status !== 'cancelled');
  const past = assemblies.filter(a => new Date(a.start_time) < new Date() || a.status === 'cancelled');

  return (
    <div className="space-y-6">
      <PageHeader title="Assemblies" description={isAdmin ? "Create and manage school assemblies" : "Create assemblies for your classes"}>
        <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-2" />Create Assembly</Button>
      </PageHeader>
      {upcoming.length === 0 ? (
        <EmptyState icon={Calendar} title="No upcoming assemblies" description="Create an assembly to notify affected students.">
          <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-2" />Create Assembly</Button>
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {upcoming.map(a => (
            <AssemblyCard key={a.id} assembly={a} action={
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem className="text-destructive" onClick={() => cancel(a.id)}><XCircle className="h-4 w-4 mr-2" />Cancel Assembly</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            } />
          ))}
        </div>
      )}
      {past.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">Past / Cancelled</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 opacity-60">
            {past.slice(0, 6).map(a => <AssemblyCard key={a.id} assembly={a} />)}
          </div>
        </div>
      )}
      {showCreate && <CreateAssemblyDialog open={showCreate} onClose={() => setShowCreate(false)} classes={classes} yearGroups={yearGroups} isAdmin={isAdmin} onCreated={load} />}
    </div>
  );
}