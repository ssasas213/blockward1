import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

const POST_TYPES = [
  { value: 'assignment', label: 'Assignment' },
  { value: 'quiz', label: 'Quiz' },
  { value: 'question', label: 'Question' },
  { value: 'material', label: 'Material' },
];

// ISO → value usable by <input type="datetime-local"> (local time)
const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  // sv-SE locale formats as "YYYY-MM-DD HH:mm:ss"
  return d.toLocaleString('sv-SE').slice(0, 16);
};

export default function PostFormDialog({ open, onClose, classId, topics, post, onSaved }) {
  const isEdit = !!post;
  const [form, setForm] = useState({
    title: '', type: 'assignment', instructions: '', points_possible: '',
    due_at: '', topic_id: '', allow_late: false, publishMode: 'now', scheduled_at: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (post) {
      setForm({
        title: post.title || '',
        type: post.type || 'assignment',
        instructions: post.instructions || '',
        points_possible: post.points_possible ?? '',
        due_at: toLocalInput(post.due_at),
        topic_id: post.topic_id || '',
        allow_late: !!post.allow_late,
        // editing a draft keeps it a draft unless the teacher changes mode
        publishMode: post.status === 'draft' ? 'draft' : 'now',
        scheduled_at: toLocalInput(post.scheduled_at),
      });
    } else {
      setForm({
        title: '', type: 'assignment', instructions: '', points_possible: '',
        due_at: '', topic_id: '', allow_late: false, publishMode: 'now', scheduled_at: '',
      });
    }
  }, [open, post]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    if (!form.title.trim()) {
      toast.error('A title is required');
      return;
    }
    if (form.publishMode === 'schedule' && !form.scheduled_at) {
      toast.error('Pick a date and time to schedule this post');
      return;
    }
    setSaving(true);
    try {
      const res = await base44.functions.invoke('classworkAction', {
        action: 'save_post',
        class_id: classId,
        id: post?.id || undefined,
        title: form.title,
        type: form.type,
        instructions: form.instructions,
        points_possible: form.points_possible === '' ? null : Number(form.points_possible),
        due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
        topic_id: form.topic_id || null,
        allow_late: form.allow_late,
        publish: form.publishMode,
        scheduled_at: form.publishMode === 'schedule' ? new Date(form.scheduled_at).toISOString() : null,
      });
      if (res.data?.ok) {
        toast.success(
          form.publishMode === 'now' ? 'Posted to the class' :
          form.publishMode === 'schedule' ? 'Post scheduled' : 'Draft saved'
        );
        onSaved?.();
        onClose();
      } else {
        toast.error(res.data?.error || 'Could not save this post');
      }
    } catch (e) {
      toast.error('Could not save this post');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit post' : 'New post'}</DialogTitle>
          <DialogDescription>
            {form.type === 'material'
              ? 'Reference material for the class — students can view it but not submit work.'
              : 'Students see this in their To do list and get notified when you assign it.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="post-title">Title</Label>
            <Input
              id="post-title"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder={form.type === 'material' ? 'e.g. Reading list — Term 1' : 'e.g. Chapter 4 exercises'}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => set('type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {POST_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="post-points">Points</Label>
              <Input
                id="post-points"
                type="number"
                min="0"
                value={form.points_possible}
                onChange={(e) => set('points_possible', e.target.value)}
                placeholder="Ungraded"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="post-instructions">Instructions</Label>
            <Textarea
              id="post-instructions"
              value={form.instructions}
              onChange={(e) => set('instructions', e.target.value)}
              placeholder="What should students do?"
              rows={5}
            />
          </div>

          {topics.length > 0 && (
            <div className="space-y-2">
              <Label>Topic</Label>
              <Select value={form.topic_id || 'none'} onValueChange={(v) => set('topic_id', v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No topic</SelectItem>
                  {topics.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {form.type !== 'material' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="post-due">Due date</Label>
                <Input
                  id="post-due"
                  type="datetime-local"
                  value={form.due_at}
                  onChange={(e) => set('due_at', e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="post-late">Allow late submissions</Label>
                  <p className="text-xs text-muted-foreground">Students can still turn in after the due date (marked late)</p>
                </div>
                <Switch
                  id="post-late"
                  checked={form.allow_late}
                  onCheckedChange={(v) => set('allow_late', v)}
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label>Publish</Label>
            <Select value={form.publishMode} onValueChange={(v) => set('publishMode', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="now">Assign now</SelectItem>
                <SelectItem value="draft">Save as draft</SelectItem>
                <SelectItem value="schedule">Schedule</SelectItem>
              </SelectContent>
            </Select>
            {form.publishMode === 'schedule' && (
              <Input
                type="datetime-local"
                value={form.scheduled_at}
                onChange={(e) => set('scheduled_at', e.target.value)}
              />
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? 'Saving…' : form.publishMode === 'now' ? 'Assign' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}