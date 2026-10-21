import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { formatDistanceToNowStrict } from 'date-fns';
import { Activity, Gauge, Clock, TrendingUp, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

// READ-ONLY gas-fee monitoring panel for the internal admin blockchain
// dashboard. Renders recorded observations, the live-vs-hypothetical ceiling
// comparison, fee-held batch age + next retry, and approval→confirmation
// latency. All data comes from anchorQueueStatus (server-authorised). No
// controls — monitoring only.

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function fmtMin(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  if (v < 1) return `${Math.round(v * 60)}s`;
  return `${v.toFixed(1)} min`;
}

function ObservationRow({ o }) {
  const live = o.live_decision_allowed;
  return (
    <tr className="border-b border-border/50 last:border-0">
      <td className="py-1.5 pr-3 text-tertiary">{new Date(o.observed_at).toISOString().slice(11, 16)}</td>
      <td className="py-1.5 pr-3 tabular-nums">{o.eth_gas_price_gwei != null ? `${o.eth_gas_price_gwei}` : '—'}</td>
      <td className="py-1.5 pr-3 tabular-nums">{o.proposed_max_fee_per_gas_gwei != null ? `${o.proposed_max_fee_per_gas_gwei}` : '—'}</td>
      <td className="py-1.5 pr-3 tabular-nums">{o.estimated_fee_pol || '—'}</td>
      <td className="py-1.5 pr-3 tabular-nums">{o.estimated_fee_usd != null ? `$${Number(o.estimated_fee_usd).toFixed(5)}` : '—'}</td>
      <td className="py-1.5">
        {live == null ? (
          <span className="text-tertiary">—</span>
        ) : live ? (
          <span className="inline-flex items-center gap-1 text-success"><CheckCircle2 className="h-3 w-3" /> Permit</span>
        ) : (
          <span className="inline-flex items-center gap-1 text-warning"><XCircle className="h-3 w-3" /> Hold</span>
        )}
      </td>
    </tr>
  );
}

export default function GasFeeMonitorPanel({ monitor }) {
  if (!monitor) return null;
  const { observations = [], ceiling_comparison = [], fee_held_batches = [], latency = {}, confirmation_sla = {} } = monitor;

  return (
    <div className="space-y-4">
      {/* Live observation summary */}
      <Card className="surface-card">
        <CardContent className="p-5">
          <h2 className="text-sm font-semibold text-tertiary uppercase tracking-wider mb-4 flex items-center gap-2"><Gauge className="h-4 w-4" /> Gas fee monitoring</h2>
          <p className="text-[11px] text-tertiary mb-3">
            Read-only mainnet eth_gasPrice observation captured every scheduled worker tick (every {monitor.worker_interval_minutes || 5} min).
            The live policy (ceiling {monitor.live_max_fee_gwei || 200} gwei, ${monitor.live_max_batch_cost_usd || 3} / batch, ${monitor.live_absolute_max_cost_usd || 5} absolute) is unchanged — this panel only records and simulates.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-tertiary border-b border-border text-left">
                  <th className="py-2 pr-3 font-medium">Time (UTC)</th>
                  <th className="py-2 pr-3 font-medium">Observed gwei</th>
                  <th className="py-2 pr-3 font-medium">Proposed gwei (+25%)</th>
                  <th className="py-2 pr-3 font-medium">Est. batch POL</th>
                  <th className="py-2 pr-3 font-medium">Est. batch USD</th>
                  <th className="py-2 font-medium">Live policy</th>
                </tr>
              </thead>
              <tbody>
                {observations.length === 0 ? (
                  <tr><td colSpan={6} className="py-4 text-center text-tertiary">No observations yet — the worker records one per tick.</td></tr>
                ) : observations.map((o, i) => <ObservationRow key={i} o={o} />)}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Hypothetical ceiling comparison (simulation only) */}
      <Card className="surface-card">
        <CardContent className="p-5">
          <h2 className="text-sm font-semibold text-tertiary uppercase tracking-wider mb-1 flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Hypothetical ceiling comparison</h2>
          <p className="text-[11px] text-tertiary mb-3">
            Simulation only — pass rate across {ceiling_comparison[0]?.total || 0} recorded observations. Never affects broadcasting.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-tertiary border-b border-border text-left">
                  <th className="py-2 pr-4 font-medium">Ceiling</th>
                  <th className="py-2 pr-4 font-medium">Would broadcast</th>
                  <th className="py-2 pr-4 font-medium">Pass rate</th>
                  <th className="py-2 pr-4 font-medium">Median est. cost / batch</th>
                </tr>
              </thead>
              <tbody>
                {ceiling_comparison.map((c) => (
                  <tr key={c.ceiling_gwei} className={cn('border-b border-border/50 last:border-0', c.ceiling_gwei === (monitor.live_max_fee_gwei || 200) && 'bg-primary/5')}>
                    <td className="py-2 pr-4">
                      {c.ceiling_gwei} gwei
                      {c.ceiling_gwei === (monitor.live_max_fee_gwei || 200) && <span className="ml-1.5 text-[10px] text-primary font-medium">live</span>}
                    </td>
                    <td className="py-2 pr-4 tabular-nums">{c.pass}/{c.total}</td>
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 rounded-full bg-secondary overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: `${(c.pass_rate * 100).toFixed(0)}%` }} />
                        </div>
                        <span className="tabular-nums">{(c.pass_rate * 100).toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="py-2 tabular-nums">{c.median_est_fee_usd != null ? `$${Number(c.median_est_fee_usd).toFixed(5)}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-tertiary mt-3">
            Sample window: {monitor.sample_from ? new Date(monitor.sample_from).toISOString().slice(0, 16).replace('T', ' ') : '—'} → {monitor.sample_to ? new Date(monitor.sample_to).toISOString().slice(0, 16).replace('T', ' ') : '—'} UTC.
          </p>
        </CardContent>
      </Card>

      {/* Fee-held batches — age + next retry */}
      <Card className="surface-card">
        <CardContent className="p-5">
          <h2 className="text-sm font-semibold text-tertiary uppercase tracking-wider mb-4 flex items-center gap-2"><Clock className="h-4 w-4" /> Fee-held batches</h2>
          {fee_held_batches.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3 text-center">No batches are fee-held right now.</p>
          ) : (
            <div className="space-y-2">
              {fee_held_batches.map((b) => (
                <div key={b.batch_ref} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs rounded-lg border border-warning/20 bg-warning/5 px-3 py-2">
                  <span className="font-mono text-foreground">{b.batch_ref}</span>
                  <span className="text-tertiary">{b.member_count} credential{b.member_count === 1 ? '' : 's'}</span>
                  <span className="text-warning font-medium">held {b.age_minutes != null ? `${Math.round(b.age_minutes)} min` : '—'}</span>
                  <span className="text-tertiary">next retry {b.next_attempt_at ? formatDistanceToNowStrict(new Date(b.next_attempt_at), { addSuffix: true }) : 'next tick'}</span>
                  {b.age_minutes >= 30 && <span className="px-1.5 py-0.5 rounded bg-warning/15 text-warning font-medium">30-min alert sent</span>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation latency / SLA */}
      <Card className="surface-card">
        <CardContent className="p-5">
          <h2 className="text-sm font-semibold text-tertiary uppercase tracking-wider mb-4 flex items-center gap-2"><Activity className="h-4 w-4" /> Confirmation latency</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-[11px] text-tertiary">Approval → queue</p>
              <p className="tabular-nums font-medium">{fmtMin(latency.approval_to_queue_median)}</p>
            </div>
            <div>
              <p className="text-[11px] text-tertiary">Queue → submit</p>
              <p className="tabular-nums font-medium">{fmtMin(latency.queue_to_submit_median)}</p>
            </div>
            <div>
              <p className="text-[11px] text-tertiary">Submit → confirm</p>
              <p className="tabular-nums font-medium">{fmtMin(latency.submit_to_confirm_median)}</p>
            </div>
            <div>
              <p className="text-[11px] text-tertiary">Total (approval → confirm)</p>
              <p className="tabular-nums font-medium">{fmtMin(latency.total_median)}</p>
            </div>
          </div>
          <p className="text-[11px] text-tertiary mt-3">
            Medians over {latency.sample_size || 0} recently confirmed batches. Target: submit ≤2 min, confirm ≤5 min.
            Confirmation SLA alerts fire when a submitted batch waits &gt;10 min without a receipt.
          </p>
          {confirmation_sla?.alerted_count > 0 && (
            <div className="mt-2 flex items-center gap-2 text-xs text-warning">
              <AlertTriangle className="h-3.5 w-3.5" /> {confirmation_sla.alerted_count} confirmation SLA alert{confirmation_sla.alerted_count === 1 ? '' : 's'} sent this period.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}