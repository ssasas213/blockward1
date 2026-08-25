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

export default function People() {
  return <RoleGuard roles={['admin']}><PeopleImpl /></RoleGuard>;
}

function PeopleImpl() {
  const [loading, setLoading] = useState(true);
  const [school, setSchool] = useState(null);
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

      {/* PRIMARY — Invite by email */}
      <Card className="border-border bg-card/60 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Send className="h-4 w-4 text-primary" /> Invite by Email</CardTitle>
          <CardDescription>The recommended way to add people — instant, no approval needed.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr_auto] gap-3 items-end">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="teacher">Teacher</SelectItem>
                  <SelectItem value="admin">Administrator</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Email addresses</Label>
              <Input value={emails} onChange={e => setEmails(e.target.value)} placeholder="teacher1@gmail.com, teacher2@gmail.com" />
            </div>
            <Button onClick={sendInvite} disabled={sending || !emails.trim()} className="h-10">
              {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              {sending ? 'Sending…' : 'Send Invitation'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Separate multiple emails with commas. Students join with a class code from their teacher — you don't invite students here.</p>

          {invitations.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Mail className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No invitations yet. Invite a teacher or administrator above.</p>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              {pending.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Pending ({pending.length})</p>
                  <div className="divide-y divide-border rounded-lg border border-border">
                    {pending.map(inv => <InvitationRow key={inv.id} inv={inv} busy={busy} onRevoke={revoke} onResend={sendInvite} onCopy={copy} copied={copied} />)}
                  </div>
                </div>
              )}
              {accepted.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Accepted ({accepted.length})</p>
                  <div className="divide-y divide-border rounded-lg border border-border">
                    {accepted.map(inv => <InvitationRow key={inv.id} inv={inv} onCopy={copy} copied={copied} />)}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* SECONDARY — Join codes (fallback) */}
      <section className="space-y-4">
        <Card className="border-border bg-info/5">
          <CardContent className="p-4 flex items-start gap-3">
            <div className="h-8 w-8 rounded-lg bg-info/15 flex items-center justify-center flex-shrink-0">
              <Send className="h-4 w-4 text-info" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Email invitations are the recommended way to add people</p>
              <p className="text-xs text-muted-foreground mt-0.5">Use these codes as a fallback when a teacher or admin can't be emailed. Students join a class with a class code, not a school code.</p>
            </div>
          </CardContent>
        </Card>

        {codes.length === 0 ? (
          <Card className="border-border bg-card/60">
            <CardContent className="py-10 text-center">
              <Shield className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-4">No join codes yet. Generate the teacher and admin codes as a fallback.</p>
              <Button onClick={generateCodes} disabled={generating}>
                {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Shield className="h-4 w-4 mr-2" />}
                {generating ? 'Generating…' : 'Generate Join Codes'}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {codes.map(codeRecord => {
              const config = codeConfig[codeRecord.role_type] || codeConfig.teacher;
              const isActive = codeRecord.status === 'active';
              return (
                <Card key={codeRecord.id} className={`border-border bg-card/60 backdrop-blur-md ${!isActive ? 'opacity-60' : ''}`}>
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className={`h-11 w-11 rounded-xl ${config.bgIcon} flex items-center justify-center flex-shrink-0`}>
                        <config.icon className={`h-5 w-5 ${config.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-medium text-foreground text-sm">{config.title}</h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isActive ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>{isActive ? 'Active' : 'Disabled'}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{config.description}</p>
                        <div className="flex items-center gap-2 mt-3">
                          <code className="flex-1 px-3 py-2 rounded-lg bg-muted/50 text-sm font-mono font-semibold text-foreground tracking-wider">{codeRecord.code}</code>
                          <Button variant="outline" size="icon" onClick={() => copy(codeRecord.code, `code-${codeRecord.id}`)} className="h-9 w-9 flex-shrink-0">
                            {copied[`code-${codeRecord.id}`] ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                          </Button>
                        </div>
                        <div className="flex items-center gap-3 mt-3">
                          <span className="text-xs text-muted-foreground">Used {codeRecord.use_count || 0}{codeRecord.max_uses ? ` / ${codeRecord.max_uses}` : ''} times</span>
                          {codeRecord.expires_at && <span className="text-xs text-muted-foreground">Expires {new Date(codeRecord.expires_at).toLocaleDateString()}</span>}
                        </div>
                        <div className="flex gap-2 mt-3">
                          <Button variant="outline" size="sm" onClick={() => regenerate(codeRecord)} disabled={busy[`reg-${codeRecord.id}`]} className="h-8">
                            {busy[`reg-${codeRecord.id}`] ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}Regenerate
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => toggle(codeRecord)} disabled={busy[`tog-${codeRecord.id}`]} className="h-8">
                            {busy[`tog-${codeRecord.id}`] ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Power className="h-3.5 w-3.5 mr-1" />}{isActive ? 'Deactivate' : 'Activate'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            <Card className="border-border bg-card/60 backdrop-blur-md">
              <CardHeader>
                <CardTitle className="text-sm">Quick Share Links</CardTitle>
                <CardDescription>Registration links with codes embedded</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {codes.filter(c => c.status === 'active').map(codeRecord => {
                  const shareUrl = `${window.location.origin}/JoinSchool?code=${codeRecord.code}`;
                  return (
                    <div key={codeRecord.id} className="flex items-center gap-2">
                      <Input value={shareUrl} readOnly className="flex-1 bg-muted/30 font-mono text-xs" />
                      <Button variant="outline" size="icon" onClick={() => copy(shareUrl, `share-${codeRecord.id}`)} className="h-9 w-9 flex-shrink-0"><Copy className="h-4 w-4" /></Button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        )}
      </section>
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