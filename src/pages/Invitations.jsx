import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import EmptyState from '@/components/ui/empty-state';
import InvitePeopleModal from '@/components/invitations/InvitePeopleModal';
import { Users, GraduationCap, Shield, Loader2, Send, Copy, RefreshCw, Ban, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const ROLE_ICON = { teacher: Users, student: GraduationCap, admin: Shield };

import RoleGuard from '@/components/auth/RoleGuard';
export default function Invitations() { return <RoleGuard roles={['admin']}><InvitationsImpl/></RoleGuard>; }
function InvitationsImpl() {
  const [loading, setLoading] = useState(true);
  const [invitations, setInvitations] = useState([]);
  const [school, setSchool] = useState(null);
  const [profile, setProfile] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalRole, setModalRole] = useState('teacher');
  const [busy, setBusy] = useState({});

  const loadData = useCallback(async () => {
    try {
      const user = await base44.auth.me();
      const profiles = await base44.entities.UserProfile.filter({ user_email: user.email });
      const p = profiles[0];
      setProfile(p);
      if (!p?.school_id) { setLoading(false); return; }

      const schools = await base44.entities.School.filter({ id: p.school_id });
      if (schools.length) setSchool(schools[0]);

      const all = await base44.entities.SchoolInvitation.filter({ school_id: p.school_id });
      all.sort((a, b) => new Date(b.invited_at || b.created_date) - new Date(a.invited_at || a.created_date));
      setInvitations(all);
    } catch (e) {
      console.error('load invitations', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const resend = async (inv) => {
    setBusy(b => ({ ...b, [`resend-${inv.id}`]: true }));
    try {
      await base44.functions.invoke('createInvitations', {
        role: inv.role, emails: inv.invited_email, school_id: inv.school_id,
      });
      toast.success(`Invitation resent to ${inv.invited_email}`);
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed to resend');
    } finally {
      setBusy(b => ({ ...b, [`resend-${inv.id}`]: false }));
    }
  };

  const cancel = async (inv) => {
    setBusy(b => ({ ...b, [`cancel-${inv.id}`]: true }));
    try {
      await base44.entities.SchoolInvitation.update(inv.id, { status: 'revoked' });
      toast.success('Invitation cancelled');
      loadData();
    } catch {
      toast.error('Failed to cancel invitation');
    } finally {
      setBusy(b => ({ ...b, [`cancel-${inv.id}`]: false }));
    }
  };

  const copyLink = (inv) => {
    const link = `${window.location.origin}/invite/${inv.token}`;
    navigator.clipboard.writeText(link);
    toast.success('Invite link copied');
  };

  const openInvite = (role) => { setModalRole(role); setModalOpen(true); };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const pending = invitations.filter(i => i.status === 'pending');
  const accepted = invitations.filter(i => i.status === 'accepted');

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <PageHeader title="Invitations" description={`Manage invitations for ${school?.name || 'your school'}`}>
        <Button onClick={() => openInvite('teacher')}>
          <Send className="h-4 w-4 mr-2" /> Invite People
        </Button>
      </PageHeader>

      {/* Quick invite cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { role: 'teacher', label: 'Invite Teachers', icon: Users, desc: 'Verify & issue achievements' },
          { role: 'student', label: 'Invite Students', icon: GraduationCap, desc: 'Earn & track achievements' },
          { role: 'admin', label: 'Invite Admins', icon: Shield, desc: 'Manage the school' },
        ].map((c) => (
          <button
            key={c.role}
            onClick={() => openInvite(c.role)}
            className="text-left p-4 rounded-xl border border-border bg-card/60 backdrop-blur-md hover:border-primary/40 transition-all card-hover"
          >
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
              <c.icon className="h-5 w-5 text-primary" />
            </div>
            <p className="font-medium text-foreground text-sm">{c.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{c.desc}</p>
          </button>
        ))}
      </div>

      {invitations.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="No invitations yet"
          description="Invite teachers and students by email. They'll receive a secure link to join your school instantly."
        />
      ) : (
        <>
          {pending.length > 0 && (
            <Card className="border-border bg-card/60 backdrop-blur-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Send className="h-4 w-4 text-primary" /> Pending Invitations
                  <Badge variant="secondary" className="ml-1">{pending.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <InvitationTable
                  invitations={pending}
                  busy={busy}
                  onResend={resend}
                  onCancel={cancel}
                  onCopy={copyLink}
                />
              </CardContent>
            </Card>
          )}

          {accepted.length > 0 && (
            <Card className="border-border bg-card/60 backdrop-blur-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Shield className="h-4 w-4 text-success" /> Accepted
                  <Badge variant="secondary" className="ml-1">{accepted.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <InvitationTable invitations={accepted} busy={busy} onCopy={copyLink} />
              </CardContent>
            </Card>
          )}
        </>
      )}

      <InvitePeopleModal open={modalOpen} onOpenChange={setModalOpen} defaultRole={modalRole} schoolId={profile?.school_id} />
    </div>
  );
}

function InvitationTable({ invitations, busy, onResend, onCancel, onCopy }) {
  return (
    <div className="divide-y divide-border">
      {invitations.map((inv) => {
        const Icon = ROLE_ICON[inv.role] || Users;
        const isPending = inv.status === 'pending';
        return (
          <div key={inv.id} className="flex flex-wrap items-center gap-3 p-4">
            <div className="h-9 w-9 rounded-lg bg-muted/60 flex items-center justify-center flex-shrink-0">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{inv.invited_email}</p>
              <p className="text-xs text-muted-foreground capitalize">
                {inv.role} · sent {inv.invited_at ? format(new Date(inv.invited_at), 'dd MMM yyyy') : ''}
              </p>
            </div>
            <Badge
              variant="outline"
              className={`text-xs ${
                inv.status === 'accepted' ? 'border-success/30 bg-success/10 text-success' :
                inv.status === 'revoked' ? 'border-destructive/30 bg-destructive/10 text-destructive' :
                'border-warning/30 bg-warning/10 text-warning'
              }`}
            >
              {inv.status}
            </Badge>
            <div className="flex items-center gap-1">
              {isPending && onResend && (
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onResend(inv)} disabled={busy[`resend-${inv.id}`]} title="Resend">
                  {busy[`resend-${inv.id}`] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                </Button>
              )}
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onCopy(inv)} title="Copy invite link">
                <Copy className="h-3.5 w-3.5" />
              </Button>
              {isPending && onCancel && (
                <Button variant="outline" size="icon" className="h-8 w-8 text-destructive" onClick={() => onCancel(inv)} disabled={busy[`cancel-${inv.id}`]} title="Cancel">
                  {busy[`cancel-${inv.id}`] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}