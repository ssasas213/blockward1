import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { UserPlus, Loader2, Check, X } from 'lucide-react';

/**
 * OrgMembershipRequestsWidget — students requesting to join this
 * organisation (or who invited it to BlockWard), awaiting admin approval.
 * Renders nothing when there are no pending requests.
 */
export default function OrgMembershipRequestsWidget() {
  const [requests, setRequests] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await base44.functions.invoke('orgMembershipAction', { action: 'pending' });
      setRequests(res.data?.ok ? res.data.requests : []);
    } catch (e) {
      setRequests([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const resolve = async (id, action) => {
    setBusy(id);
    try {
      const res = await base44.functions.invoke('orgMembershipAction', { action, membership_id: id });
      if (!res.data?.ok) throw new Error(res.data?.error || 'Failed');
      toast.success(action === 'approve' ? 'Membership approved — they can now request verified credentials' : 'Request declined');
      load();
    } catch (e) {
      toast.error(e?.response?.data?.error || e.message);
    } finally {
      setBusy(null);
    }
  };

  if (!requests || requests.length === 0) return null;

  return (
    <Card className="shadow-sm border-primary/20">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-primary" />
          Membership requests
          <Badge variant="default">{requests.length} pending</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {requests.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-secondary/40 p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">{r.student_name}</p>
                <p className="text-xs text-muted-foreground">
                  {r.origin === 'org_invite'
                    ? 'Invited this organisation to BlockWard'
                    : 'Requested to join this organisation'}
                  {r.requested_at && ` · ${new Date(r.requested_at).toLocaleDateString('en-GB')}`}
                </p>
              </div>
              <Button size="sm" variant="success" onClick={() => resolve(r.id, 'approve')} disabled={busy === r.id}>
                {busy === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Approve
              </Button>
              <Button size="sm" variant="outline" onClick={() => resolve(r.id, 'decline')} disabled={busy === r.id}>
                <X className="h-3.5 w-3.5" /> Decline
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}