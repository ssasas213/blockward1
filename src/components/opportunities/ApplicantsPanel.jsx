import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import InitialsAvatar from '@/components/ui/InitialsAvatar';
import EmptyState from '@/components/ui/empty-state';
import { Shield, CheckCircle2, XCircle, MessageSquare, Send, Award, Users, ExternalLink } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { APP_STATUS_LABELS, APP_STATUS_VARIANTS } from '@/lib/opportunities';

function ApplicantMessages({ application, open, onOpenChange, onSent }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const { toast } = useToast();
  if (!application) return null;

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      const res = await base44.functions.invoke('opportunityAction', {
        action: 'message', application_id: application.id, text: text.trim(),
      });
      if (!res.data?.ok) throw new Error(res.data?.error || 'Message could not be sent.');
      setText('');
      onSent();
    } catch (e) {
      toast({ title: 'Could not send', description: e.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Message {application.student_name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-1">
          {(application.messages || []).length === 0 && (
            <p className="text-sm text-muted-foreground">No messages yet — say hello.</p>
          )}
          {(application.messages || []).map((m, i) => (
            <div key={i} className={`rounded-lg p-3 text-sm ${m.sender === 'organisation' ? 'bg-primary/10' : 'bg-secondary/60'}`}>
              <p className="text-xs text-tertiary mb-0.5">
                {m.sender === 'organisation' ? 'You' : application.student_name} · {m.sender_name}
              </p>
              <p className="text-foreground whitespace-pre-wrap">{m.text}</p>
            </div>
          ))}
        </div>
        <DialogFooter className="items-start gap-2">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a message…" rows={2} className="flex-1" />
          <Button onClick={send} disabled={sending || !text.trim()} size="icon"><Send className="h-4 w-4" /></Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ApplicantRow({ application, onRefresh }) {
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const a = application;

  const call = async (payload, successTitle) => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke('opportunityAction', payload);
      if (!res.data?.ok) throw new Error(res.data?.error || 'Action failed.');
      if (successTitle) toast({ title: successTitle });
      onRefresh();
    } catch (e) {
      toast({ title: 'Could not update', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const match = a.match || { requirements: [], matched_count: 0, total_required: 0, unmet_required: [] };

  return (
    <Card className="surface-card">
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <InitialsAvatar name={a.student_name} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground truncate">{a.student_name}</p>
            <p className="text-xs text-tertiary flex items-center gap-2">
              <span className="flex items-center gap-1">
                <Shield className="h-3.5 w-3.5 text-success" />
                {a.verified_credential_count} verified credential{a.verified_credential_count === 1 ? '' : 's'}
              </span>
              {a.student_handle && (
                <Link to={`/@${a.student_handle}`} className="text-primary hover:underline flex items-center gap-0.5">
                  @{a.student_handle} <ExternalLink className="h-3 w-3" />
                </Link>
              )}
            </p>
          </div>
          <Badge variant={APP_STATUS_VARIANTS[a.status] || 'secondary'}>{APP_STATUS_LABELS[a.status] || a.status}</Badge>
          <Select
            value={a.status}
            onValueChange={(v) => v !== a.status && call({ action: 'update_status', application_id: a.id, status: v }, 'Status updated')}
          >
            <SelectTrigger className="w-[130px] h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(APP_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ApplicantMessagesTrigger application={a} onSent={onRefresh} />
        </div>

        {/* Matched / missing credentials, highlighted */}
        {match.total_required > 0 && (
          <div className="rounded-lg border border-border bg-secondary/40 p-3">
            <p className="text-xs font-medium text-foreground mb-1.5">
              Matches {match.matched_count} of {match.total_required} required credentials
            </p>
            <div className="flex flex-wrap gap-1.5">
              {match.requirements.map((r, i) => (
                <span
                  key={i}
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs ${r.met ? 'bg-success/10 text-success border border-success/25' : 'bg-destructive/10 text-destructive border border-destructive/25'}`}
                  title={r.met ? r.matched_credential?.title : 'Missing'}
                >
                  {r.met ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                  {r.label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Answers */}
        {(a.answers || []).length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">Application answers</summary>
            <div className="mt-2 space-y-2">
              {a.answers.map((ans, i) => (
                <div key={i}>
                  <p className="text-xs text-tertiary">{ans.question}</p>
                  <p className="text-sm text-foreground">{ans.answer || <span className="text-tertiary">—</span>}</p>
                </div>
              ))}
            </div>
          </details>
        )}

        {/* Complete → issue credential loop */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {a.credential_issued ? (
            <Badge variant="success" className="gap-1"><Award className="h-3 w-3" /> Credential requested</Badge>
          ) : a.completed_at ? (
            <Button size="sm" disabled={busy} onClick={() => call({ action: 'issue_credential', application_id: a.id }, 'Credential request created — it will appear in Pending Sign-offs')}>
              <Award className="h-3.5 w-3.5 mr-1.5" /> Issue credential
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled={busy} onClick={() => call({ action: 'complete', application_id: a.id }, 'Marked completed — you can now issue their credential')}>
              Mark completed
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ApplicantMessagesTrigger({ application, onSent }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
        {(application.messages || []).length > 0 ? `Messages (${application.messages.length})` : 'Message'}
      </Button>
      <ApplicantMessages application={application} open={open} onOpenChange={setOpen} onSent={onSent} />
    </>
  );
}

/**
 * ApplicantsPanel — the posting organisation's applicant tracker for one
 * listing: pipeline stages, verified credentials (matches highlighted),
 * in-platform messaging, and the completion-credential loop.
 */
export default function ApplicantsPanel({ opportunity, applications, onRefresh }) {
  const apps = (applications || []).filter((a) => a.opportunity_id === opportunity?.id);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-foreground">Applicants — {opportunity?.title}</h3>
        <Badge variant="secondary">{apps.length}</Badge>
      </div>

      {apps.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No applicants yet"
          description="Students who apply appear here with their verified credentials attached automatically."
        />
      ) : (
        apps.map((a) => <ApplicantRow key={a.id} application={a} onRefresh={onRefresh} />)
      )}
    </div>
  );
}