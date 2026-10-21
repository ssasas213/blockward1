import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import {
  Loader2, RefreshCw, ShieldCheck, Clock, CheckCircle2,
  DollarSign, Layers, Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const PROPOSED_FEE_GWEI = 400;
const PROPOSED_FLUSH_SECONDS = 3;
const HEADROOM_MULTIPLIER = 1.25;

/** Production readiness dashboard — shows the three outstanding approvals,
 *  the current effective policy, latency readiness, and the protections that
 *  remain in force. Read-only: performs no writes and no transactions. */
export default function ConsoleReadiness() {
  const [status, setStatus] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [s, p] = await Promise.all([
        base44.functions.invoke('anchorQueueStatus', {}),
        base44.functions.invoke('remediateAnchorIncident', { approved: false }),
      ]);
      setStatus(s.data);
      setPreview(p.data?.plan || null);
    } catch (e) {
      toast.error(e?.message || 'Could not load readiness data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading && !status) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-7 w-7 text-primary animate-spin" /></div>;
  }

  const policy = status?.policy || {};
  const readiness = status?.mainnet_readiness || {};
  const latency = status?.latency_report || status?.gas_monitor?.latency || {};
  const nonFee = latency?.non_fee_held || {};

  const remediationApplied = preview?.batch?.already_quarantined && preview?.credential?.already_reverted && (!preview?.achievement || preview.achievement.already_reverted);
  const feeApproved = Number(policy.max_fee_gwei) >= PROPOSED_FEE_GWEI;
  const flushApproved = Number(policy.flush_debounce_seconds) >= PROPOSED_FLUSH_SECONDS;

  const approvals = [
    {
      id: 'remediation',
      title: 'Correct BW-H5CHBVHE',
      icon: ShieldCheck,
      status: remediationApplied ? 'approved' : 'pending',
      detail: remediationApplied
        ? 'Batch quarantined and credential reverted — re-enqueued for a genuine anchor.'
        : 'Synthetic-confirmation incident still outstanding. Approve in the Remediation tab.',
    },
    {
      id: 'fee',
      title: 'Faster mainnet fee policy',
      icon: DollarSign,
      status: feeApproved ? 'approved' : 'pending',
      detail: feeApproved
        ? `Fee ceiling at ${policy.max_fee_gwei} Gwei (effective raw-gas threshold ${Math.round(policy.max_fee_gwei / HEADROOM_MULTIPLIER)} Gwei).`
        : `Current ceiling ${policy.max_fee_gwei || 200} Gwei. Proposed ${PROPOSED_FEE_GWEI} Gwei (effective raw-gas threshold ${Math.round(PROPOSED_FEE_GWEI / HEADROOM_MULTIPLIER)} Gwei).`,
    },
    {
      id: 'flush',
      title: '3-second batch flush',
      icon: Zap,
      status: flushApproved ? 'approved' : 'pending',
      detail: flushApproved
        ? `Flush debounce at ${policy.flush_debounce_seconds}s — event-driven path active.`
        : `Current debounce ${policy.flush_debounce_seconds ?? 0}s (legacy window). Proposed ${PROPOSED_FLUSH_SECONDS}s. Flush workflow already connected to processAnchorQueue.`,
    },
  ];

  const remaining = approvals.filter((a) => a.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Production readiness</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {remaining === 0
              ? 'All approvals complete — sub-60s path ready for measurement.'
              : `${remaining} approval${remaining === 1 ? '' : 's'} remaining before the fast path is operational.`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Refresh
        </Button>
      </div>

      {/* Approval cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {approvals.map((a) => (
          <Card key={a.id} className={cn('surface-card', a.status === 'pending' && 'border-warning/30')}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <a.icon className={cn('h-4 w-4', a.status === 'pending' ? 'text-warning' : 'text-success')} />
                {a.status === 'pending'
                  ? <span className="text-xs text-warning flex items-center gap-1"><Clock className="h-3 w-3" /> Pending</span>
                  : <span className="text-xs text-success flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Approved</span>}
              </div>
              <p className="text-sm font-semibold text-foreground">{a.title}</p>
              <p className="text-xs text-muted-foreground mt-1">{a.detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Latency readiness */}
      <Card className="surface-card">
        <CardContent className="p-5">
          <h2 className="text-sm font-semibold text-tertiary uppercase tracking-wider mb-3 flex items-center gap-2"><Layers className="h-4 w-4" /> Verification latency</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div><p className="text-xs text-tertiary">Non-fee-held samples</p><p className="text-lg font-semibold tabular-nums text-foreground">{nonFee.sample_size ?? 0}<span className="text-xs text-tertiary"> / 20</span></p></div>
            <div><p className="text-xs text-tertiary">Median</p><p className="text-lg font-semibold tabular-nums text-foreground">{nonFee.median_seconds != null ? `${nonFee.median_seconds}s` : '—'}</p></div>
            <div><p className="text-xs text-tertiary">p95</p><p className="text-lg font-semibold tabular-nums text-foreground">{nonFee.p95_seconds != null ? `${nonFee.p95_seconds}s` : '—'}</p></div>
            <div><p className="text-xs text-tertiary">Target</p><p className="text-lg font-semibold tabular-nums text-foreground">&lt; 60s</p></div>
          </div>
          <p className="text-xs text-tertiary mt-3">
            {latency?.sufficient
              ? 'Sufficient production measurements exist — target is proven when median and p95 are both under 60s.'
              : `Insufficient samples (${nonFee.sample_size ?? 0}/20) — the 60-second target is NOT YET PROVEN. ${remaining > 0 ? 'Approvals must complete first.' : 'Collect more real production measurements.'}`}
          </p>
        </CardContent>
      </Card>

      {/* Protections preserved */}
      <Card className="surface-card border-success/30">
        <CardContent className="p-5">
          <h2 className="text-sm font-semibold text-tertiary uppercase tracking-wider mb-3 flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-success" /> Protections preserved</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
            <Check label="Mock broadcaster blocked on mainnet" />
            <Check label="Independent on-chain receipt verification" />
            <Check label="Duplicate-broadcast prevention (permanent quarantine)" />
            <Check label="Spend caps unchanged ($3 batch / $5 absolute)" />
            <Check label="Audit trail preserved (event_log)" />
            <Check label="Escalation & critical-window alerting active" />
          </div>
        </CardContent>
      </Card>

      {/* Mainnet config */}
      <Card className="surface-card">
        <CardContent className="p-5">
          <h2 className="text-sm font-semibold text-tertiary uppercase tracking-wider mb-3">Mainnet configuration</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <Cfg label="Network selector" value={readiness.selector} ok={readiness.selector_supported} />
            <Cfg label="RPC configured" value={readiness.rpc_configured ? 'yes' : 'no'} ok={readiness.rpc_configured} />
            <Cfg label="Anchor address" value={readiness.anchor_address_configured ? 'yes' : 'no'} ok={readiness.anchor_address_configured} />
            <Cfg label="Signer key" value={readiness.signer_key_configured ? 'yes' : 'no'} ok={readiness.signer_key_configured} />
          </div>
        </CardContent>
      </Card>

      {/* Operator instructions */}
      <Card className="surface-card border-primary/30">
        <CardContent className="p-5 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Operator approval instructions</h2>
          <ol className="space-y-2 text-xs text-muted-foreground list-decimal list-inside">
            <li><span className="text-foreground font-medium">Remediation:</span> open the Remediation tab, review the dry-run, and approve &amp; execute. This does not broadcast — it re-enqueues the credential for a genuine anchor.</li>
            <li><span className="text-foreground font-medium">Fee policy:</span> in Dashboard → Secrets, set <span className="font-mono">ANCHOR_MAX_FEE_GWEI</span> to <span className="font-mono">400</span>. Effective raw-gas threshold becomes ~320 Gwei (1.25× headroom). Spend caps are unchanged.</li>
            <li><span className="text-foreground font-medium">Fast flush:</span> in Dashboard → Secrets, set <span className="font-mono">ANCHOR_FLUSH_DEBOUNCE_SECONDS</span> to <span className="font-mono">3</span>. The flush workflow is already connected to processAnchorQueue.</li>
          </ol>
          <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-muted-foreground">
            Changes 2 and 3 can cause queued production batches to be broadcast automatically. Remediation can also trigger that path when it re-enqueues the credential. Do not treat these as harmless configuration changes.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Check({ label }) {
  return (
    <div className="flex items-center gap-2">
      <CheckCircle2 className="h-3.5 w-3.5 text-success flex-shrink-0" />
      <span>{label}</span>
    </div>
  );
}

function Cfg({ label, value, ok }) {
  return (
    <div>
      <p className="text-tertiary">{label}</p>
      <p className={cn('font-medium', ok ? 'text-success' : 'text-destructive')}>{String(value)}</p>
    </div>
  );
}