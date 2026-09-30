import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { Search } from 'lucide-react';
import { STATUS_META } from '@/lib/orgStatus';

const TYPE_LABELS = {
  company: 'Company', university: 'University', school: 'School',
  certification_provider: 'Certification provider', training_provider: 'Training provider',
  competition: 'Competition', sports_organisation: 'Sports organisation',
  nonprofit: 'Nonprofit', professional_organisation: 'Professional organisation', other: 'Other',
};

export default function OrgReviewQueue({ orgs, onOpenOrg }) {
  const [tab, setTab] = useState('pending');
  const [q, setQ] = useState('');
  const counts = { pending: 0, verified: 0, rejected: 0, suspended: 0 };
  for (const o of orgs) counts[o.status] = (counts[o.status] || 0) + 1;

  const shown = orgs.filter((o) => o.status === tab).filter((o) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (o.name || '').toLowerCase().includes(s) || (o.owner_email || '').toLowerCase().includes(s) || (o.email_domain || '').toLowerCase().includes(s);
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground">Organisation review</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Approve, reject, suspend or request information. Only Verified issuers can produce Blockward Verified credentials.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {Object.entries(STATUS_META).map(([key, m]) => (
          <button key={key} onClick={() => setTab(key)}
            className={cn('rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors', tab === key ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-hover')}>
            {m.label} {counts[key] ? `(${counts[key]})` : ''}
          </button>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-tertiary" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search organisations…" className="pl-9" />
      </div>

      {shown.length === 0 ? (
        <Card className="surface-card"><CardContent className="py-10 text-center text-sm text-muted-foreground">No {tab} organisations.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {shown.map((o) => {
            const m = STATUS_META[o.status] || STATUS_META.pending;
            return (
              <button key={o.id} onClick={() => onOpenOrg(o)} className="w-full text-left surface-card card-hover rounded-lg px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground truncate">{o.name}</h3>
                      <span className={cn('rounded-md border px-2 py-0.5 text-xs font-medium', m.cls)}>{m.label}</span>
                    </div>
                    <p className="text-xs text-tertiary mt-0.5 capitalize">{TYPE_LABELS[o.org_type] || (o.org_type || 'other').replace(/_/g, ' ')}{o.country ? ` · ${o.country}` : ''}</p>
                    <p className="text-xs text-tertiary mt-0.5">Owner {o.owner_email} · created {format(new Date(o.created_date), 'd MMM yyyy')}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}