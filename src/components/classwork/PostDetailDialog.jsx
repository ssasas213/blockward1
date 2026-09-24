import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useSchool } from '@/lib/SchoolContext';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Upload, Undo2, Paperclip, X, MessageSquare, Send } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import TeacherGradingPanel from './TeacherGradingPanel';
import PrivateAttachmentLink from './PrivateAttachmentLink';

// ── Private comment thread (student ↔ teachers) ──
function CommentThread({ submission, onReload }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [open, setOpen] = useState(false);

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      const res = await base44.functions.invoke('submissionAction', {
        action: 'comment', submission_id: submission.id, body: text.trim(),
      });
      if (res.data?.ok) { setText(''); await onReload(); }
      else toast.error(res.data?.error || 'Could not send comment');
    } catch (e) {
      toast.error('Could not send comment');
    } finally {
      setSending(false);
    }
  };

  const thread = submission.private_comment_thread || [];

  return (
    <div className="mt-4 border-t border-border pt-3">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <MessageSquare className="h-4 w-4" />
        Private comments ({thread.length})
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          {thread.map((c, i) => (
            <div key={i} className="rounded-lg bg-secondary/60 border border-border p-3">
              <p className="text-xs text-tertiary mb-1">
                {c.author_name} · {format(new Date(c.created_at), 'd MMM, HH:mm')}
              </p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{c.body}</p>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="Write a private comment…"
              className="h-9"
            />
            <Button size="icon" variant="secondary" onClick={send} disabled={sending || !text.trim()}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Student turn-in form ──
function TurnInForm({ post, onSubmitted, onCancel }) {
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);

  const turnIn = async () => {
    if (!text.trim() && files.length === 0) {
      toast.error('Attach a file or write a response first');
      return;
    }
    setBusy(true);
    try {
      const attachments = [];
      for (const file of files) {
        // Private storage: the stored URI is not a URL. Access is only
        // possible through getFileAccess, which permission-checks the caller
        // and returns a short-lived signed URL.
        const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
        attachments.push({
          name: file.name,
          url: file_uri,
          private: true,
          type: file.type || 'file',
          size: file.size,
        });
      }
      const res = await base44.functions.invoke('submissionAction', {
        action: 'turn_in',
        assignment_id: post.id,
        attachments,
        text_response: text.trim(),
      });
      if (res.data?.ok) {
        toast.success('Turned in');
        onSubmitted();
      } else {
        toast.error(res.data?.error || 'Could not turn in this work');
      }
    } catch (e) {
      toast.error('Could not turn in this work');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="work-text">Your response</Label>
        <Textarea
          id="work-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type your answer here…"
          rows={5}
        />
      </div>
      <div className="space-y-2">
        <Label>Attachments</Label>
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {files.map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 rounded-md bg-secondary/60 border border-border px-2.5 py-1 text-xs text-foreground">
                <Paperclip className="h-3 w-3" />
                {f.name}
                <button onClick={() => setFiles(files.filter((_, x) => x !== i))} className="text-muted-foreground hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <label className="inline-flex items-center gap-2 text-sm text-primary cursor-pointer hover:underline">
          <Upload className="h-4 w-4" />
          Attach files
          <input
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              const picked = Array.from(e.target.files || []);
              setFiles((prev) => [...prev, ...picked]);
              e.target.value = '';
            }}
          />
        </label>
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={turnIn} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Turn in
        </Button>
        {onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
        )}
      </div>
    </div>
  );
}

// ── Student view of one post ──
function StudentWorkPanel({ post, submission, onReload, onClose }) {
  const [composing, setComposing] = useState(
    !submission || submission.status === 'assigned'
  );
  const [busy, setBusy] = useState(false);

  const unsubmit = async () => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke('submissionAction', {
        action: 'unsubmit', submission_id: submission.id,
      });
      if (res.data?.ok) {
        toast.success('Taken back — you can edit and turn in again');
        await onReload();
        setComposing(true);
      } else {
        toast.error(res.data?.error || 'Could not take back this work');
      }
    } catch (e) {
      toast.error('Could not take back this work');
    } finally {
      setBusy(false);
    }
  };

  const turnedIn = ['submitted', 'resubmitted'].includes(submission?.status);
  const returned = submission?.status === 'returned';
  const effectiveDue = submission?.extended_due_at || post.due_at;
  const pastDue = effectiveDue && Date.now() > new Date(effectiveDue).getTime();
  const resubmitOpen = (submission?.resubmit_until && Date.now() <= new Date(submission.resubmit_until).getTime())
    || (effectiveDue && Date.now() <= new Date(effectiveDue).getTime());

  return (
    <div className="space-y-5">
      {post.instructions && (
        <div className="rounded-lg bg-secondary/60 border border-border p-4">
          <p className="text-xs font-semibold text-tertiary uppercase tracking-wider mb-2">Instructions</p>
          <p className="text-sm text-foreground whitespace-pre-wrap">{post.instructions}</p>
        </div>
      )}

      {submission?.extended_due_at && (
        <p className="text-xs text-warning">
          Your teacher extended your due date to {format(new Date(submission.extended_due_at), 'd MMM, HH:mm')}.
        </p>
      )}

      {returned && submission && (
        <div className="rounded-lg bg-success/10 border border-success/30 p-4">
          <p className="text-sm font-medium text-foreground">
            Returned{submission.grade != null && post.points_possible != null
              ? ` — ${submission.grade}/${post.points_possible}`
              : ''}
          </p>
          {submission.is_late && <Badge variant="outline" className="text-warning mt-2">Turned in late</Badge>}
        </div>
      )}

      {turnedIn && submission && (
        <div className="rounded-lg bg-secondary/60 border border-border p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-success flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-success" />
              {submission.status === 'resubmitted' ? 'Turned in again' : 'Turned in'}
              {submission.is_late && ' (late)'}
            </p>
            {submission.submitted_at && (
              <span className="text-xs text-tertiary">{format(new Date(submission.submitted_at), 'd MMM, HH:mm')}</span>
            )}
          </div>
          {submission.text_response && (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{submission.text_response}</p>
          )}
          {(submission.attachments || []).map((a, i) => (
            <PrivateAttachmentLink key={i} attachment={a} submissionId={submission.id} />
          ))}
        </div>
      )}

      {composing ? (
        <TurnInForm
          post={post}
          onSubmitted={() => { setComposing(false); onReload(); }}
          onCancel={turnedIn || returned ? () => setComposing(false) : null}
        />
      ) : (
        <div className="flex items-center gap-2">
          {(returned
            ? (post.allow_late || resubmitOpen)
            : (turnedIn && (!pastDue || post.allow_late || resubmitOpen))) && (
            <Button variant="outline" onClick={() => setComposing(true)}>
              {returned ? 'Turn in again' : 'Edit & resubmit'}
            </Button>
          )}
          {turnedIn && !pastDue && (
            <Button variant="ghost" onClick={unsubmit} disabled={busy}>
              <Undo2 className="h-4 w-4 mr-2" />
              Take back
            </Button>
          )}
        </div>
      )}

      {submission && (
        <CommentThread submission={submission} onReload={onReload} />
      )}
    </div>
  );
}

