import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { formatDistanceToNowStrict } from 'date-fns';
import {
  Loader2, RefreshCw, Layers, CheckCircle2, Clock, AlertCircle,
  ExternalLink, ChevronDown, DollarSign, ShieldAlert, Boxes,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import GasFeeMonitorPanel from './GasFeeMonitorPanel';

// Internal blockchain monitoring dashboard — READ-ONLY. Every data field
// comes from anchorQueueStatus, which enforces internal-admin access
// server-side. This component performs no writes and offers no controls
// beyond refresh and batch inspection.

const STATUS_META = {
  ANCHOR_PENDING: { label: 'Pending', tone: 'text-info', dot: 'bg-info' },
  ANCHOR_PENDING_FEE: { label: 'Fee hold', tone: 'text-warning', dot: 'bg-warning' },
  ANCHOR_PROCESSING: { label: 'Processing', tone: 'text-accent', dot: 'bg-accent' },
  ANCHOR_SUBMITTED: { label: 'Submitted', tone: 'text-primary', dot: 'bg-primary' },
  ANCHOR_CONFIRMED: { label: 'Confirmed', tone: 'text-success', dot: 'bg-success' },
  ANCHOR_FAILED_RETRYABLE: { label: 'Retryable failure', tone: 'text-warning', dot: 'bg-warning' },
  ANCHOR_FAILED_PERMANENT: { label: 'Permanent failure', tone: 'text-destructive', dot: 'bg-destructive' },
};

function StatTile({ icon: Icon, label, value, tone = 'text-foreground', sub }) {
  return (
    <div className="rounded-xl border border-border bg-secondary/30 p-4">
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className={cn('h-4 w-4', tone)} />
        <p className="text-[11px] font-medium text-tertiary uppercase tracking-wide">{label}</p>
      </div>
      <p className={cn('text-xl font-semibold tabular-nums', tone)}>{value}</p>
      {sub && <p className="text-[11px] text-tertiary mt-0.5">{sub}</p>}
    </div>
  );
}

export default function ConsoleBlockchain() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [openBatch, setOpenBatch] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('anchorQueueStatus', {});
      if (!res.data?.ok) throw new Error(res.data?.error || 'Queue status unavailable');
      setData(res.data);
    } catch (e) {
      toast.error(e?.message || 'Could not load the anchoring queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openBatchDetail = async (ref) => {
    if (openBatch === ref) { setOpenBatch(null); setDetail(null); return; }
    setOpenBatch(ref);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await base44.functions.invoke('anchorQueueStatus', { action: 'batch_detail', batch_ref: ref });
      setDetail(res.data?.batch_detail || null);
    } catch { toast.error('Could not load batch detail'); }
    finally { setDetailLoading(false); }
  };

  if (loading && !data) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-7 w-7 text-primary animate-spin" /></div>;
  }
  if (!data) return null;

  const { counts, batches, cost_tracking: costs, policy, pol_price: price, volume_projection: projection, mainnet_readiness: readiness } = data;
  const alertBatches = (batches || []).filter((b) =>
    b.critical_at || b.escalated_at || b.status === 'ANCHOR_FAILED_PERMANENT' || b.status === 'ANCHOR_PENDING_FEE' || b.status === 'ANCHOR_FAILED_RETRYABLE');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Blockchain anchoring queue</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Polygon {readiness?.selector === 'polygon_mainnet' ? 'mainnet' : (readiness?.selector || 'amoy')} · read-only operations view
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Refresh
        </Button>
      </div>

      {/* Operational alerts */}
      {alertBatches.length > 0 && (
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 space-y-2">
          <p className="text-sm font-semibold text-warning flex items-center gap-2"><ShieldAlert className="h-4 w-4" /> Operational alerts ({alertBatches.length})</p>
          {alertBatches.map((b) => (
            <div key={b.batch_ref} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <span className="font-mono text-foreground">{b.batch_ref}</span>
              {b.critical_at && <span className="px-1.5 py-0.5 rounded bg-destructive/15 text-destructive font-medium">CRITICAL · {formatDistanceToNowStrict(new Date(b.created_at))} unanchored</span>}
              {b.escalated_at && !b.critical_at && <span className="px-1.5 py-0.5 rounded bg-warning/15 text-warning font-medium">Escalated · {formatDistanceToNowStrict(new Date(b.created_at))} unanchored</span>}
              {b.status === 'ANCHOR_PENDING_FEE' && <span className="px-1.5 py-0.5 rounded bg-warning/15 text-warning font-medium">Fee hold · est. ${Number(b.last_error?.match(/\$[\d.]+/)?.[0]?.slice(1) || 0).toFixed(2)}</span>}
              {b.status === 'ANCHOR_FAILED_RETRYABLE' && <span className="px-1.5 py-0.5 rounded bg-warning/15 text-warning font-medium">Retrying · attempt {b.attempts}{b.next_attempt_at ? `, next ${formatDistanceToNowStrict(new Date(b.next_attempt_at))}` : ''}</span>}
              {b.status === 'ANCHOR_FAILED_PERMANENT' && <span className="px-1.5 py-0.5 rounded bg-destructive/15 text-destructive font-medium">Needs administrator intervention</span>}
              <span className="text-tertiary truncate max-w-xs">{b.last_error || ''}</span>
            </div>
          ))}
        </div>
      )}

      {/* Queue counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile icon={Boxes} label="Open in queue" value={data.open_count} sub={`${counts.ANCHOR_PENDING} pending · ${counts.ANCHOR_PROCESSING} processing · ${counts.ANCHOR_SUBMITTED} submitted`} />
        <StatTile icon={Clock} label="Fee holds" value={counts.ANCHOR_PENDING_FEE} tone="text-warning" sub="re-checked every tick" />
        <StatTile icon={CheckCircle2} label="Confirmed batches" value={data.confirmed_count} tone="text-success" sub={`${costs.anchored_credentials} credentials anchored`} />
        <StatTile icon={AlertCircle} label="Failures" value={counts.ANCHOR_FAILED_RETRYABLE + data.permanent_failures} tone="text-destructive" sub={`${data.permanent_failures} permanent · ${counts.ANCHOR_FAILED_RETRYABLE} retryable`} />
      </div>

      {/* Batch list */}
      <Card className="surface-card">
        <CardContent className="p-5">
          <h2 className="text-sm font-semibold text-tertiary uppercase tracking-wider mb-4 flex items-center gap-2"><Layers className="h-4 w-4" /> Recent batches</h2>
          {(batches || []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No batches yet — the queue fills as credentials are verified.</p>
          ) : (
            <div className="space-y-2">
              {batches.map((b) => {
                const meta = STATUS_META[b.status] || STATUS_META.ANCHOR_PENDING;
                const isOpen = openBatch === b.batch_ref;
                return (
                  <div key={b.batch_ref} className="rounded-xl border border-border overflow-hidden">
                    <button onClick={() => openBatchDetail(b.batch_ref)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-hover/40 transition-colors">
                      <span className={cn('h-2 w-2 rounded-full flex-shrink-0', meta.dot)} />
                      <span className="font-mono text-sm text-foreground flex-shrink-0">{b.batch_ref}</span>
                      <span className={cn('text-xs font-medium flex-shrink-0', meta.tone)}>{meta.label}</span>
                      <span className="text-xs text-tertiary">{b.member_count} credential{b.member_count === 1 ? '' : 's'} · {b.network === 'polygon_mainnet' ? 'mainnet' : 'amoy'}</span>
                      <span className="text-xs text-tertiary truncate hidden sm:block">{formatDistanceToNowStrict(new Date(b.created_at))} old</span>
                      {b.actual_cost_usd != null && <span className="text-xs text-muted-foreground ml-auto hidden md:block">${Number(b.actual_cost_usd).toFixed(4)}</span>}
                      <ChevronDown className={cn('h-4 w-4 text-tertiary flex-shrink-0 ml-auto md:ml-2 transition-transform', isOpen && 'rotate-180')} />
                    </button>
                    {isOpen && (
                      <div className="border-t border-border bg-secondary/20 px-4 py-3 text-xs">
                        {detailLoading ? (
                          <Loader2 className="h-4 w-4 text-primary animate-spin" />
                        ) : detail ? (
                          <div className="space-y-2">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                              <p><span className="text-tertiary">Merkle root:</span> <span className="font-mono break-all">{detail.merkle_root ? `${String(detail.merkle_root).slice(0, 24)}…` : '—'}</span></p>
                              <p><span className="text-tertiary">Tx:</span> {detail.transaction_hash
                                ? <a href={`https://${detail.network === 'polygon_mainnet' ? '' : 'amoy.'}polygonscan.com/tx/${detail.transaction_hash}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-mono">{String(detail.transaction_hash).slice(0, 14)}… <ExternalLink className="h-3 w-3 inline" /></a>
                                : '—'}</p>
                              <p><span className="text-tertiary">Window:</span> closes {detail.close_at ? formatDistanceToNowStrict(new Date(detail.close_at), { addSuffix: true }) : '—'}</p>
                              <p><span className="text-tertiary">Attempts:</span> {detail.attempts}{detail.last_error ? ` · last error: ${detail.last_error}` : ''}</p>
                              <p><span className="text-tertiary">Cost:</span> {detail.actual_fee_pol ? `${detail.actual_fee_pol} POL` : '—'}{detail.actual_cost_usd != null ? ` ($${Number(detail.actual_cost_usd).toFixed(4)})` : ''}</p>
                            </div>
                            {(detail.members || []).length > 0 && (
                              <div>
                                <p className="text-tertiary mb-1">Members ({detail.members.length})</p>
                                <div className="space-y-0.5">
                                  {detail.members.map((m) => (
                                    <p key={m.bw_id} className="font-mono">
                                      <span className="text-tertiary">[{m.leaf_index ?? '?'}]</span> {m.bw_id} <span className="text-muted-foreground not-italic font-sans">— {m.title}</span>
                                    </p>
                                  ))}
                                </div>
                              </div>
                            )}
                            {(detail.event_log || []).length > 0 && (
                              <div>
                                <p className="text-tertiary mb-1">Event log</p>
                                <div className="space-y-0.5">
                                  {detail.event_log.map((e, i) => (
                                    <p key={i} className="text-muted-foreground">
                                      <span className="text-tertiary">{new Date(e.timestamp).toISOString().slice(0, 16).replace('T', ' ')}</span> · {e.event}{e.note ? ` — ${e.note}` : ''}
                                    </p>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : <p className="text-tertiary">Batch not found.</p>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Costs + policy */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="surface-card">
          <CardContent className="p-5">
            <h2 className="text-sm font-semibold text-tertiary uppercase tracking-wider mb-4 flex items-center gap-2"><DollarSign className="h-4 w-4" /> Cost tracking</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <p><span className="text-tertiary block text-xs">Total anchored cost</span> <span className="tabular-nums">{costs.total_cost_pol} POL</span></p>
              <p><span className="text-tertiary block text-xs">Total (USD)</span> <span className="tabular-nums">${Number(costs.total_cost_usd || 0).toFixed(4)}</span></p>
              <p><span className="text-tertiary block text-xs">Avg cost / credential</span> <span className="tabular-nums">{costs.avg_cost_per_credential_usd != null ? `$${Number(costs.avg_cost_per_credential_usd).toFixed(5)}` : '—'}</span></p>
              <p><span className="text-tertiary block text-xs">POL price</span> <span className="tabular-nums">${price?.usd ?? '—'} <span className="text-[10px] text-tertiary">({price?.source})</span></span></p>
            </div>
          </CardContent>
        </Card>
        <Card className="surface-card">
          <CardContent className="p-5">
            <h2 className="text-sm font-semibold text-tertiary uppercase tracking-wider mb-4 flex items-center gap-2"><Clock className="h-4 w-4" /> Queue policy</h2>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <p><span className="text-tertiary">Target anchor time:</span> {policy.target_minutes} min</p>
              <p><span className="text-tertiary">Escalation window:</span> {policy.escalation_minutes} min</p>
              <p><span className="text-tertiary">Critical window:</span> {Math.round(policy.critical_minutes / 60)} h</p>
              <p><span className="text-tertiary">Batching window:</span> {policy.batch_window_minutes} min</p>
              <p><span className="text-tertiary">Max batch size:</span> {policy.batch_max_size}</p>
              <p><span className="text-tertiary">Per-batch budget:</span> ${policy.max_batch_cost_usd}</p>
              <p><span className="text-tertiary">Absolute spend cap:</span> ${policy.absolute_max_cost_usd}</p>
              <p><span className="text-tertiary">Max fee / attempts:</span> {policy.max_fee_gwei} gwei / {policy.max_attempts}</p>
              <p className="col-span-2"><span className="text-tertiary">Integration-test ceiling:</span> {policy.integration_test_ceiling_pol} POL (separate, unchanged)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Volume projection + mainnet readiness */}
      <Card className="surface-card">
        <CardContent className="p-5">
          <h2 className="text-sm font-semibold text-tertiary uppercase tracking-wider mb-4">Scalability projection</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-tertiary border-b border-border text-left">
                  <th className="py-2 pr-4 font-medium">Credentials / batch</th>
                  <th className="py-2 pr-4 font-medium">Est. gas</th>
                  <th className="py-2 pr-4 font-medium">Est. cost / batch</th>
                  <th className="py-2 font-medium">Est. cost / credential</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {(Array.isArray(projection) ? projection : projection?.rows || []).map((r, i) => (
                  <tr key={i} className="border-b border-border/50 last:border-0">
                    <td className="py-2 pr-4">{r.volume.toLocaleString()} <span className="text-tertiary">({r.batch_size}/batch)</span></td>
                    <td className="py-2 pr-4">{r.batches.toLocaleString()} batches</td>
                    <td className="py-2 pr-4">${Number(r.est_total_cost_usd).toFixed(4)}</td>
                    <td className="py-2">${Number(r.est_cost_per_credential_usd).toFixed(5)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-tertiary mt-3">
            Projection at the current POL price with the configured fee ceiling — Amoy figures are measured, mainnet figures are estimates only.
            Mainnet readiness: selector {readiness?.selector_supported ? 'supported' : 'not supported'} · RPC {readiness?.rpc_configured ? 'configured' : 'missing'} ·
            anchor address {readiness?.anchor_address_configured ? 'configured' : 'missing'} · signer key {readiness?.signer_key_configured ? 'configured' : 'missing'}.
            Broadcasting remains blocked while the mainnet kill-switch is off.
          </p>
        </CardContent>
      </Card>

      {/* Gas-fee monitoring (read-only) — observations, hypothetical ceiling
          comparison, fee-held batch age + next retry, confirmation latency. */}
      <GasFeeMonitorPanel monitor={data.gas_monitor} />

    </div>
  );
}