import React from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

export const HISTORICAL_CATEGORIES = [
  { value: 'academic', label: 'Academic achievement' },
  { value: 'sports', label: 'Sports' },
  { value: 'volunteering', label: 'Volunteering' },
  { value: 'competition', label: 'Competitions' },
  { value: 'leadership', label: 'Leadership' },
  { value: 'certification', label: 'Certifications' },
  { value: 'extracurricular', label: 'Extracurricular activities' },
  { value: 'professional_development', label: 'Professional development' },
  { value: 'other', label: 'Other' },
];

export const CATEGORY_LABELS = Object.fromEntries(HISTORICAL_CATEGORIES.map((c) => [c.value, c.label]));

/** Step 1 — achievement details. The ORIGINAL date is captured here and never
 *  rewritten: verification and issuance dates are recorded separately later. */
export default function StepHDetails({ draft, setDraft }) {
  const set = (k) => (v) => setDraft((d) => ({ ...d, [k]: v }));
  const inputCls = 'bg-secondary/60 border-border text-foreground placeholder:text-tertiary';
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Achievement title *</Label>
        <Input className={inputCls} value={draft.title} onChange={(e) => set('title')(e.target.value)}
          placeholder="e.g. Regional Swimming Championship — Gold Medal" maxLength={140} />
      </div>
      <div className="space-y-1.5">
        <Label>Category *</Label>
        <Select value={draft.category} onValueChange={set('category')}>
          <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
          <SelectContent>
            {HISTORICAL_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Description</Label>
        <Textarea className={inputCls} rows={3} value={draft.description} onChange={(e) => set('description')(e.target.value)}
          placeholder="What was the achievement? Who awarded it, and in what context?" maxLength={2000} />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Original achievement date *</Label>
          <Input className={inputCls} type="date" max={new Date().toISOString().slice(0, 10)}
            value={draft.original_date} onChange={(e) => set('original_date')(e.target.value)} />
          <p className="text-xs text-tertiary">When it was actually earned — verification happens separately, later.</p>
        </div>
        <div className="space-y-1.5">
          <Label>Original issuing organisation *</Label>
          <Input className={inputCls} value={draft.issuing_org} onChange={(e) => set('issuing_org')(e.target.value)}
            placeholder="e.g. Emirates Swimming Federation" maxLength={140} />
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Country</Label>
          <Input className={inputCls} value={draft.country} onChange={(e) => set('country')(e.target.value)}
            placeholder="e.g. United Arab Emirates" maxLength={80} />
        </div>
        <div className="space-y-1.5">
          <Label>Certificate or award reference (optional)</Label>
          <Input className={inputCls} value={draft.certificate_ref} onChange={(e) => set('certificate_ref')(e.target.value)}
            placeholder="e.g. ESF-2023-0117" maxLength={120} />
        </div>
      </div>
    </div>
  );
}