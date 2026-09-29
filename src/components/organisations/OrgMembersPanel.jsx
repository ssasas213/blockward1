import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import InitialsAvatar from '@/components/ui/InitialsAvatar';
import { Users, Loader2, UserPlus, MoreHorizontal } from 'lucide-react';

const STATUS_BADGES = {
  active: { variant: 'success', label: 'Active' },
  invited: { variant: 'secondary', label: 'Invited' },
  suspended: { variant: 'warning', label: 'Suspended' },
};

/**
 * OrgMembersPanel — verifiers of this organisation. Owners can invite
 * verifiers by email and manage member status.
 */
export default function OrgMembersPanel({ org, isOwner, members, onChanged }) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [form, setForm] = useState({ full_name: '', email: '', job_title: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const invite = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await base44.functions.invoke('orgAction', {
        action: 'invite_verifier', org_id: org.id, ...form,
      });
      if (!res?.data?.ok && !res?.data?.invited) throw new Error(res?.data?.error || 'Invite failed');
      toast.success(res.data.email_sent === false
        ? 'Verifier added — but the invitation email failed to send'
        : 'Invitation sent');
      setInviteOpen(false);
      setForm({ full_name: '', email: '', job_title: '' });
      onChanged?.();
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Invite failed');
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (memberId, status, label) => {
    try {
      const res = await base44.functions.invoke('orgAction', {
        action: 'set_member_status', org_id: org.id, member_id: memberId, status,
      });
      if (!res?.data?.ok) throw new Error(res?.data?.error || 'Action failed');
      toast.success(`Member ${label}`);
      onChanged?.();
    } catch (e) {
      toast.error(e?.response?.data?.error || e?.message || 'Action failed');
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-5 w-5 text-primary" />
            Verifiers
            <Badge variant="secondary">{members.length}</Badge>
            {isOwner && (
              <Button size="sm" className="ml-auto" onClick={() => setInviteOpen(true)}>
                <UserPlus className="h-4 w-4" /> Invite verifier
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {members.map((m) => {
            const sb = STATUS_BADGES[m.status] || STATUS_BADGES.invited;
            return (
              <div key={m.id} className="flex items-center gap-3 rounded-xl border border-border bg-secondary/30 p-3">
                <InitialsAvatar name={m.full_name || m.user_email} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-foreground truncate">
                      {m.full_name || m.user_email}
                    </p>
                    {m.role === 'owner' && <Badge variant="info">Owner</Badge>}
                    <Badge variant={sb.variant}>{sb.label}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {m.job_title || 'Verifier'} · {m.user_email}
                  </p>
                </div>
                {isOwner && m.role !== 'owner' && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {m.status === 'suspended' ? (
                        <DropdownMenuItem onClick={() => setStatus(m.id, 'active', 'reactivated')}>
                          Reactivate
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => setStatus(m.id, 'suspended', 'suspended')}>
                          Suspend
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem className="text-destructive" onClick={() => setStatus(m.id, 'removed', 'removed')}>
                        Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Dialog open={inviteOpen} onOpenChange={(v) => { if (!busy) setInviteOpen(v); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite a verifier</DialogTitle>
            <DialogDescription>
              They'll receive an email invitation to join {org.name} and confirm achievements.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Full name</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="e.g. Sarah Ahmed" />
            </div>
            <div className="space-y-1.5">
              <Label>Work email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="e.g. sarah@organisation.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Job title</Label>
              <Input value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} placeholder="e.g. Mathematics Teacher" />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={invite} disabled={busy || !form.full_name.trim() || !form.email.trim()}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Send invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}