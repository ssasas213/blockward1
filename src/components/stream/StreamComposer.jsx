import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Paperclip, Send, Loader2, X, CalendarClock } from 'lucide-react';
import { toast } from 'sonner';

const fileKind = (mime = '') => {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime === 'application/pdf') return 'pdf';
  if (mime.includes('word') || mime.includes('document') || mime.includes('presentation')) return 'document';
  return 'other';
};

// Teacher composer for Stream posts. Posts go through the existing
// createAnnouncement function (scope CLASS) — the Stream renders the
// Announcement entity, not a parallel store.
export default function StreamComposer({ classId, classData, onPosted }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState('normal');
  const [comments, setComments] = useState('inherit'); // inherit | on | off
  const [schedule, setSchedule] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);

  const pickFiles = async (e) => {
    const chosen = Array.from(e.target.files || []);
    if (!chosen.length) return;
    setUploading(true);
    try {
      for (const f of chosen.slice(0, 5 - files.length)) {
        const res = await base44.integrations.Core.UploadFile({ file: f });
        setFiles(prev => [...prev, { name: f.name, url: res.file_url, file_type: fileKind(f.type) }]);
      }
    } catch {
      toast.error('Could not upload that file');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const post = async () => {
    if (!title.trim() || !body.trim()) { toast.error('Add a title and a message'); return; }
    if (schedule && !scheduledAt) { toast.error('Pick a date and time to schedule'); return; }
    setPosting(true);
    try {
      const status = schedule ? 'scheduled' : 'sent';
      const payload = {
        title: title.trim(),
        body: body.trim(),
        body_short: body.trim().slice(0, 200),
        priority,
        scope_type: 'CLASS',
        class_id: classId,
        class_name: classData.name,
        student_emails: classData.student_emails || [],
        status,
        school_id: classData.school_id,
        attachments: files,
        allow_comments: comments === 'inherit' ? undefined : comments === 'on',
        scheduled_at: schedule ? new Date(scheduledAt).toISOString() : undefined,
      };
      const res = await base44.functions.invoke('createAnnouncement', payload);
      const data = res.data || res;
      if (data?.error) throw new Error(data.error);
      const created = data.announcement;
      // Mirror the Announcements page: dispatch notifications for
      // urgent/important posts, reminders for scheduled ones.
      if (status === 'sent' && (priority === 'urgent' || priority === 'important')) {
        base44.functions.invoke('dispatchAnnouncementNotifications', {
          announcement_id: created.id,
          type: priority === 'urgent' ? 'announcement_urgent' : 'announcement_important',
        }).catch(() => {});
      }
      if (status === 'scheduled') {
        base44.functions.invoke('dispatchAnnouncementNotifications', {
          announcement_id: created.id,
          type: 'announcement_scheduled_reminder',
        }).catch(() => {});
      }
      toast.success(schedule ? 'Post scheduled' : 'Posted to the Stream');
      onPosted();
    } catch (e) {
      toast.error(e?.message || 'Could not post');
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div>
        <Label htmlFor="stream-title">Title</Label>
        <Input
          id="stream-title"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="e.g. Field trip permission forms"
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor="stream-body">Message</Label>
        <Textarea
          id="stream-body"
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Share it with the class…"
          rows={4}
          className="mt-1.5"
        />
      </div>

      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((f, i) => (
            <Badge key={f.url} variant="secondary" className="gap-1.5 py-1.5 pr-1.5">
              <Paperclip className="h-3 w-3" />
              <span className="max-w-[180px] truncate">{f.name}</span>
              <button
                onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                className="ml-1 rounded-full hover:bg-hover p-0.5"
                aria-label={`Remove ${f.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <Label>Priority</Label>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="important">Important</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Comments on this post</Label>
          <Select value={comments} onValueChange={setComments}>
            <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="inherit">Follow class setting</SelectItem>
              <SelectItem value="on">On</SelectItem>
              <SelectItem value="off">Off</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Schedule</Label>
          <div className="flex items-center gap-2 mt-1.5">
            <Button
              type="button"
              size="sm"
              variant={schedule ? 'default' : 'outline'}
              onClick={() => setSchedule(s => !s)}
            >
              <CalendarClock className="h-4 w-4 mr-1.5" />
              {schedule ? 'Scheduled' : 'Post now'}
            </Button>
            {schedule && (
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={e => setScheduledAt(e.target.value)}
                className="h-8"
              />
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <label className="cursor-pointer text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
          <input type="file" multiple className="hidden" onChange={pickFiles} accept="*/*" />
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
          {uploading ? 'Uploading…' : 'Attach files'}
        </label>
        <Button onClick={post} disabled={posting || uploading}>
          {posting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Send className="h-4 w-4 mr-1.5" />}
          {schedule ? 'Schedule' : 'Post'}
        </Button>
      </div>
    </div>
  );
}