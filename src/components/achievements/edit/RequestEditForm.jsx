import React, { useState } from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import CoverImagePicker from '@/components/achievements/CoverImagePicker';
import { CATEGORY_LABELS } from '@/lib/credentialEdits';

/**
 * RequestEditForm — editing an achievement request that is already in review.
 * Presentation details (the cover image) save straight away. Verified details
 * (title, description, date, category) sit behind a warning: editing them
 * invalidates any signature already collected and sends the request back for
 * a fresh review — the student confirms first, the server enforces it anyway.
 */
export default function RequestEditForm({ request, busy, onSubmit }) {
  const [imageUrl, setImageUrl] = useState(request.image_url || '');
  const [title, setTitle] = useState(request.title || '');
  const [description, setDescription] = useState(request.description || '');
  const [dateAchieved, setDateAchieved] = useState(request.date_achieved || '');
  const [category, setCategory] = useState(request.category || 'academic');
  const [confirm, setConfirm] = useState(false);

  const verifierName = request.nominated_verifier_name
    || request.independent_verifier?.name
    || 'your verifier';

  const attestedDirty =
    (title.trim() || '') !== (request.title || '')
    || (description || '') !== (request.description || '')
    || (dateAchieved || '') !== (request.date_achieved || '')
    || category !== (request.category || 'academic');
  const coverDirty = (imageUrl || '') !== (request.image_url || '');
  const canSave = !busy && (attestedDirty || coverDirty) && (!attestedDirty || confirm);

  const submit = () => {
    const edits = {};
    if (coverDirty) edits.image_url = imageUrl || null;
    if (attestedDirty) Object.assign(edits, {
      title: title.trim(),
      description: description.trim() || null,
      date_achieved: dateAchieved || null,
      category,
    });
    onSubmit({
      action: 'edit_request',
      request_id: request.id,
      edits,
      confirm_invalidate: attestedDirty ? true : undefined,
    });
  };

  return (
    <div className="space-y-5">
      {/* Presentation — free to change, never disturbs the review */}
      <div className="space-y-2">
        <Label>Cover image</Label>
        <CoverImagePicker imageUrl={imageUrl} onChange={setImageUrl} />
        <p className="text-xs text-tertiary">Your cover image isn't part of what {verifierName} verifies — change it any time.</p>
      </div>

      {/* Attested details */}
      <div className="space-y-4 rounded-xl border border-border bg-background/40 p-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold text-foreground">Verified details</p>
        </div>

        {attestedDirty && (
          <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 space-y-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
              <p className="text-xs text-foreground leading-relaxed">
                You've changed details {verifierName} was already reviewing. Saving will{' '}
                <strong>clear their review and send this back for a fresh one</strong> — any signature already
                collected stops counting, and any verification link they hold stops working.
              </p>
            </div>
            <label className="flex items-start gap-2.5 text-xs text-foreground cursor-pointer">
              <Checkbox checked={confirm} onCheckedChange={(v) => setConfirm(v === true)} className="mt-0.5" />
              I understand — reset the review and notify {verifierName}
            </label>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="edit-title">Title</Label>
          <Input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What the achievement is" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-description">Description</Label>
          <Textarea id="edit-description" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What you did, in your words" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="edit-date">Date achieved</Label>
            <Input id="edit-date" type="date" value={dateAchieved} onChange={(e) => setDateAchieved(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Button className="w-full" onClick={submit} disabled={!canSave}>
        {attestedDirty ? 'Save & send for re-review' : 'Save changes'}
      </Button>
    </div>
  );
}