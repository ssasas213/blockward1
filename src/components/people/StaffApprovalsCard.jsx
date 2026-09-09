import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import EmptyState from '@/components/ui/empty-state';
import InitialsAvatar from '@/components/ui/InitialsAvatar';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { UserCheck, Loader2, Check, X, ShieldCheck, KeyRound, Mail, Clock } from 'lucide-react';
import { format } from 'date-fns';

/**
 * StaffApprovalsCard — the admin surface for teachers who joined with a staff
 * code and are waiting for approval (pending StaffMembership records). Lists
 * who they are, how they joined, when they requested and any department or
 * subjects they supplied — with Approve / Reject (confirmed) and bulk
 * approve. The empty state explains where pending teachers come from.
 *
 * hideWhenEmpty: render nothing when the queue is empty (dashboard widget
 * placement); the People tab shows the explanatory empty state instead.
 */
export default function StaffApprovalsCard({ hideWhenEmpty = false }) {
  const [requests, setRequests] = useState(null);
  const [busy, setBusy] = useState(false);
  const [approveTarget, setApproveTarget] = useState(null); // request | 'bulk'
  const [rejectTarget, setRejectTarget] = useState(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await base44.functions.invoke('staffApprovalsData', {});
      setRequests(res.data?.ok ? (res.data.requests || []) : []);
    } catch {
      setRequests([]);
    }
  }, []);

  useEffect(() => {
    load();
    try {
      const unsub = base44.entities.StaffMembership.subscribe(() => load());
      return unsub;
    } catch { return undefined; }
  }, [load]);

  const act = async (payload, successMsg) => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke('approveStaffMembership', payload);
      const data = res.data || {};
      if (!data.ok) {
        const firstError = (data.results || []).find((r) => !r.ok)?.error || data.error || 'Action failed';
        throw new Error(firstError);
      }
      if (successMsg) toast.success(successMsg);
      await load();
      return true;
    } catch (e) {
      toast.error(e?.response?.data?.error || e.message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const pendingCount = (requests || []).length;

  if (hideWhenEmpty && (!requests || pendingCount === 0)) return null;

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <UserCheck className="h-4 w-4 text-primary" />
          Staff approvals
          {pendingCount > 0 && (
            <Badge className="bg-warning/15 text-warning border-warning/30">{pendingCount} pending</Badge>
          )}
        </CardTitle>
        <CardDescription>
          Teachers who joined with your staff code wait here until an administrator approves them.
        </CardDescription>
        {pendingCount > 1 && (
          <Button size="sm" variant="outline" className="mt-2 self-start" onClick={() => setApproveTarget('bulk')} disabled={busy}>
            <Check className="h-3.5 w-3.5 mr-1.5" /> Approve all ({pendingCount})
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {requests === null ? (
          <div className="py-8 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : pendingCount === 0 ? (
          <EmptyState
            icon={UserCheck}
            title="No teachers waiting for approval"
            description="Teachers appear here when they join your school with a staff code — they can't access anything until an administrator approves them. Teachers you invite by email skip this queue and get access immediately. Share your teacher code from the Invite & codes tab."
          />
        ) : (
          <div className="space-y-2">
            {requests.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 p-3 rounded-xl border border-warning/20 bg-warning/5">
                <InitialsAvatar name={r.teacher_name} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{r.teacher_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{r.user_email}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      {r.joined_via && r.joined_via !== 'invitation'
                        ? <><KeyRound className="h-3 w-3" /> Joined with staff code {r.joined_via}</>
                        : <><Mail className="h-3 w-3" /> Joined via invitation</>}
                    </span>
                    {r.requested_at && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Requested {format(new Date(r.requested_at), 'dd MMM yyyy, HH:mm')}
                      </span>
                    )}
                  </div>
                  {(r.department || (r.subjects || []).length > 0) && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {r.department && <Badge variant="outline" className="text-[10px]">{r.department}</Badge>}
                      {(r.subjects || []).slice(0, 4).map((s) => (
                        <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <Button size="sm" onClick={() => setApproveTarget(r)} disabled={busy}>
                    <Check className="h-3.5 w-3.5 mr-1.5" /> Approve
                  </Button>
                  <Button size="sm" variant="outline" className="text-destructive" onClick={() => { setRejectTarget(r); setReason(''); }} disabled={busy}>
                    <X className="h-3.5 w-3.5 mr-1.5" /> Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Approve confirmation */}
      <Dialog open={!!approveTarget} onOpenChange={(o) => !o && setApproveTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {approveTarget === 'bulk' ? `Approve all ${pendingCount} teachers` : `Approve ${approveTarget?.teacher_name}?`}
            </DialogTitle>
            <DialogDescription>
              {approveTarget === 'bulk'
                ? 'Each teacher is approved and emailed individually. Already-approved ones are skipped safely.'
                : 'They gain access to their classes, attendance, sign-offs and points, and are emailed the good news.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveTarget(null)} disabled={busy}>Cancel</Button>
            <Button
              disabled={busy}
              onClick={async () => {
                const payload = approveTarget === 'bulk'
                  ? { action: 'approve', membership_ids: (requests || []).map((r) => r.id) }
                  : { action: 'approve', membership_id: approveTarget.id };
                const done = await act(
                  payload,
                  approveTarget === 'bulk' ? 'All teachers approved' : `${approveTarget.teacher_name} approved`,
                );
                if (done) setApproveTarget(null);
              }}
            >
              <ShieldCheck className="h-4 w-4 mr-1.5" /> Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject with reason */}
      <Dialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject {rejectTarget?.teacher_name}?</DialogTitle>
            <DialogDescription>
              Their request is declined and they're emailed. Their account survives as a school-less student — nothing is deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Reason (optional, shown to the teacher)</Label>
            <Textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. We couldn't verify your role — please ask your head of department"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)} disabled={busy}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={async () => {
                const done = await act(
                  { action: 'reject', membership_id: rejectTarget.id, reason },
                  `${rejectTarget.teacher_name}'s request rejected`,
                );
                if (done) setRejectTarget(null);
              }}
            >
              Reject request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}