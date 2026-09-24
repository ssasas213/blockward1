import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import EmptyState from '@/components/ui/empty-state';
import { Loader2, Undo2, Users, ClipboardCheck, Send, CalendarClock } from 'lucide-react';
import PrivateAttachmentLink from './PrivateAttachmentLink';
import { format } from 'date-fns';
import { toast } from 'sonner';

// ── Teacher controls: per-student extension + controlled resubmission ──
function ExtensionControls({ submission, onReload }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [extUntil, setExtUntil] = useState('');
  const [resubUntil, setResubUntil] = useState('');

  const toLocalInput = (iso) => iso
    ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)
    : '';
  const fromLocalInput = (v) => v ? new Date(v).toISOString() : null;

  const apply = async (action, value) => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke('submissionAction', {
        action,
        submission_id: submission.id,
        [action === 'grant_extension' ? 'extended_due_at' : 'resubmit_until']: value,
      });
      if (res.data?.ok) {
        toast.success(action === 'grant_extension'
          ? (value ? 'Due date extended' : 'Extension removed')
          : (value ? 'Resubmission re-opened' : 'Resubmission closed'));
        setOpen(false);
        await onReload();
      } else {
        toast.error(res.data?.error || 'Could not apply this change');
      }
    } catch (e) {
      toast.error('Could not apply this change');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="text-xs">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
        <CalendarClock className="h-3.5 w-3.5" />
        {submission.extended_due_at
          ? `Extended to ${format(new Date(submission.extended_due_at), 'd MMM, HH:mm')}`
          : 'Extension & resubmission'}
        {submission.resubmit_until && ` · resubmit until ${format(new Date(submission.resubmit_until), 'd MMM, HH:mm')}`}
      </button>
      {open && (
        <div className="mt-2 space-y-2 rounded-lg bg-secondary/60 border border-border p-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-muted-foreground">Extend due to</span>
            <input
              type="datetime-local"
              value={extUntil || toLocalInput(submission.extended_due_at)}
              onChange={(e) => setExtUntil(e.target.value)}
              className="h-7 rounded-md border border-border bg-background px-2 text-xs"
            />
            <Button size="sm" variant="secondary" className="h-7 text-xs" disabled={busy}
              onClick={() => apply('grant_extension', fromLocalInput(extUntil || toLocalInput(submission.extended_due_at)))}>
              Apply
            </Button>
            {submission.extended_due_at && (
              <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={busy}
                onClick={() => apply('grant_extension', null)}>Remove</Button>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-muted-foreground">Allow resubmit until</span>
            <input
              type="datetime-local"
              value={resubUntil || toLocalInput(submission.resubmit_until)}
              onChange={(e) => setResubUntil(e.target.value)}
              className="h-7 rounded-md border border-border bg-background px-2 text-xs"
            />
            <Button size="sm" variant="secondary" className="h-7 text-xs" disabled={busy}
              onClick={() => apply('allow_resubmission', fromLocalInput(resubUntil || toLocalInput(submission.resubmit_until)))}>
              Apply
            </Button>
            {submission.resubmit_until && (
              <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={busy}
                onClick={() => apply('allow_resubmission', null)}>Close now</Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SubmissionRow({ submission, post, onReload }) {
  const [grade, setGrade] = useState(
    submission.draft_grade ?? submission.grade ?? ''
  );
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [showComments, setShowComments] = useState(false);

  const saveDraft = async () => {
    const original = submission.draft_grade ?? submission.grade ?? '';
    if (String(grade) === String(original)) return;
    setSaving(true);
    try {
      const res = await base44.functions.invoke('submissionAction', {
        action: 'save_draft_grade',
        submission_id: submission.id,
        grade: grade === '' ? null : Number(grade),
      });
      if (res.data?.ok) { await onReload(); }
      else toast.error(res.data?.error || 'Could not save grade');
    } catch (e) {
      toast.error('Could not save grade');
    } finally {
      setSaving(false);
    }
  };

  const comment = async () => {
    if (!commentText.trim()) return;
    setBusy(true);
    try {
      const res = await base44.functions.invoke('submissionAction', {
        action: 'comment', submission_id: submission.id, body: commentText.trim(),
      });
      if (res.data?.ok) { setCommentText(''); await onReload(); }
      else toast.error(res.data?.error || 'Could not send comment');
    } catch (e) {
      toast.error('Could not send comment');
    } finally {
      setBusy(false);
    }
  };

  const thread = submission.private_comment_thread || [];

  const statusBadge = (s) => {
    switch (s.status) {
      case 'submitted':
        return <Badge className="bg-primary/15 text-primary text-[10px]">Turned in{s.is_late ? ' (late)' : ''}</Badge>;
      case 'resubmitted':
        return <Badge className="bg-primary/15 text-primary text-[10px]">Resubmitted</Badge>;
      case 'returned':
        return <Badge className="bg-success/15 text-success text-[10px]">Returned</Badge>;
      default: {
        const effectiveDue = submission.extended_due_at || post.due_at;
        const missing = effectiveDue && Date.now() > new Date(effectiveDue).getTime();
        return missing
          ? <Badge className="bg-destructive/15 text-destructive text-[10px]">Missing</Badge>
          : <Badge variant="outline" className="text-[10px]">Not turned in</Badge>;
      }
    }
  };

  return (
    <div className="rounded-xl bg-secondary/40 border border-border p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <p className="font-medium text-foreground truncate">{submission.student_name || submission.student_email}</p>
          {statusBadge(submission)}
          {submission.submitted_at && (
            <span className="text-xs text-tertiary">{format(new Date(submission.submitted_at), 'd MMM, HH:mm')}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {post.points_possible != null && (
            <>
              <Input
                type="number"
                min="0"
                max={post.points_possible}
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                onBlur={saveDraft}
                disabled={saving}
                placeholder="—"
                className="h-8 w-16 text-center tabular-nums"
              />
              <span className="text-xs text-muted-foreground">/ {post.points_possible}</span>
            </>
          )}
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </div>
      </div>

      {submission.text_response && (
        <p className="text-sm text-muted-foreground whitespace-pre-wrap rounded-lg bg-secondary/60 border border-border p-3">
          {submission.text_response}
        </p>
      )}
      {(submission.attachments || []).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {submission.attachments.map((a, i) => (
            <PrivateAttachmentLink key={i} attachment={a} submissionId={submission.id} />
          ))}
        </div>
      )}

      <ExtensionControls submission={submission} onReload={onReload} />

      <button
        onClick={() => setShowComments(!showComments)}
        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
      >
        <Undo2 className="h-3.5 w-3.5 rotate-180" />
        Private comments ({thread.length})
      </button>
      {showComments && (
        <div className="space-y-2">
          {thread.map((c, i) => (
            <div key={i} className="rounded-lg bg-secondary/60 border border-border p-2.5">
              <p className="text-[11px] text-tertiary mb-0.5">
                {c.author_name} · {format(new Date(c.created_at), 'd MMM, HH:mm')}
              </p>
              <p className="text-sm text-foreground">{c.body}</p>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <Input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && comment()}
              placeholder="Private comment to this student…"
              className="h-8 text-sm"
            />
            <Button size="icon" variant="secondary" className="h-8 w-8" onClick={comment} disabled={busy || !commentText.trim()}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TeacherGradingPanel({ post, onChanged }) {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [returning, setReturning] = useState(false);

  const load = async () => {
    try {
      const subs = await base44.entities.Submission.filter({ assignment_id: post.id });
      setSubmissions(subs || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [post.id]);

  const returnAll = async () => {
    setReturning(true);
    try {
      const res = await base44.functions.invoke('submissionAction', {
        action: 'return_grades', assignment_id: post.id, send_all: true,
      });
      if (res.data?.ok) {
        toast.success(`Returned ${res.data.returned} graded submission${res.data.returned === 1 ? '' : 's'}`);
        await load();
        onChanged?.();
      } else {
        toast.error(res.data?.error || 'Could not return work');
      }
    } catch (e) {
      toast.error('Could not return work');
    } finally {
      setReturning(false);
    }
  };

  if (loading) {
    return (
      <div className="py-10 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasDraft = submissions.some((s) => s.draft_grade != null);
  const turnedIn = submissions.filter((s) => ['submitted', 'resubmitted'].includes(s.status)).length;

  if (post.type === 'material') {
    return (
      <EmptyState
        icon={Users}
        title="Reference material"
        description="Materials are reference-only — students don't submit work for this post."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground">
          {turnedIn} of {submissions.length} turned in
        </p>
        <Button onClick={returnAll} disabled={returning || !hasDraft}>
          {returning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ClipboardCheck className="h-4 w-4 mr-2" />}
          Return graded work
        </Button>
      </div>

      {submissions.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No students assigned yet"
          description="Submissions are created when you publish this post to the class."
        />
      ) : (
        <div className="space-y-3">
          {submissions.map((s) => (
            <SubmissionRow key={s.id} submission={s} post={post} onReload={load} />
          ))}
        </div>
      )}
    </div>
  );
}