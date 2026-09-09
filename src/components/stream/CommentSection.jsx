import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import InitialsAvatar from '@/components/ui/InitialsAvatar';
import { Eye, Loader2, MessageSquare, MessageSquareOff, MicOff, Send, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

// Class-visible comments on a Stream post. The privacy banner is deliberate:
// it must be unmistakable that these comments are public to the whole class —
// NOT a private conversation with the teacher.
export default function CommentSection({ post, classData, isTeacher, me, settings, busy, onAction }) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const commentsOpen = post.allow_comments === true
    ? true
    : post.allow_comments === false
      ? false
      : (settings.allow_student_comments !== false);
  const muted = !!settings.i_am_muted;
  const canComment = !!me.email && (isTeacher || (!muted && commentsOpen));
  const comments = post.comments || [];

  const submit = async () => {
    const text = draft.trim();
    if (!text) return;
    setSending(true);
    const ok = await onAction(
      { action: 'post_comment', class_id: classData.id, announcement_id: post.id, body: text },
    );
    if (ok) setDraft('');
    setSending(false);
  };

  return (
    <div className="mt-4 border-t border-border pt-4">
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
          <MessageSquare className="h-4 w-4 text-primary" />
          {comments.length > 0 ? `${comments.length} class comment${comments.length > 1 ? 's' : ''}` : 'Class comments'}
        </div>
        {!isTeacher && !commentsOpen && (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <MessageSquareOff className="h-3.5 w-3.5" /> Comments are off for this post
          </span>
        )}
      </div>

      {/* Privacy distinction — always visible where comments happen */}
      <div className="mt-2 flex items-start gap-2 rounded-lg bg-secondary px-3 py-2 text-xs text-muted-foreground">
        <Eye className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
        <p>
          <span className="font-medium text-foreground">Class-visible:</span> everyone in {classData.name} — students and teachers — can read these comments. Don't post anything here meant only for your teacher.
        </p>
      </div>

      {muted && !isTeacher && (
        <div className="mt-2 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-foreground">
          <MicOff className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-warning" />
          <p>You've been muted from commenting in this class. You can still read everything — speak to your teacher about regaining access.</p>
        </div>
      )}

      {comments.length > 0 && (
        <div className="mt-3 space-y-3">
          {comments.map(c => (
            <div key={c.id} className="flex items-start gap-3 group">
              <InitialsAvatar name={c.author_name} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{c.author_name}</span>
                  {(c.author_role === 'teacher' || c.author_role === 'admin') && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Teacher</Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {c.created_date ? format(new Date(c.created_date), 'PPp') : ''}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-foreground/90 whitespace-pre-wrap break-words">{c.body}</p>
              </div>
              {isTeacher && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {c.author_role === 'student' && (
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7" disabled={busy}
                      onClick={() => onAction(
                        { action: 'mute_student', class_id: classData.id, student_email: c.author_email },
                        'Student muted from class comments',
                      )}
                      title={`Mute ${c.author_name} from commenting`}
                    >
                      <MicOff className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button
                    variant="ghost" size="icon" className="h-7 w-7" disabled={busy}
                    onClick={() => onAction(
                      { action: 'delete_comment', comment_id: c.id },
                      'Comment deleted',
                    )}
                    title="Delete comment"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {canComment ? (
        <div className="mt-3 flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder={isTeacher ? 'Reply to the class…' : 'Add a class comment…'}
            rows={1}
            className="min-h-9 resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
            }}
          />
          <Button size="icon" onClick={submit} disabled={sending || busy || !draft.trim()} aria-label="Post comment">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      ) : !isTeacher && !muted && !commentsOpen && (
        <p className="mt-3 text-xs text-muted-foreground">The teacher has turned comments off{post.allow_comments === false ? ' for this post' : ' for this class'}.</p>
      )}
    </div>
  );
}