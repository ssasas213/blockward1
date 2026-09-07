import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import EmptyState from '@/components/ui/empty-state';
import { MessageSquare, Send, Award, Inbox } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { APP_STATUS_LABELS, APP_STATUS_VARIANTS } from '@/lib/opportunities';

function ThreadDialog({ application, open, onOpenChange, onSent }) {
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
          <DialogTitle>{application.opportunity_title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-1">
          {(application.messages || []).length === 0 && (
            <p className="text-sm text-muted-foreground">No messages yet — say hello.</p>
          )}
          {(application.messages || []).map((m, i) => (
            <div key={i} className={`rounded-lg p-3 text-sm ${m.sender === 'organisation' ? 'bg-secondary/60' : 'bg-primary/10'}`}>
              <p className="text-xs text-tertiary mb-0.5">
                {m.sender === 'organisation' ? application.organisation_name : 'You'} · {m.sender_name}
              </p>
              <p className="text-foreground whitespace-pre-wrap">{m.text}</p>
            </div>
          ))}
        </div>
        <DialogFooter className="items-start gap-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a message…"
            rows={2}
            className="flex-1"
          />
          <Button onClick={send} disabled={sending || !text.trim()} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * MyApplications — the student's applications across all organisations,
 * with status chips and the in-platform message thread.
 */
export default function MyApplications({ applications, onRefresh }) {
  const [threadFor, setThreadFor] = useState(null);

  if (!applications || applications.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="No applications yet"
        description="Browse the feed and apply — your verified credentials attach automatically."
      />
    );
  }

  return (
    <div className="space-y-3">
      {applications.map((a) => (
        <Card key={a.id} className="surface-card">
          <CardContent className="p-4 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">{a.opportunity_title}</p>
              <p className="text-xs text-tertiary">{a.organisation_name}</p>
            </div>
            <Badge variant={APP_STATUS_VARIANTS[a.status] || 'secondary'}>
              {APP_STATUS_LABELS[a.status] || a.status}
            </Badge>
            {a.credential_issued && (
              <Badge variant="success" className="gap-1">
                <Award className="h-3 w-3" /> Credential issued
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={() => setThreadFor(a)}>
              <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
              Messages
              {(a.messages || []).length > 0 && ` (${a.messages.length})`}
            </Button>
          </CardContent>
        </Card>
      ))}
      <ThreadDialog
        application={applications.find((a) => a.id === threadFor)}
        open={!!threadFor}
        onOpenChange={(o) => !o && setThreadFor(null)}
        onSent={onRefresh}
      />
    </div>
  );
}