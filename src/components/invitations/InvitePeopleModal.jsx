import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Users, Shield, Loader2, Send, CheckCircle2, AlertCircle, Copy } from 'lucide-react';
import { toast } from 'sonner';

const ROLES = [
  { key: 'teacher', label: 'Teacher', icon: Users },
  { key: 'admin', label: 'Administrator', icon: Shield },
];

export default function InvitePeopleModal({ open, onOpenChange, defaultRole = 'teacher', schoolId }) {
  const [role, setRole] = useState(defaultRole);
  const [emails, setEmails] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  const handleSend = async () => {
    if (!emails.trim()) { toast.error('Enter at least one email'); return; }
    setSending(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke('sendSchoolInvitations', { action: 'send', role, emails, school_id: schoolId });
      const data = res.data || {};
      if (!data.ok) throw new Error(data.error || 'Failed to send invitations');
      setResult(data);
      const parts = [`${data.sent_count || 0} sent`];
      if (data.skipped_count) parts.push(`${data.skipped_count} skipped`);
      if (data.failed_count) parts.push(`${data.failed_count} failed`);
      if (data.failed_count > 0) toast.error(parts.join(' · '));
      else if (data.skipped_count > 0) toast.warning(parts.join(' · '));
      else toast.success(parts.join(' · '));
      setEmails('');
    } catch (err) {
      toast.error(err?.response?.data?.error || err.message || 'Failed to send invitations');
    } finally {
      setSending(false);
    }
  };

  const copyLink = (url) => { navigator.clipboard.writeText(url); toast.success('Invite link copied'); };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Invite People</DialogTitle>
          <DialogDescription>Send an invitation by email. They join instantly — no codes or approval needed.</DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 border border-success/20">
              <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
              <p className="text-sm text-success font-medium">{result.sent_count} sent</p>
            </div>

            {result.failed_count > 0 && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <div className="text-sm text-destructive">
                  <p className="font-medium">{result.failed_count} email failed to send</p>
                  <p className="text-xs mt-0.5">Invitation created but undeliverable — usually no custom email domain configured for non-registered addresses. Resend from the People page after fixing delivery.</p>
                  {result.failed.map(f => <p key={f.id} className="text-xs mt-1 truncate">↳ {f.email}: {f.email_error}</p>)}
                </div>
              </div>
            )}

            {result.skipped_count > 0 && (
              <p className="text-xs text-muted-foreground">{result.skipped_count} already had a pending invitation and were skipped.</p>
            )}

            {result.sent?.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Invite links:</p>
                {result.sent.map(c => (
                  <div key={c.id} className="flex items-center gap-2 p-2 rounded-lg border border-border bg-muted/30">
                    <span className="text-xs text-foreground truncate flex-1">{c.email}</span>
                    <Button variant="outline" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => copyLink(c.invite_url)}><Copy className="h-3.5 w-3.5" /></Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setResult(null)}>Send More</Button>
              <Button className="flex-1" onClick={() => onOpenChange(false)}>Done</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-5 py-2">
            <div>
              <p className="text-sm font-medium text-foreground mb-2">Who do you want to invite?</p>
              <div className="grid grid-cols-2 gap-2">
                {ROLES.map(r => (
                  <button key={r.key} type="button" onClick={() => setRole(r.key)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all text-center ${role === r.key ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}>
                    <r.icon className={`h-5 w-5 ${role === r.key ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className="text-xs font-medium text-foreground">{r.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Email addresses</p>
              <Textarea value={emails} onChange={e => setEmails(e.target.value)} placeholder="teacher1@gmail.com, teacher2@gmail.com&#10;(comma or new line separated)" rows={4} className="resize-none" />
              <p className="text-xs text-muted-foreground">Students join with a class code from their teacher — invite teachers and admins here.</p>
            </div>
            <Button onClick={handleSend} disabled={sending || !emails.trim()} className="w-full">
              {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              {sending ? 'Sending…' : 'Send Invitations'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}