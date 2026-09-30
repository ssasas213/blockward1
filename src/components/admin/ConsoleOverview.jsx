import React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Building2, CheckCircle2, Clock, AlertTriangle, FileText, ShieldCheck } from 'lucide-react';
import { formatDateTime } from '@/lib/achievementStatus';

const STAT = [
  { key: 'pending', label: 'Awaiting review', icon: Clock, tone: 'amber' },
  { key: 'verified', label: 'Verified issuers', icon: CheckCircle2, tone: 'green' },
];

export default function ConsoleOverview({ data, onOpenOrg, setTab }) {
  const o = data?.overview || {};
  const counts = o.org_counts || { pending: 0, verified: 0, rejected: 0, suspended: 0 };
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Operations overview</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Blockward internal — restricted.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STAT.map((s) => (
          <Card key={s.key} className="surface-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <s.icon className={cn('h-4 w-4', s.tone === 'amber' ? 'text-warning' : 'text-success')} />
                <span className="text-xs text-tertiary">{s.label}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{counts[s.key] || 0}</p>
            </CardContent>
          </Card>
        ))}
        <Card className="surface-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1"><AlertTriangle className="h-4 w-4 text-destructive" /><span className="text-xs text-tertiary">Failed anchors</span></div>
            <p className="text-2xl font-bold text-foreground">{o.failed_anchors?.length || 0}</p>
          </CardContent>
        </Card>
        <Card className="surface-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1"><FileText className="h-4 w-4 text-primary" /><span className="text-xs text-tertiary">Recent credentials</span></div>
            <p className="text-2xl font-bold text-foreground">{o.recently_issued_credentials?.length || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Pending review queue */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-foreground">Organisations awaiting review</h2>
          <button onClick={() => setTab('organisations')} className="text-xs text-primary hover:underline">View all</button>
        </div>
        {o.pending_review?.length ? (
          <div className="space-y-2">
            {o.pending_review.slice(0, 5).map((org) => (
              <button key={org.id} onClick={() => onOpenOrg(org)} className="w-full text-left surface-card card-hover rounded-lg px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{org.name}</p>
                  <p className="text-xs text-tertiary capitalize truncate">{(org.org_type || 'other').replace(/_/g, ' ')}{org.country ? ` · ${org.country}` : ''}</p>
                </div>
                <span className="text-xs text-warning flex items-center gap-1 flex-shrink-0"><Clock className="h-3 w-3" /> Pending</span>
              </button>
            ))}
          </div>
        ) : <Card className="surface-card"><CardContent className="py-8 text-center text-sm text-muted-foreground">No organisations awaiting review.</CardContent></Card>}
      </section>

      {/* Failed anchors */}
      {o.failed_anchors?.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-foreground mb-2">Failed / delayed blockchain anchors</h2>
          <div className="space-y-2">
            {o.failed_anchors.map((c) => (
              <div key={c.id} className="surface-card rounded-lg px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{c.bw_id} · {c.title}</p>
                  <p className="text-xs text-tertiary truncate">{c.issuer_org}{c.blockchain?.error ? ` — ${c.blockchain.error}` : ''}</p>
                </div>
                <span className="text-xs text-destructive flex-shrink-0">Failed</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent audit */}
      {o.recent_audit?.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-foreground mb-2">Recent admin activity</h2>
          <div className="surface-card rounded-lg divide-y divide-border/60">
            {o.recent_audit.slice(0, 8).map((e) => (
              <div key={e.id} className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0"><span className="font-medium text-foreground">{e.org_name}</span> <span className="text-tertiary">· {e.action}</span></span>
                <span className="text-xs text-tertiary flex-shrink-0">{formatDateTime(e.timestamp)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}