import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardSkeleton } from '@/components/ui/loading-skeleton';
import EmptyState from '@/components/ui/empty-state';
import { Briefcase, Plus, Pencil, Users } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import OpportunityForm from '@/components/opportunities/OpportunityForm';
import ApplicantsPanel from '@/components/opportunities/ApplicantsPanel';
import { OPP_STATUS_LABELS, OPP_STATUS_VARIANTS, OPPORTUNITY_TYPE_LABELS, formatDeadline } from '@/lib/opportunities';
import { cn } from '@/lib/utils';

/**
 * ManageOpportunities — the organisation console: post/edit listings,
 * track applicants through the pipeline with their verified credentials
 * attached, message them, and issue completion credentials.
 */
export default function ManageOpportunities() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const load = async () => {
    try {
      const res = await base44.functions.invoke('opportunityData', { mode: 'org' });
      if (!res.data?.ok) throw new Error(res.data?.error || 'Could not load your opportunities.');
      setData(res.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (o) => { setEditing(o); setFormOpen(true); };

  const setStatus = async (o, status) => {
    await base44.functions.invoke('opportunityAction', {
      action: 'update', opportunity_id: o.id, changes: { status },
    });
    load();
  };

  if (loading) {
    return <div className="space-y-4"><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>;
  }

  if (error) {
    return <EmptyState icon={Briefcase} title="Could not load" description={error} />;
  }

  const opportunities = data.opportunities || [];
  const selected = opportunities.find((o) => o.id === selectedId) || opportunities[0] || null;

  return (
    <div className="space-y-6">
      <PageHeader title="Opportunities" description="Post programmes and roles — applicants' verified credentials attach automatically.">
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> Post an opportunity
        </Button>
      </PageHeader>

      {opportunities.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No opportunities posted yet"
          description="Post internships, competitions, trials, scholarships or workshops — students browse them with their verified credentials attached."
        >
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Post an opportunity</Button>
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Listings */}
          <div className="space-y-3 lg:col-span-1">
            {opportunities.map((o) => (
              <Card
                key={o.id}
                className={cn(
                  'surface-card card-hover cursor-pointer',
                  selected?.id === o.id && 'border-primary/40'
                )}
                onClick={() => setSelectedId(o.id)}
              >
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{o.title}</p>
                      <p className="text-xs text-tertiary">
                        {OPPORTUNITY_TYPE_LABELS[o.type] || o.type} · Deadline {formatDeadline(o.application_deadline)}
                      </p>
                    </div>
                    <Badge variant={OPP_STATUS_VARIANTS[o.status] || 'secondary'}>
                      {OPP_STATUS_LABELS[o.status] || o.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    {o.applicant_count} applicant{o.applicant_count === 1 ? '' : 's'}
                    <span className="ml-auto flex items-center gap-1.5">
                      <Button
                        variant="ghost" size="icon" className="h-6 w-6"
                        onClick={(e) => { e.stopPropagation(); openEdit(o); }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {o.status === 'open' ? (
                        <Button
                          variant="ghost" size="sm" className="h-6 text-xs"
                          onClick={(e) => { e.stopPropagation(); setStatus(o, 'closed'); }}
                        >
                          Close
                        </Button>
                      ) : (
                        <Button
                          variant="ghost" size="sm" className="h-6 text-xs"
                          onClick={(e) => { e.stopPropagation(); setStatus(o, 'open'); }}
                        >
                          Reopen
                        </Button>
                      )}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Applicants for the selected listing */}
          <div className="lg:col-span-2">
            {selected ? (
              <ApplicantsPanel
                opportunity={selected}
                applications={data.applications}
                onRefresh={load}
              />
            ) : (
              <EmptyState icon={Users} title="Select an opportunity" description="Pick a listing to see its applicants." />
            )}
          </div>
        </div>
      )}

      <OpportunityForm
        open={formOpen}
        onOpenChange={setFormOpen}
        existing={editing}
        onSaved={() => { load(); setEditing(null); }}
      />

      {data.applications?.some((a) => a.credential_request_id) && (
        <p className="text-xs text-tertiary">
          Issued credentials appear in{' '}
          <Link to="/PendingSignoffs" className="text-primary hover:underline">Pending Sign-offs</Link>{' '}
          for verification.
        </p>
      )}
    </div>
  );
}