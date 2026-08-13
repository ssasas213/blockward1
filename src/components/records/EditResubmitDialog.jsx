import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, RefreshCw, Upload, AlertTriangle } from 'lucide-react';

const CATEGORIES = ['academic', 'sports', 'arts', 'leadership', 'community', 'behaviour', 'special'];

export default function EditResubmitDialog({ open, onOpenChange, record, onDone }) {
  const [form, setForm] = useState({});
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && record) {
      setForm({
        title: record.title || '',
        description: record.description || '',
        category: record.category || 'academic',
        points: record.points || 0,
        date_achieved: record.date_achieved || '',
        teacher_notes: record.teacher_notes || '',
        file_url: record.file_url || '',
      });
    }
  }, [open, record]);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await base44.integrations.Core.UploadFile({ file });
      set('file_url', res.file_url);
      toast.success('Evidence uploaded');
    } catch (err) {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.title?.trim()) { toast.error('Title is required'); return; }
    setSubmitting(true);
    try {
      const res = await base44.functions.invoke('recordWorkflow', {
        action: 'resubmitAfterChanges',
        recordId: record.id,
        updatedFields: {
          title: form.title,
          description: form.description,
          category: form.category,
          points: Number(form.points) || 0,
          date_achieved: form.date_achieved || null,
          teacher_notes: form.teacher_notes,
          file_url: form.file_url,
        },
      });
      if (!res.data?.ok) throw new Error(res.data?.error || 'Resubmit failed');
      toast.success(res.data.teacherReSignRequired
        ? 'Resubmitted — teacher re-signature required'
        : 'Resubmitted — sent back to admin for approval');
      onOpenChange(false);
      onDone?.();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit &amp; Resubmit Achievement</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2 max-h-[60vh] overflow-y-auto">
          {record?.changes_requested_reason && (
            <div className="rounded-lg p-3 bg-accent/5 border border-accent/20">
              <p className="text-xs font-medium text-accent mb-1">Admin Feedback</p>
              <p className="text-sm text-foreground">{record.changes_requested_reason}</p>
              {record.changes_requested_by_name && (
                <p className="text-xs text-muted-foreground mt-1">— {record.changes_requested_by_name}</p>
              )}
            </div>
          )}
          <p className="text-xs text-warning bg-warning/5 rounded-lg p-2 border border-warning/20 flex items-start gap-2">
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
            <span>Editing the title, description, category, points, date, or evidence will invalidate the teacher's previous signature and require them to sign again.</span>
          </p>
          <div>
            <Label>Title</Label>
            <Input value={form.title || ''} onChange={e => set('title', e.target.value)} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={form.description || ''} onChange={e => set('description', e.target.value)} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Category</Label>
              <select
                className="w-full h-9 rounded-lg border border-border bg-secondary/50 px-3 text-sm text-foreground"
                value={form.category || 'academic'}
                onChange={e => set('category', e.target.value)}
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <Label>Points</Label>
              <Input type="number" value={form.points || 0} onChange={e => set('points', e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Date Achieved</Label>
            <Input type="date" value={form.date_achieved || ''} onChange={e => set('date_achieved', e.target.value)} />
          </div>
          <div>
            <Label>Teacher Notes (for admin)</Label>
            <Textarea value={form.teacher_notes || ''} onChange={e => set('teacher_notes', e.target.value)} rows={2} />
          </div>
          <div>
            <Label>Evidence</Label>
            {form.file_url && (
              <p className="text-xs text-muted-foreground mb-1">
                Current: <a href={form.file_url} target="_blank" rel="noreferrer" className="text-primary underline">view file</a>
              </p>
            )}
            <Input type="file" onChange={handleUpload} disabled={uploading} />
            {uploading && <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Uploading…</p>}
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Resubmit
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}