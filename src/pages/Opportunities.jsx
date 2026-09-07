import React, { useState, useEffect, useMemo } from 'react';
import PageHeader from '@/components/ui/page-header';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CardSkeleton } from '@/components/ui/loading-skeleton';
import EmptyState from '@/components/ui/empty-state';
import { Briefcase, Search, SlidersHorizontal, Inbox } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import OpportunityCard from '@/components/opportunities/OpportunityCard';
import ApplyDialog from '@/components/opportunities/ApplyDialog';
import MyApplications from '@/components/opportunities/MyApplications';
import { OPPORTUNITY_TYPES, daysUntil } from '@/lib/opportunities';
import { CATEGORY_LABELS } from '@/lib/achievementRequests';
import { cn } from '@/lib/utils';

const DEADLINE_FILTERS = [
  { value: 'all', label: 'Any deadline' },
  { value: 'closing_7', label: 'Closing within 7 days' },
  { value: 'closing_30', label: 'Closing within 30 days' },
];

export default function Opportunities() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [applyTo, setApplyTo] = useState(null);

  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [category, setCategory] = useState('all');
  const [deadline, setDeadline] = useState('all');
  const [remoteOnly, setRemoteOnly] = useState(false);

  const load = async () => {
    try {
      const res = await base44.functions.invoke('opportunityData', {});
      if (!res.data?.ok) throw new Error(res.data?.error || 'Could not load opportunities.');
      setData(res.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!data?.opportunities) return [];
    const q = search.trim().toLowerCase();
    return data.opportunities.filter((o) => {
      if (type !== 'all' && o.type !== type) return false;
      if (category !== 'all' && o.category !== category) return false;
      if (remoteOnly && !o.is_remote) return false;
      if (deadline !== 'all') {
        const days = daysUntil(o.application_deadline);
        if (days === null) return false;
        const limit = deadline === 'closing_7' ? 7 : 30;
        if (days < 0 || days > limit) return false;
      }
      if (q) {
        const hay = `${o.title} ${o.description || ''} ${o.organisation_name} ${o.location || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [data, search, type, category, deadline, remoteOnly]);

  if (loading) {
    return (
      <div className="space-y-4">
        <CardSkeleton /><CardSkeleton /><CardSkeleton />
      </div>
    );
  }

  if (error) {
    return <EmptyState icon={Briefcase} title="Could not load opportunities" description={error} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Opportunities"
        description={`Programmes, roles and competitions posted by verified organisations — your ${data.my_verified_count} verified credential${data.my_verified_count === 1 ? '' : 's'} attach automatically.`}
      />

      <Tabs defaultValue="browse">
        <TabsList>
          <TabsTrigger value="browse">Browse</TabsTrigger>
          <TabsTrigger value="mine">
            My applications {data.applications?.length > 0 && `(${data.applications.length})`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="space-y-4 mt-4">
          {/* Filters */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-tertiary pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search title, organisation, location…"
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setType('all')}
                className={cn(
                  'rounded-full px-3 py-1.5 text-xs font-medium border transition-colors',
                  type === 'all' ? 'bg-primary/10 border-primary/30 text-primary' : 'border-border text-muted-foreground hover:text-foreground'
                )}
              >
                All types
              </button>
              {OPPORTUNITY_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setType(type === t.value ? 'all' : t.value)}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-xs font-medium border transition-colors',
                    type === t.value ? 'bg-primary/10 border-primary/30 text-primary' : 'border-border text-muted-foreground hover:text-foreground'
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-tertiary" />
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-[150px] h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={deadline} onValueChange={setDeadline}>
                <SelectTrigger className="w-[190px] h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DEADLINE_FILTERS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <button
                onClick={() => setRemoteOnly((v) => !v)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-xs font-medium border transition-colors',
                  remoteOnly ? 'bg-primary/10 border-primary/30 text-primary' : 'border-border text-muted-foreground hover:text-foreground'
                )}
              >
                Remote only
              </button>
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No opportunities match"
              description="Try clearing the filters — new listings appear as organisations post them."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((o) => (
                <OpportunityCard key={o.id} opportunity={o} onApply={setApplyTo} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="mine" className="mt-4">
          <MyApplications applications={data.applications} onRefresh={load} />
        </TabsContent>
      </Tabs>

      <ApplyDialog
        opportunity={applyTo}
        open={!!applyTo}
        onOpenChange={(o) => !o && setApplyTo(null)}
        onApplied={load}
        myVerifiedCount={data.my_verified_count}
      />
    </div>
  );
}