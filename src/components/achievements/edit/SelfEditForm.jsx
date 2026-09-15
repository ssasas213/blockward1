import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import CoverImagePicker from '@/components/achievements/CoverImagePicker';

/**
 * SelfEditForm — editing an unverified self-reported achievement. Nothing
 * has been attested, so everything is freely editable: title, description,
 * date, organisation label and cover image.
 */
export default function SelfEditForm({ item, busy, onSubmit }) {
  const [title, setTitle] = useState(item.title || '');
  const [description, setDescription] = useState(item.description || '');
  const [dateAchieved, setDateAchieved] = useState(item.date_achieved || '');
  const [orgName, setOrgName] = useState(item.organisation_name || '');
  const [imageUrl, setImageUrl] = useState(item.image_url || '');

  const underReview = item.status === 'verification_requested';

  const dirty =
    (title.trim() || '') !== (item.title || '')
    || (description || '') !== (item.description || '')
    || (dateAchieved || '') !== (item.date_achieved || '')
    || (orgName || '') !== (item.organisation_name || '')
    || (imageUrl || '') !== (item.image_url || '');

  const submit = () => {
    const edits = {};
    if ((title.trim() || '') !== (item.title || '')) edits.title = title.trim();
    if ((description || '') !== (item.description || '')) edits.description = description.trim() || null;
    if ((dateAchieved || '') !== (item.date_achieved || '')) edits.date_achieved = dateAchieved || null;
    if ((orgName || '') !== (item.organisation_name || '')) edits.organisation_name = orgName.trim() || null;
    if ((imageUrl || '') !== (item.image_url || '')) edits.image_url = imageUrl || null;
    onSubmit({
      action: 'edit_self_reported',
      self_id: item.id,
      edits,
      confirm_invalidate: true,
    });
  };

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="self-title">Title</Label>
        <Input id="self-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What the achievement is" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="self-description">Description</Label>
        <Textarea id="self-description" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What you did, in your words" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="self-date">Date achieved</Label>
          <Input id="self-date" type="date" value={dateAchieved} onChange={(e) => setDateAchieved(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="self-org">Organisation (optional)</Label>
          <Input id="self-org" value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="e.g. Gracie Barra Dubai" />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Cover image</Label>
        <CoverImagePicker imageUrl={imageUrl} onChange={setImageUrl} />
      </div>

      {underReview && (
        <p className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground leading-relaxed">
          This one is being verified right now. If you change the title, description or date, the request goes
          back to your verifier for a fresh review — your cover image changes never disturb them.
        </p>
      )}

      <Button className="w-full" onClick={submit} disabled={!busy && !dirty ? true : busy || !dirty}>
        Save changes
      </Button>
    </div>
  );
}