export default function PostDetailDialog({ post, canManage, onClose, onChanged }) {
  const { profile } = useSchool();
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadMine = async () => {
    if (canManage) return;
    try {
      const subs = await base44.entities.Submission.filter({ assignment_id: post.id });
      const mine = (subs || []).find(
        (s) => s.student_email?.toLowerCase() === profile?.user_email?.toLowerCase()
      );
      setSubmission(mine || null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!post) return;
    setLoading(true);
    if (canManage) setLoading(false);
    else loadMine();
  }, [post?.id, canManage]);

  if (!post) return null;

  const dueNote = post.due_at ? `Due ${format(new Date(post.due_at), 'd MMM, HH:mm')}` : '';

  return (
    <Dialog open={!!post} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap pr-6">
            {post.title}
            <Badge variant="secondary" className="capitalize text-[10px]">{post.type}</Badge>
            {post.points_possible != null && (
              <Badge variant="outline" className="text-[10px]">{post.points_possible} pts</Badge>
            )}
          </DialogTitle>
          <DialogDescription>{dueNote}</DialogDescription>
        </DialogHeader>

        {canManage ? (
          <TeacherGradingPanel post={post} onChanged={onChanged} />
        ) : loading ? (
          <div className="py-10 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <StudentWorkPanel
            post={post}
            submission={submission}
            onReload={loadMine}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}