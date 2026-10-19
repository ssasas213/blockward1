import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

// Reuses the Achievement entity's category enum — never invented values.
export const CATEGORY_OPTIONS = [
  { value: 'certification', label: 'Certification' },
  { value: 'competition', label: 'Competition' },
  { value: 'academic', label: 'Academic' },
  { value: 'award', label: 'Award' },
  { value: 'course', label: 'Course' },
  { value: 'training', label: 'Training' },
  { value: 'professional', label: 'Professional' },
  { value: 'challenge', label: 'Challenge' },
  { value: 'other', label: 'Other' },
];

export default function StepDetails({ draft, setDraft }) {
  const set = (k) => (v) => setDraft((d) => ({ ...d, [k]: v }));
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Achievement title *</Label>
        <Input
          value={draft.title}
          onChange={(e) => set('title')(e.target.value)}
          placeholder="e.g. U16 Football Tournament Winner"
          maxLength={200}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Category</Label>
          <Select value={draft.category || 'other'} onValueChange={set('category')}>
            <SelectTrigger><SelectValue placeholder="Pick a category" /></SelectTrigger>
            <SelectContent>
              {CATEGORY_OPTIONS.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Original achievement date *</Label>
          <Input
            type="date"
            max={today}
            value={draft.date_achieved}
            onChange={(e) => set('date_achieved')(e.target.value)}
          />
          <p className="text-[11px] text-tertiary">When you actually earned it — even if that was years ago.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Awarding organisation</Label>
          <Input
            value={draft.issuer_org}
            onChange={(e) => set('issuer_org')(e.target.value)}
            placeholder="e.g. Dubai Youth Football League"
            maxLength={200}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Country</Label>
          <Input
            value={draft.country}
            onChange={(e) => set('country')(e.target.value)}
            placeholder="e.g. United Arab Emirates"
            maxLength={80}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Description</Label>
        <Textarea
          value={draft.description}
          onChange={(e) => set('description')(e.target.value)}
          placeholder="What the achievement was, who awarded it, and anything an issuer would recognise"
          rows={3}
          maxLength={2000}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Certificate / reference number (optional)</Label>
        <Input
          value={draft.external_credential_id}
          onChange={(e) => set('external_credential_id')(e.target.value)}
          placeholder="Printed on the certificate, if any"
          maxLength={100}
        />
      </div>
    </div>
  );
}