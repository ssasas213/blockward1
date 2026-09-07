import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/ui/page-header';
import EmptyState from '@/components/ui/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import SignoffDialog from '@/components/achievements/SignoffDialog';
import { toast } from 'sonner';
import {
  ClipboardCheck, FileText, LinkIcon, PenLine, Undo2, XCircle, AlertTriangle, ShieldCheck,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { STATUS_LABELS, TIER_SHORT, CATEGORY_LABELS } from '@/lib/achievementRequests';

export default function PendingSignoffs() {
  const [queue, setQueue] = useState([]);
  const [flagged, setFlagged] = useState([]);
  const [role, setRole] = useState('teacher');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);

  const [signTarget, setSignTarget] = useState(null);      // request or 'bulk'
  const [approveTarget, setApproveTarget] = useState(null); // admin second approval
  const [changesTarget, setChangesTarget] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [comment, setComment] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await base44.functions.invoke('achievementRequestData', { mode: 'reviewer' });
      if (!res.data?.ok) throw new Error(res.data?.error || 'Failed to load');
      setQueue(res.data.queue || []);
      setFlagged(res.data.flagged_students || []);
      setRole(res.data.reviewer?.role || 'teacher');
      setSelected([]);
    } catch (e) {
      toast.error(e?.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = async (payload, successMsg) => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke('achievementRequestAction', payload);
      if (!res.data?.ok) throw new Error(res.data?.error || 'Action failed');
      if (successMsg) toast.success(successMsg);
      await load();
      return res.data;
    } catch (e) {
      const detail = e?.response?.data?.error || e.message;
      if (e?.response?.data?.signed && e?.response?.data?.failed?.length) {
        toast.warning(`Signed ${e.response.data.signed.length}, ${e.response.data.failed.length} failed`);
      } else {
        toast.error(detail);
      }
      throw e;
    } finally {
      setBusy(false);
    }
  };

  const onSignConfirm = async (signoff) => {
    try {
      if (signTarget === 'bulk') {
        await act(
          { action: 'bulk_sign', request_ids: selected, ...signoff },
          `Signed off ${selected.length} request${selected.length === 1 ? '' : 's'}`
        );
      } else {
        await act({ action: 'sign', request_id: signTarget.id, ...signoff }, 'Signed off — publishing');
      }
      setSignTarget(null);
    } catch (_) { /* toast shown */ }
  };

  const onApproveConfirm = async (signoff) => {
    try {
      const res = await act(
        { action: 'admin_approve', request_id: approveTarget.id, ...signoff },
        approveTarget.verification_tier === 3 ? 'Approved — external verification link sent' : 'Approved & published'
      );
      if (res?.verification_id) toast.success(`Published as ${res.verification_id}`);
      setApproveTarget(null);
    } catch (_) { /* toast shown */ }
  };

  if (loading) return <DashboardSkeleton />;

  const selectedRequests = queue.filter((r) => selected.includes(r.id));
  const bulkReady = role === 'teacher' && selectedRequests.length > 0 &&
    selectedRequests.every((r) => r.verification_tier === 1);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pending sign-offs"
        description={role === 'admin'
          ? 'Student-requested achievements awaiting your review or second approval'
          : 'Achievement requests where you are the nominated verifier'}
      >
        <Badge variant={queue.length > 0 ? 'warning' : 'secondary'} className="text-sm px-3 py-1">
          {queue.length} pending
        </Badge>
      </PageHeader>

      {flagged.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-foreground">High rejection rate flagged</p>
            <p className="text-muted-foreground mt-0.5">
              {[...new Set(flagged.map((f) => f.student_name || f.student_email))].join(', ')}{' '}
              {flagged.length === 1 ? 'has' : 'have'} had over 40% of {`5+`} requests rejected. Worth a closer look.
            </p>
          </div>
        </div>
      )}

      {bulkReady && (
        <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 p-4">
          <p className="text-sm text-foreground">
            {selectedRequests.length} Tier 1 request{selectedRequests.length === 1 ? '' : 's'} selected — sign them all off with one method
          </p>
          <Button size="sm" onClick={() => setSignTarget('bulk')}>
            <PenLine className="h-4 w-4 mr-1.5" /> Sign {selectedRequests.length} selected
          </Button>
        </div>
      )}

      {queue.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="Nothing waiting for you"
          description="When a student nominates you as their verifier, their request appears here with the evidence inline."
        />
      ) : (
        <div className="space-y-3">
          {queue.map((r) => {
            const isSelected = selected.includes(r.id);
            const canBulk = role === 'teacher' && r.verification_tier === 1;
            const needsAdminApproval = r.status === 'awaiting_second_approval';
            return (
              <Card key={r.id} className={`border-border bg-card/60 backdrop-blur-md shadow-sm ${isSelected ? 'border-primary/50' : ''}`}>
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    {canBulk && (
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(v) => setSelected((s) => v === true ? [...s, r.id] : s.filter((id) => id !== r.id))}
                        className="mt-1"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-foreground">{r.title}</h3>
                        <Badge variant="outline">{TIER_SHORT[r.verification_tier]}</Badge>
                        {r.student_flagged && (
                          <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> high rejection rate</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {r.student_name} · {r.credential_type_title} · {CATEGORY_LABELS[r.category] || r.category}
                        {r.date_achieved && ` · achieved ${new Date(r.date_achieved).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                        {r.submitted_at && ` · submitted ${new Date(r.submitted_at).toLocaleDateString('en-GB')}`}
                      </p>
                      {r.description && <p className="text-sm text-foreground/80 mt-2">{r.description}</p>}
                      {(r.evidence || []).length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {(r.evidence || []).map((e, i) => (
                            <a key={i} href={e.url} target="_blank" rel="noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground hover:bg-hover transition-colors">
                              {e.type === 'file' ? <FileText className="h-3.5 w-3.5 text-primary" /> : <LinkIcon className="h-3.5 w-3.5 text-primary" />}
                              {e.name}
                            </a>
                          ))}
                        </div>
                      )}
                      {needsAdminApproval && r.verifier_signoff && (
                        <p className="mt-3 text-xs text-muted-foreground">
                          Verified by {r.nominated_verifier_name || 'the nominated verifier'} ({r.verifier_signoff.method?.replace(/_/g, ' ')})
                          {r.verifier_signoff.signed_at && ` on ${new Date(r.verifier_signoff.signed_at).toLocaleDateString('en-GB')}`}
                          {r.verification_tier === 3 && ' — Tier 3: after your approval an external verifier will be emailed a one-time link.'}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {needsAdminApproval ? (
                      <Button size="sm" onClick={() => setApproveTarget(r)} disabled={busy}>
                        <ShieldCheck className="h-4 w-4 mr-1.5" />
                        {r.verification_tier === 3 ? 'Approve & send external link' : 'Approve & publish'}
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => setSignTarget(r)} disabled={busy}>
                        <PenLine className="h-4 w-4 mr-1.5" /> Sign off
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => { setChangesTarget(r); setComment(''); }} disabled={busy}>
                      <Undo2 className="h-4 w-4 mr-1.5" /> Request changes
                    </Button>
                    <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => { setRejectTarget(r); setComment(''); }} disabled={busy}>
                      <XCircle className="h-4 w-4 mr-1.5" /> Reject
                    </Button>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {STATUS_LABELS[r.status]}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Sign-off (verifier, incl. bulk) */}
      <SignoffDialog
        open={!!signTarget}
        onOpenChange={(o) => !o && setSignTarget(null)}
        title={signTarget === 'bulk' ? `Sign off ${selectedRequests.length} requests` : `Sign off "${signTarget?.title}"`}
        description="Choose how you verified this, confirm the attestation, and sign. On sign-off the credential is published to the student's profile."
        confirmLabel="Sign off & publish"
        busy={busy}
        onConfirm={onSignConfirm}
      />

      {/* Admin second approval */}
      <SignoffDialog
        open={!!approveTarget}
        onOpenChange={(o) => !o && setApproveTarget(null)}
        title={`Second approval: "${approveTarget?.title}"`}
        description={approveTarget?.verification_tier === 3
          ? 'You are the organisation approver. After your approval, an external verifier will be emailed a one-time link to confirm.'
          : 'You are giving the organisation admin approval. Your name is stored alongside the verifier in the public signer chain.'}
        confirmLabel={approveTarget?.verification_tier === 3 ? 'Approve & email external verifier' : 'Approve & publish'}
        busy={busy}
        onConfirm={onApproveConfirm}
      />

      {/* Request changes */}
      <Dialog open={!!changesTarget} onOpenChange={(o) => !o && setChangesTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request changes</DialogTitle>
            <DialogDescription>Your comment is emailed to {changesTarget?.student_name}. They can edit and resubmit.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>What should change?</Label>
            <Textarea rows={4} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="e.g. The evidence doesn't show the final result — add the results sheet" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangesTarget(null)} disabled={busy}>Cancel</Button>
            <Button
              disabled={!comment.trim() || busy}
              onClick={async () => {
                try {
                  await act({ action: 'request_changes', request_id: changesTarget.id, comment }, 'Sent back for changes');
                  setChangesTarget(null);
                } catch (_) {}
              }}
            >
              Send back for changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject */}
      <Dialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject this request</DialogTitle>
            <DialogDescription>
              The reason is emailed to {rejectTarget?.student_name} and stays private — rejections never appear on their public profile.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Reason (required)</Label>
            <Textarea rows={4} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Why this can't be verified" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)} disabled={busy}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!comment.trim() || busy}
              onClick={async () => {
                try {
                  await act({ action: 'reject', request_id: rejectTarget.id, reason: comment }, 'Request rejected');
                  setRejectTarget(null);
                } catch (_) {}
              }}
            >
              Reject request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}