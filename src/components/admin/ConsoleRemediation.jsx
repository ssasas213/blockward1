import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import {
  Loader2, RefreshCw, ShieldAlert, AlertTriangle, CheckCircle2,
  ArrowRight, Lock, FileWarning, Send,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const INCIDENT = { batch_ref: 'AB-5FBCA1', bw_id: 'BW-H5CHBVHE' };

/** Internal-admin remediation screen for the synthetic-confirmation incident.
 *  Loads the dry-run preview (no writes) and requires an explicit, acknowledged
 *  confirmation before execution. Server-side requireInternalAdmin is the gate. */
export default function ConsoleRemediation() {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState(null);
  const [acknowledged, setAcknowledged] = useState(false);

  const load = async () => {
    setLoading(true);
    setResult(null);
    setConfirming(false);
    setAcknowledged(false);
    try {
      const res = await base44.functions.invoke('remediateAnchorIncident', { approved: false });
      if (res.data?.ok) setPreview(res.data.plan);
      else toast.error(res.data?.error || 'Could not load remediation preview');
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Could not load remediation preview');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const execute = async () => {
    setExecuting(true);
    try {
      const res = await base44.functions.invoke('remediateAnchorIncident', { approved: true });
      if (res.data?.ok) {
        toast.success('Remediation applied — credential re-enqueued for a genuine anchor');
        setResult(res.data.applied);
        setAcknowledged(false);
        setConfirming(false);
      } else {
        toast.error(res.data?.error || 'Remediation failed');
      }
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Remediation failed');
    } finally {
      setExecuting(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-7 w-7 text-primary animate-spin" /></div>;
  }

  const plan = preview;
  const alreadyApplied = plan?.batch?.already_quarantined && plan?.credential?.already_reverted && (!plan?.achievement || plan.achievement.already_reverted);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Incident remediation</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Synthetic-confirmation incident — correct {INCIDENT.bw_id} without destroying the audit trail.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Refresh
        </Button>
      </div>

      {/* Incident summary */}
      <Card className="surface-card">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-warning" />
            <h2 className="text-sm font-semibold text-foreground">Incident</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Batch <span className="font-mono text-foreground">{INCIDENT.batch_ref}</span> was marked ANCHOR_CONFIRMED with a transaction hash that does not resolve to a genuine Polygon transaction. The linked credential <span className="font-mono text-foreground">{INCIDENT.bw_id}</span> was marked Blockward Verified and the holder was notified — both falsely.
          </p>
          <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-muted-foreground">
            This action does not broadcast a blockchain transaction. It quarantines the affected batch permanently, reverts the false verified status, preserves the audit trail, and re-enqueues the credential into a new Merkle batch. The fee-gated queue worker then decides whether and when to broadcast.
          </div>
        </CardContent>
      </Card>

      {/* Dry-run preview */}
      {plan ? (
        <Card className="surface-card">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-tertiary uppercase tracking-wider">Dry-run preview (no writes)</h2>
              {alreadyApplied ? (
                <span className="text-xs text-success flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Already applied</span>
              ) : (
                <span className="text-xs text-warning flex items-center gap-1"><FileWarning className="h-3.5 w-3.5" /> Awaiting approval</span>
              )}
            </div>

            <PlanRow
              label="Batch"
              refId={plan.batch.batch_ref}
              from={plan.batch.current_status}
              to={plan.batch.target_status}
              already={plan.batch.already_quarantined}
              note="Permanently quarantined — never re-claimed or re-broadcast"
            />
            <PlanRow
              label="Credential"
              refId={plan.credential.bw_id}
              from={plan.credential.current_anchor_status}
              to={plan.credential.target_anchor_status}
              already={plan.credential.already_reverted}
              note="False verified status cleared, stale chain_check removed"
            />
            {plan.achievement ? (
              <PlanRow
                label="Achievement"
                refId={plan.achievement.id}
                from={plan.achievement.current_status}
                to={plan.achievement.target_status}
                already={plan.achievement.already_reverted}
                note="Issuer confirmation is real; only the false blockchain-verified status is removed"
              />
            ) : (
              <div className="text-xs text-tertiary">Achievement record not linked — no achievement update.</div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border border-border bg-secondary/20 p-3">
                <p className="text-tertiary mb-1">Re-enqueue</p>
                <p className="text-foreground">{plan.reenqueue.description}</p>
              </div>
              <div className="rounded-lg border border-border bg-secondary/20 p-3">
                <p className="text-tertiary mb-1">Correction notification</p>
                <p className="text-foreground truncate">{plan.notification.to}</p>
                <p className="text-tertiary truncate">{plan.notification.subject}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="surface-card"><CardContent className="py-8 text-center text-sm text-muted-foreground">No remediation plan available.</CardContent></Card>
      )}

      {/* Execution result */}
      {result && (
        <Card className="surface-card border-success/30">
          <CardContent className="p-5 space-y-2">
            <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" /><h2 className="text-sm font-semibold text-foreground">Remediation applied</h2></div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <p><span className="text-tertiary">Batch quarantined:</span> {String(result.batch_quarantined)}</p>
              <p><span className="text-tertiary">Credential reverted:</span> {String(result.credential_reverted)}</p>
              <p><span className="text-tertiary">Achievement reverted:</span> {String(result.achievement_reverted)}</p>
              <p><span className="text-tertiary">Notification sent:</span> {String(result.notification_sent)}</p>
              <p className="col-span-2"><span className="text-tertiary">Re-enqueue:</span> <span className="font-mono">{JSON.stringify(result.reenqueue)}</span></p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Execute controls */}
      {!alreadyApplied && !result && (
        <Card className="surface-card">
          <CardContent className="p-5 space-y-4">
            {!confirming ? (
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">Review the dry-run above before executing.</p>
                <Button onClick={() => setConfirming(true)}>
                  <Lock className="h-4 w-4" /> Approve &amp; execute
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/5 p-3">
                  <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-muted-foreground">
                    <p className="font-medium text-warning mb-1">This is a production write.</p>
                    The batch will be permanently quarantined and the credential re-enqueued. The re-enqueued credential may be broadcast by the active flush workflow on the next queue tick — this can result in a real Polygon mainnet transaction if gas prices are within the fee gate.
                  </div>
                </div>
                <label className="flex items-start gap-2 text-sm text-muted-foreground cursor-pointer">
                  <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} className="mt-0.5" />
                  I understand this applies the remediation and may trigger a real mainnet anchor.
                </label>
                <div className="flex items-center justify-end gap-2">
                  <Button variant="outline" onClick={() => { setConfirming(false); setAcknowledged(false); }}>Cancel</Button>
                  <Button onClick={execute} disabled={!acknowledged || executing}>
                    {executing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Execute remediation
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PlanRow({ label, refId, from, to, already, note }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/20 p-3">
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <span className="text-xs text-tertiary uppercase tracking-wide">{label}</span>
        <span className="font-mono text-sm text-foreground">{refId}</span>
        {already && <span className="text-xs text-success flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> already applied</span>}
      </div>
      <div className="flex items-center gap-2 text-xs flex-wrap">
        <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{from || '—'}</span>
        <ArrowRight className="h-3 w-3 text-tertiary" />
        <span className="px-1.5 py-0.5 rounded bg-primary/15 text-primary font-medium">{to || '—'}</span>
      </div>
      {note && <p className="text-xs text-tertiary mt-1">{note}</p>}
    </div>
  );
}