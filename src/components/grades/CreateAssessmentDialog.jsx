import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ASSESSMENT_TYPES, isAssignmentType } from '@/lib/grades';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function CreateAssessmentDialog({ open, onClose, classInfo, terms, teacherEmail, teacherName, onCreated, defaultAssessmentType }) {
  const initialType = defaultAssessmentType || 'test';
  const [form, setForm] = useState({ title: '', assessment_type: initialType, max_score: 100, date: new Date().toISOString().slice(0, 10), due_date: '', term_id: '', description: '', weighting: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(f => ({ ...f, title: '', assessment_type: initialType, max_score: 100, date: new Date().toISOString().slice(0, 10), due_date: '', term_id: '', description: '', weighting: '' }));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    if (!form.title.trim() || !form.max_score) { toast.error('Title and max score are required'); return; }
    setSaving(true);
    try {
      const term = terms.find(t => t.id === form.term_id);
      const res = await base44.functions.invoke('gradebookAction', {
        action: 'create_assessment',
        class_id: classInfo.id,
        title: form.title.trim(),
        assessment_type: form.assessment_type,
        max_score: Number(form.max_score),
        date: form.date,
        due_date: form.due_date || null,
        term_id: form.term_id || null,
        term_name: term?.name || null,
        description: form.description.trim() || null,
        weighting: form.weighting ? Number(form.weighting) : null,
      });
      if (res.data?.ok) {
        toast.success('Assessment created (draft)');
        onCreated?.(res.data.assessment);
        onClose();
      } else {
        toast.error(res.data?.message || 'Failed to create assessment');
      }
    } catch (e) { toast.error(e.message || 'Failed to create assessment'); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Assessment — {classInfo?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Assessment Title *</Label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Algebra Test 1" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type *</Label>
              <select value={form.assessment_type} onChange={e => setForm(f => ({ ...f, assessment_type: e.target.value }))} className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 text-sm text-foreground focus:ring-2 focus:ring-primary">
                {ASSESSMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Max Score *</Label>
              <Input type="number" value={form.max_score} onChange={e => setForm(f => ({ ...f, max_score: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Term</Label>
              <select value={form.term_id} onChange={e => setForm(f => ({ ...f, term_id: e.target.value }))} className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 text-sm text-foreground focus:ring-2 focus:ring-primary">
                <option value="">No term</option>
                {terms.map(t => <option key={t.id} value={t.id}>{t.name}{t.academic_year ? ` (${t.academic_year})` : ''}</option>)}
              </select>
            </div>
          </div>
          {isAssignmentType(form.assessment_type) && (
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
            </div>
          )}
          <div className="space-y-2">
            <Label>Weighting (optional)</Label>
            <Input type="number" value={form.weighting} onChange={e => setForm(f => ({ ...f, weighting: e.target.value }))} placeholder="e.g. 20 (weight in overall average)" />
          </div>
          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Topics covered, notes…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create as Draft'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}