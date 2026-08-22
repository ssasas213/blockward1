import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const TYPES = [
  { value: "homework", label: "Homework" },
  { value: "assignment", label: "Assignment" },
  { value: "revision", label: "Revision Task" },
  { value: "coursework", label: "Coursework" },
  { value: "project", label: "Project" },
];

export default function CreateAssignmentDialog({ open, onClose, classes, onCreated }) {
  const [form, setForm] = useState({ class_id: '', title: '', assessment_type: 'homework', max_score: 100, date: new Date().toISOString().slice(0, 10), due_date: '', description: '', attachment_url: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(f => ({ ...f, class_id: classes?.[0]?.id || '', title: '', assessment_type: 'homework', max_score: 100, date: new Date().toISOString().slice(0, 10), due_date: '', description: '', attachment_url: '' }));
    }
  }, [open, classes]);

  const handleSave = async () => {
    if (!form.class_id || !form.title.trim()) { toast.error('Class and title are required'); return; }
    setSaving(true);
    try {
      const cls = classes.find(c => c.id === form.class_id);
      const res = await base44.functions.invoke('gradebookAction', {
        action: 'create_assessment',
        class_id: form.class_id,
        title: form.title.trim(),
        assessment_type: form.assessment_type,
        max_score: Number(form.max_score) || 100,
        date: form.date,
        due_date: form.due_date || null,
        attachment_url: form.attachment_url.trim() || null,
        description: form.description.trim() || null,
        class_name: cls?.name,
        subject: cls?.subject,
      });
      if (res.data?.ok) { toast.success('Assignment created'); onCreated?.(); onClose(); }
      else toast.error(res.data?.message || 'Failed to create assignment');
    } catch (e) { toast.error(e.message || 'Failed to create assignment'); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Create Assignment</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Class *</Label>
            <select value={form.class_id} onChange={e => setForm(f => ({ ...f, class_id: e.target.value }))} className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 text-sm text-foreground focus:ring-2 focus:ring-primary">
              <option value="">Select a class…</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name} · {c.subject}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Title *</Label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Algebra Homework — Chapter 5" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <select value={form.assessment_type} onChange={e => setForm(f => ({ ...f, assessment_type: e.target.value }))} className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 text-sm text-foreground focus:ring-2 focus:ring-primary">
                {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Max Score</Label>
              <Input type="number" value={form.max_score} onChange={e => setForm(f => ({ ...f, max_score: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Assigned Date</Label>
              <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Instructions</Label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} placeholder="Instructions for students…" className="w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}