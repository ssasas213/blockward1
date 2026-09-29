import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Loader2, ShieldCheck, Globe, Building2, ExternalLink, CheckCircle2, XCircle, PauseCircle, RotateCcw } from 'lucide-react';

const STATUS_META = {
  pending: { label: 'Pending review', cls: 'bg-warning/10 text-warning border-warning/30' },
  verified: { label: 'Verified', cls: 'bg-success/10 text-success border-success/30' },
  rejected: { label: 'Rejected', cls: 'bg-destructive/10 text-destructive border-destructive/30' },
  suspended: { label: 'Suspended', cls: 'bg-secondary text-muted-foreground border-border' },
};

const TYPE_LABELS = {
  company: 'Company', university: 'University', school: 'School',
  certification_provider: 'Certification provider', training_provider: 'Training provider',
  competition: 'Competition', sports_organisation: 'Sports organisation',
  nonprofit: 'Nonprofit', professional_organisation: 'Professional organisation', other: 'Other',
};

// Blockward STAFF ONLY — the internal organisation approval queue. Access is
// re-checked server-side in orgAction (set_org_status) on every action.
export default function OrgApprovals() {
  const [allowed, setAllowed] = useState(null); // null = checking
  const [orgs, setOrgs] = useState(null);
  const [tab, setTab] = useState('pending');
  const [busy, setBusy] = useState(null);

  useEffect(() => { init(); }, []);

  const init = async () => {
    const me = await base44.auth.me().catch(() => null);
    if (me?.role !== 'admin') { setAllowed(false); return; }
    setAllowed(true);
    load();
  };

  const load = async () => {
    const res = await base44.entities.IssuerOrganisation.filter({}, { sort: '-created_date', limit: 100 });
    setOrgs(res.items || res);
  };

  const act = async (org, status) => {
    setBusy(org.id);
    try {
      const res = await base44.functions.invoke('orgAction', { action: 'set_org_status', org_id: org.id, status });
      if (res.data?.ok) {
        toast.success(`${org.name} → ${status}`);
        load();
      } else { toast.error(res.data?.error || 'Action failed'); }
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Action failed');
    } finally { setBusy(null); }
  };

  if (allowed === null || orgs === null) {
    return <div className="flex items-center justify-center py-24"><div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>;
  }
  if (!allowed) {
    return (
      <Card className="surface-card max-w-md mx-auto"><CardContent className="py-14 text-center">
        <ShieldCheck className="h-8 w-8 text-tertiary mx-auto mb-3" />
        <p className="font-semibold text-foreground">Blockward staff only</p>
        <p className="text-sm text-muted-foreground mt-1">This internal tool is restricted to Blockward platform staff.</p>
      </CardContent></Card>
    );
  }

  const counts = { pending: 0, verified: 0, rejected: 0, suspended: 0 };
  for (const o of orgs) counts[o.status] = (counts[o.status] || 0) + 1;
  const shown = orgs.filter((o) => o.status === tab);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Organisation approvals</h1>
        <p className="text-sm text-muted-foreground mt-1">Blockward internal — only Verified issuer organisations can produce full Blockward Verified credentials.</p>
      </div>

      <div className="flex gap-2 mb-5 flex-wrap">
        {Object.entries(STATUS_META).map(([key, m]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${tab === key ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-hover'}`}>
            {m.label} {counts[key] ? `(${counts[key]})` : ''}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <Card className="surface-card"><CardContent className="py-12 text-center text-sm text-muted-foreground">No {tab} organisations.</CardContent></Card>
      ) : (
        <div className="space-y-4">
          {shown.map((o) => {
            const meta = STATUS_META[o.status] || STATUS_META.pending;
            return (
              <Card key={o.id} className="surface-card">
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-foreground">{o.name}</h3>
                        <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${meta.cls}`}>{meta.label}</span>
                      </div>
                      <p className="text-xs text-tertiary mt-1 capitalize">{(o.org_type || 'other').replace(/_/g, ' ')}{o.country ? ` · ${o.country}` : ''} · owner {o.owner_email}</p>
                      {o.claim_source === 'holder_suggestion' && (
                        <p className="text-xs text-warning mt-1">Suggested by holder {o.suggested_by_email || '—'}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {o.status !== 'verified' && (
                        <Button size="sm" onClick={() => act(o, 'verified')} disabled={busy === o.id}>
                          {busy === o.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />} Approve
                        </Button>
                      )}
                      {o.status !== 'rejected' && (
                        <Button size="sm" variant="outline" className="border-destructive/30 text-destructive hover:bg-destructive/10" onClick={() => act(o, 'rejected')} disabled={busy === o.id}>
                          <XCircle className="h-3.5 w-3.5 mr-1.5" /> Reject
                        </Button>
                      )}
                      {o.status === 'verified' && (
                        <Button size="sm" variant="outline" onClick={() => act(o, 'suspended')} disabled={busy === o.id}>
                          <PauseCircle className="h-3.5 w-3.5 mr-1.5" /> Suspend
                        </Button>
                      )}
                      {o.status === 'suspended' && (
                        <Button size="sm" variant="outline" onClick={() => act(o, 'pending')} disabled={busy === o.id}>
                          <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Back to review
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 text-xs">
                    {o.website && <p className="flex items-center gap-1.5 text-muted-foreground"><Globe className="h-3 w-3 flex-shrink-0" /><a href={o.website} target="_blank" rel="noreferrer" className="hover:text-primary truncate">{o.website}</a></p>}
                    {o.email_domain && <p className="text-muted-foreground">Domain: <span className="text-foreground">{o.email_domain}</span></p>}
                    {o.contact_email && <p className="text-muted-foreground">Contact: <span className="text-foreground">{o.contact_email}</span></p>}
                    {o.handle && <p className="text-muted-foreground">Handle: <span className="text-foreground">@{o.handle}</span></p>}
                  </div>
                  {o.description && <p className="text-xs text-muted-foreground mt-3 leading-relaxed">{o.description}</p>}

                  {o.event_log?.length > 0 && (
                    <div className="mt-4 border-t border-border pt-3 space-y-1">
                      {o.event_log.slice(-5).map((e, i) => (
                        <p key={i} className="text-xs text-tertiary">
                          <span className="capitalize font-medium text-muted-foreground">{e.event}</span>
                          {e.actor ? ` · ${e.actor}` : ''} · {format(new Date(e.timestamp), 'd MMM yyyy, HH:mm')}
                          {e.note ? ` — ${e.note}` : ''}
                        </p>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}