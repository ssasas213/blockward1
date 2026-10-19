import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollText, FlaskConical, ExternalLink, ShieldCheck, Clock, CheckCircle2, XCircle, Eye, ListChecks } from 'lucide-react';

const STATUS_CLS = {
  pending_review: 'bg-amber-500/10 text-amber-600 border-amber-500/25',
  info_requested: 'bg-amber-500/10 text-amber-600 border-amber-500/25',
  verifier_authorized: 'bg-primary/10 text-primary border-primary/25',
  verifier_confirmed: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25',
  verifier_declined: 'bg-destructive/10 text-destructive border-destructive/25',
  verifier_rejected: 'bg-destructive/10 text-destructive border-destructive/25',
  rejected: 'bg-destructive/10 text-destructive border-destructive/25',
  issued: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25',
  withdrawn: 'bg-secondary text-muted-foreground border-border',
};

/** Super Admin — Historical Verification Requests queue. Separate from
 *  ordinary organisation-administrator permissions: the data only loads
 *  through the server-side internal-admin check. Requests are grouped by
 *  pipeline stage: pending authority review, approved verifiers awaiting
 *  confirmation, completed verifications, and rejected / declined. */
export default function HistoricalReviewQueue({ data, loading, onOpen, onSeedDemo }) {
  const requests = data?.requests || [];
  const demo = data?.demo_requests || [];
  const stats = data?.stats || {};
  if (loading) return <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mt-16" />;

  const GROUPS = [
    { id: 'pending', label: 'Pending review', icon: Clock, hint: 'Proposed verifiers awaiting the authority review',
      statuses: ['pending_review', 'info_requested'] },
    { id: 'awaiting', label: 'Awaiting verifier confirmation', icon: Eye, hint: 'Approved verifiers that have not confirmed yet',
      statuses: ['verifier_authorized'] },
    { id: 'completed', label: 'Completed verifications', icon: CheckCircle2, hint: 'Confirmed and issued credentials',
      statuses: ['verifier_confirmed', 'issued'] },
    { id: 'rejected', label: 'Rejected requests', icon: XCircle, hint: 'Rejected verifiers, declined confirmations and withdrawn requests',
      statuses: ['verifier_rejected', 'verifier_declined', 'rejected', 'withdrawn'] },
  ];
  const grouped = GROUPS.map((g) => ({ ...g, rows: requests.filter((r) => g.statuses.includes(r.status)) }));
  const hasAny = requests.length > 0 || demo.length > 0;

  const renderRow = (r) => (
    <button key={r.id} onClick={() => onOpen(r)}
      className="w-full flex items-center gap-3 rounded-xl border border-border bg-card/40 px-4 py-3 text-left hover:border-primary/30 hover:bg-card transition-colors">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground truncate">{r.title}</p>
        <p className="text-xs text-muted-foreground truncate">{r.request_ref} · {r.student_name} · {r.issuing_org} · achieved {r.original_date}</p>
      </div>
      <span className="hidden md:block text-xs text-muted-foreground truncate max-w-52">Verifier: {r.verifier_name}</span>
      <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_CLS[r.status] || ''}`}>{String(r.status).replace(/_/g, ' ')}</span>
    </button>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="page-title">Historical Verification Requests</h2>
        <p className="page-subtitle mt-1">Two-stage authority review: approve the verifier first, the verifier confirms the achievement second.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[['In review', stats.pending], ['With verifier', stats.with_verifier], ['Issued', stats.issued], ['Declined / rejected', stats.declined]].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border bg-card/40 p-3">
            <p className="stat-value">{value ?? 0}</p>
            <p className="caption mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {!hasAny ? (
        <div className="rounded-xl border border-border bg-card/40 p-10 text-center">
          <ScrollText className="h-8 w-8 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">No historical verification requests yet</p>
          <p className="text-xs text-muted-foreground mt-1">Student submissions appear here for authority review.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map((g) => {
            const GIcon = g.icon;
            return (
              <div key={g.id}>
                <div className="flex items-center gap-2 mb-2">
                  <GIcon className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-semibold text-foreground">{g.label}</p>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{g.rows.length}</span>
                  <span className="hidden md:block text-xs text-tertiary truncate">{g.hint}</span>
                </div>
                {g.rows.length === 0 ? (
                  <p className="text-xs text-tertiary px-1">None right now.</p>
                ) : (
                  <div className="space-y-2">{g.rows.map(renderRow)}</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* DEMO — test mode only (the server returns demo data solely to the test super user) */}
      {data?.test_mode && (
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-warning" />
            <p className="text-sm font-semibold text-foreground">Demo Super Admin (TEST MODE)</p>
          </div>
          <p className="text-xs text-muted-foreground">Synthetic requests below never email external addresses, never issue real credentials and never touch Polygon.</p>
          <Button size="sm" variant="outline" onClick={onSeedDemo}>
            <ListChecks className="h-4 w-4 mr-1.5" /> Create demo verification request
          </Button>
          <div className="space-y-2">
            {demo.length === 0 ? <p className="text-xs text-tertiary">No demo requests yet.</p> : demo.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-lg border border-border bg-card/60 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-foreground truncate">{r.title} <span className="text-warning font-bold uppercase">Demo</span></p>
                  <p className="text-[11px] text-muted-foreground">{r.request_ref} · {String(r.status).replace(/_/g, ' ')}</p>
                </div>
                {r.demo_verifier_url && (
                  <Button size="sm" variant="outline" asChild>
                    <a href={r.demo_verifier_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs">
                      Simulate verifier <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => onOpen(r)}>Review</Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}