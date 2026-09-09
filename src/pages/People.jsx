import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Send, Users, Shield, Loader2, Copy, Check, RefreshCw, Power, Mail, Ban,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import RoleGuard from '@/components/auth/RoleGuard';
import PendingTeacherRequests from '@/components/onboarding/PendingTeacherRequests';
import DemoDataCard from '@/components/people/DemoDataCard';

export default function People() {
  return <RoleGuard roles={['admin']}><PeopleImpl /></RoleGuard>;
}

function PeopleImpl() {
  const [loading, setLoading] = useState(true);
  const [school, setSchool] = useState(null);
  const [profile, setProfile] = useState(null);
  const [codes, setCodes] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [copied, setCopied] = useState({});
  const [busy, setBusy] = useState({});
  const [generating, setGenerating] = useState(false);
  const [role, setRole] = useState('teacher');
  const [emails, setEmails] = useState('');
  const [sending, setSending] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const user = await base44.auth.me();
      const profiles = await base44.entities.UserProfile.filter({ user_email: user.email });
      const p = profiles[0];
      setProfile(p);
      if (!p?.school_id) { setLoading(false); return; }
      const schools = await base44.entities.School.filter({ id: p.school_id });
      if (schools.length) setSchool(schools[0]);

      const allCodes = (await base44.entities.SchoolCode.filter({ school_id: p.school_id }))
        .filter(c => c.role_type !== 'student');
      const order = { teacher: 0, admin: 1 };
      allCodes.sort((a, b) => (order[a.role_type] ?? 9) - (order[b.role_type] ?? 9));
      setCodes(allCodes);

      const all = await base44.entities.SchoolInvitation.filter({ school_id: p.school_id });
      all.sort((a, b) => new Date(b.invited_at || b.created_date) - new Date(a.invited_at || a.created_date));
      setInvitations(all);
    } catch (e) {
      console.error('People load', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Live pending-staff count for the Staff approvals tab label.
  const [pendingStaff, setPendingStaff] = useState(0);
  useEffect(() => {
    if (!profile?.school_id) return;
    const loadCount = () => base44.entities.StaffMembership.filter({ school_id: profile.school_id, status: 'pending' })
      .then((items) => setPendingStaff(items.length))
      .catch(() => {});
    loadCount();
    try {
      const unsub = base44.entities.StaffMembership.subscribe(loadCount);
      return unsub;
    } catch { return undefined; }
  }, [profile?.school_id]);

  const generateCodes = async () => {
    setGenerating(true);
    try {
      const res = await base44.functions.invoke('generateSchoolCodes', { action: 'generate' });
      if (!res.data?.ok) throw new Error(res.data?.error || 'Failed');
      setCodes(res.data.codes);
      toast.success('Join codes created');
    } catch (e) {
      toast.error(e.message || 'Failed to generate codes');
    } finally {
      setGenerating(false);
    }
  };

  const regenerate = async (code) => {
    setBusy(b => ({ ...b, [`reg-${code.id}`]: true }));
    try {
      const res = await base44.functions.invoke('generateSchoolCodes', { action: 'regenerate', code_id: code.id });
      if (!res.data?.ok) throw new Error(res.data?.error || 'Failed');
      setCodes(prev => prev.map(c => c.id === code.id ? res.data.code : c));
      toast.success('New code generated. Old code deactivated.');
    } catch (e) {
      toast.error(e.message || 'Failed to regenerate');
    } finally {
      setBusy(b => ({ ...b, [`reg-${code.id}`]: false }));
    }
  };

  const toggle = async (code) => {
    setBusy(b => ({ ...b, [`tog-${code.id}`]: true }));
    try {
      const res = await base44.functions.invoke('generateSchoolCodes', { action: 'toggle', code_id: code.id });
      if (!res.data?.ok) throw new Error(res.data?.error || 'Failed');
      setCodes(prev => prev.map(c => c.id === code.id ? res.data.code : c));
      toast.success(`Code ${res.data.code.status === 'active' ? 'activated' : 'deactivated'}`);
    } catch (e) {
      toast.error(e.message || 'Failed');
    } finally {
      setBusy(b => ({ ...b, [`tog-${code.id}`]: false }));
    }
  };

  const sendInvite = async (resendInv = null) => {
    const isResend = !!resendInv;
    const payloadEmails = isResend ? resendInv.invited_email : emails;
    const payloadRole = isResend ? resendInv.role : role;
    if (!payloadEmails || !payloadEmails.trim()) { toast.error('Enter at least one email'); return; }
    if (isResend) setBusy(b => ({ ...b, [`send-${resendInv.id}`]: true })); else setSending(true);
    try {
      const res = await base44.functions.invoke('sendSchoolInvitations', {
        action: 'send', role: payloadRole, emails: payloadEmails, resend: isResend,
      });
      if (!res.data?.ok) throw new Error(res.data?.error || 'Failed');
      const { sent_count, skipped_count, failed_count } = res.data;
      const parts = [`${sent_count} sent`];
      if (skipped_count) parts.push(`${skipped_count} skipped (already pending)`);
      if (failed_count) parts.push(`${failed_count} email failed`);
      if (failed_count > 0) toast.error(parts.join(' · '));
      else if (skipped_count > 0) toast.warning(parts.join(' · '));
      else toast.success(parts.join(' · '));
      if (!isResend) setEmails('');
      loadData();
    } catch (e) {
      toast.error(e.message || 'Failed to send');
    } finally {
      if (isResend) setBusy(b => ({ ...b, [`send-${resendInv.id}`]: false })); else setSending(false);
    }
  };

  const revoke = async (inv) => {
    setBusy(b => ({ ...b, [`rev-${inv.id}`]: true }));
    try {
      const res = await base44.functions.invoke('sendSchoolInvitations', { action: 'revoke', invitation_id: inv.id });
      if (!res.data?.ok) throw new Error(res.data?.error || 'Failed');
      toast.success('Invitation cancelled');
      loadData();
    } catch (e) {
      toast.error(e.message || 'Failed');
    } finally {
      setBusy(b => ({ ...b, [`rev-${inv.id}`]: false }));
    }
  };

  const copy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied({ ...copied, [key]: true });
    toast.success('Copied');
    setTimeout(() => setCopied({ ...copied, [key]: false }), 2000);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const pending = invitations.filter(i => i.status === 'pending');
  const accepted = invitations.filter(i => i.status === 'accepted');

  const codeConfig = {
    teacher: { title: 'Teacher Join Code', description: 'Share with teachers to request access', icon: Users, color: 'text-primary', bgIcon: 'bg-primary/10' },
    admin: { title: 'Admin Join Code', description: 'Highly restricted — requires owner approval', icon: Shield, color: 'text-accent', bgIcon: 'bg-accent/10' },
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <PageHeader title="People" description={`Invite and manage people for ${school?.name || 'your school'}`} />

      <Tabs defaultValue="invite" className="w-full">
        <TabsList>
          <TabsTrigger value="invite">Invite &amp; codes</TabsTrigger>
          <TabsTrigger value="staff">
            Staff approvals
            {pendingStaff > 0 && (
              <Badge className="ml-1.5 bg-warning/15 text-warning border-warning/30 text-[10px] px-1.5 py-0">{pendingStaff}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="invite" className="space-y-8 pt-4">
...
        </TabsContent>

        <TabsContent value="staff" className="pt-4">
          <StaffApprovalsCard />
        </TabsContent>
      </Tabs>

      {/* Super admins only — seed/remove a complete demo organisation */}
      {profile?.admin_level === 'super_admin' && <DemoDataCard />}
    </div>
  );
}

function InvitationRow({ inv, busy, onRevoke, onResend, onCopy, copied }) {
  const Icon = inv.role === 'admin' ? Shield : Users;
  const link = `${window.location.origin}/invite/${inv.token}`;
  return (
    <div className="flex flex-wrap items-center gap-3 p-4">
      <div className="h-9 w-9 rounded-lg bg-muted/60 flex items-center justify-center flex-shrink-0"><Icon className="h-4 w-4 text-muted-foreground" /></div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{inv.invited_email}</p>
        <p className="text-xs text-muted-foreground capitalize">{inv.role} · sent {inv.invited_at ? format(new Date(inv.invited_at), 'dd MMM yyyy') : ''}</p>
        {inv.email_status === 'failed' && <p className="text-xs text-destructive mt-0.5">Email failed to send — use Resend</p>}
      </div>
      <Badge variant="outline" className={`text-xs ${inv.status === 'accepted' ? 'border-success/30 bg-success/10 text-success' : inv.status === 'revoked' ? 'border-destructive/30 bg-destructive/10 text-destructive' : 'border-warning/30 bg-warning/10 text-warning'}`}>{inv.status}</Badge>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onCopy(link, `inv-${inv.id}`)} title="Copy invite link">
          {copied[`inv-${inv.id}`] ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
        {inv.status === 'pending' && onResend && (
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onResend(inv)} disabled={busy[`send-${inv.id}`]} title="Resend">
            {busy[`send-${inv.id}`] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
        )}
        {inv.status === 'pending' && onRevoke && (
          <Button variant="outline" size="icon" className="h-8 w-8 text-destructive" onClick={() => onRevoke(inv)} disabled={busy[`rev-${inv.id}`]} title="Cancel">
            {busy[`rev-${inv.id}`] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
          </Button>
        )}
      </div>
    </div>
  );
}