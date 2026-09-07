import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Plus, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { OPPORTUNITY_TYPES } from '@/lib/opportunities';
import { CATEGORY_LABELS } from '@/lib/achievementRequests';

const BLANK = {
  title: '', type: 'internship', category: 'special', description: '',
  location: '', is_remote: false, application_deadline: '', min_age: '',
  required_credentials: [], preferred_credentials: [], application_questions: [],
  status: 'open',
};

function RequirementList({ label, items, onChange }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {items.map((r, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            value={r.label}
            onChange={(e) => onChange(items.map((x, j) => j === i ? { ...x, label: e.target.value } : x))}
            placeholder="e.g. Regional 400m final win"
          />
          <Select
            value={r.category || ''}
            onValueChange={(v) => onChange(items.map((x, j) => j === i ? { ...x, category: v } : x))}
          >
            <SelectTrigger className="w-[150px] flex-shrink-0"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              {Object.entries(CATEGORY_LABELS).map(([value, l]) => (
                <SelectItem key={value} value={value}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" onClick={() => onChange(items.filter((_, j) => j !== i))}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button
        variant="outline" size="sm"
        onClick={() => onChange([...items, { label: '', category: '' }])}
      >
        <Plus className="h-3.5 w-3.5 mr-1.5" /> Add requirement
      </Button>
    </div>
  );
}

function QuestionList({ items, onChange }) {
  return (
    <div className="space-y-2">
      <Label>Application questions</Label>
      {items.map((q, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            value={q.question}
            onChange={(e) => onChange(items.map((x, j) => j === i ? { ...x, question: e.target.value } : x))}
            placeholder="e.g. Why do you want this role?"
          />
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground flex-shrink-0">
            <Switch
              checked={!!q.required}
              onCheckedChange={(v) => onChange(items.map((x, j) => j === i ? { ...x, required: v } : x))}
            />
            Required
          </label>
          <Button variant="ghost" size="icon" onClick={() => onChange(items.filter((_, j) => j !== i))}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button
        variant="outline" size="sm"
        onClick={() => onChange([...items, { question: '', required: false }])}
      >
        <Plus className="h-3.5 w-3.5 mr-1.5" /> Add question
      </Button>
    </div>
  );
}

/**
 * OpportunityForm — create/edit dialog for organisation admins. Requirements
 * and questions are dynamic lists; required credentials drive the match
 * indicator students see.
 */
export default function OpportunityForm({ open, onOpenChange, existing, onSaved }) {
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setError(null);
      setForm(existing ? {
        ...BLANK, ...existing,
        min_age: existing.min_age ?? '',
        application_deadline: existing.application_deadline || '',
        required_credentials: (existing.required_credentials || []).map((r) => ({ ...r })),
        preferred_credentials: (existing.preferred_credentials || []).map((r) => ({ ...r })),
        application_questions: (existing.application_questions || []).map((q) => ({ ...q })),
      } : BLANK);
    }
  }, [open, existing]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...form,
        min_age: form.min_age === '' || form.min_age === null ? null : Number(form.min_age),
      };
      const res = existing
        ? await base44.functions.invoke('opportunityAction', { action: 'update', opportunity_id: existing.id, changes: payload })
        : await base44.functions.invoke('opportunityAction', { action: 'create', opportunity: payload });
      if (!res.data?.ok) throw new Error(res.data?.error || 'Could not save the opportunity.');
      toast({ title: existing ? 'Opportunity updated' : 'Opportunity posted' });
      onSaved();
      onOpenChange(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? 'Edit opportunity' : 'Post an opportunity'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Summer robotics internship" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => set('type', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OPPORTUNITY_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => set('category', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABELS).map(([value, l]) => <SelectItem key={value} value={value}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={3} placeholder="What the opportunity involves, what the student will do…" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label>Location</Label>
              <Input value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="City / venue" />
            </div>
            <div className="space-y-1.5">
              <Label>Deadline</Label>
              <Input type="date" value={form.application_deadline || ''} onChange={(e) => set('application_deadline', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Min age</Label>
              <Input type="number" min="0" value={form.min_age ?? ''} onChange={(e) => set('min_age', e.target.value === '' ? '' : Number(e.target.value))} placeholder="Optional" />
            </div>
            <div className="flex items-end gap-2 pb-1.5">
              <Switch checked={form.is_remote} onCheckedChange={(v) => set('is_remote', v)} id="opp-remote" />
              <Label htmlFor="opp-remote">Remote</Label>
            </div>
          </div>

          <RequirementList
            label="Required credentials (drive the student match indicator)"
            items={form.required_credentials}
            onChange={(v) => set('required_credentials', v)}
          />
          <RequirementList
            label="Preferred credentials"
            items={form.preferred_credentials}
            onChange={(v) => set('preferred_credentials', v)}
          />
          <QuestionList items={form.application_questions} onChange={(v) => set('application_questions', v)} />

          <div className="flex items-center gap-2">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => set('status', v)}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
              </SelectContent>
            </Select>
            {form.status === 'draft' && <Badge variant="secondary">Hidden from the student feed</Badge>}
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? 'Saving…' : existing ? 'Save changes' : 'Post opportunity'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}