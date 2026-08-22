import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/ui/page-header';
import EmptyState from '@/components/ui/empty-state';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import AssemblyCard from '@/components/assemblies/AssemblyCard';
import { Calendar } from 'lucide-react';

export default function StudentAssemblies() {
  const [assemblies, setAssemblies] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await base44.functions.invoke('assemblyAction', { action: 'list' });
      if (res.data?.ok) setAssemblies(res.data.assemblies || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  if (loading) return <DashboardSkeleton />;
  const upcoming = assemblies.filter(a => new Date(a.start_time) >= new Date());

  return (
    <div className="space-y-6">
      <PageHeader title="Assemblies" description="Assemblies relevant to you and your classes" />
      {upcoming.length === 0 ? (
        <EmptyState icon={Calendar} title="No upcoming assemblies" description="Assemblies for your classes and the whole school will appear here." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {upcoming.map(a => <AssemblyCard key={a.id} assembly={a} />)}
        </div>
      )}
    </div>
  );
}