import React, { useState, useEffect } from 'react';
import { AlertTriangle, ArrowLeft, History, Lock, Loader2, PenLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import CoverImagePicker from '@/components/achievements/CoverImagePicker';
import { CATEGORY_LABELS, getCredentialState } from '@/lib/credentialEdits';

const fmtDay = (iso) => iso
  ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  : null;

/**
 * VerifiedEditForm — editing a VERIFIED credential.
 *   Presentation (cover image, visibility, private notes): inline, free.
 *   Attested details: locked with an explanation of WHO verified them and
 *   WHEN — not a dead grey box. The only path is a correction request that
 *   the original verifier re-signs, producing a new transparent version.
 */
export default function VerifiedEditForm({ verificationId, busy, onSubmit }) {
  const [cred, setCred] = useState(null);
  const [failed, setFailed] = useState(false);
  const [mode, setMode] = useState('edit');

  // Presentation state
  const [imageUrl, setImageUrl] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [notes, setNotes] = useState('');

  // Correction-request state
  const [cTitle, setCTitle] = useState('');
  const [cDescription, setCDescription] = useState('');
  const [cDate, setCDate] = useState('');
  const [cCategory, setCCategory] = useState('special');
  const [cReason, setCReason] = useState('');

  useEffect(() => {
    let alive = true;
    setFailed(false);
    setCred(null);
    if (!verificationId) return;
    (async () => {
      try {
        const res = await getCredentialState(verificationId);
        if (!alive) return;
        if (!res?.ok) { setFailed(true); return; }
        const c = res.credential;
        setCred(c);
        setImageUrl(c.image_url || '');
        setVisibility(c.visibility || 'public');
        setNotes(c.private_notes || '');
        setCTitle(c.title || '');
        setCDescription(c.description || '');
        setCDate(c.date_achieved || '');
        setCCategory(c.category || 'special');
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => { alive = false; };
  }, [verificationId]);

  if (!cred) {
    return (
      <div className="py-10 flex flex-col items-center gap-3 text-sm text-muted-foreground">
        {failed ? 'Could not load this credential right now — try again shortly.'
          : <><Loader2 className="h-5 w-5 animate-spin" /> Loading…</>}
      </div>
    );
  }

  const correctionPending = cred.correction?.status === 'pending';
  const verifier = cred.verifier?.name || 'your verifier';
  const verifiedOn = fmtDay(cred.verifier?.signed_at);

  const presentationDirty =
    (imageUrl || '') !== (cred.image_url || '')
    || visibility !== (cred.visibility || 'public')
    || (notes || '') !== (cred.private_notes || '');

  const correctionDirty =
    (cTitle.trim() || '') !== (cred.title || '')
    || (cDescription || '') !== (cred.description || '')
    || (cDate || '') !== (cred.date_achieved || '')
    || cCategory !== (cred.category || 'special');

  const savePresentation = () => {
    const edits = {};
    if ((imageUrl || '') !== (cred.image_url || '')) edits.image_url = imageUrl || null;
    if (visibility !== (cred.visibility || 'public')) edits.visibility = visibility;
    if ((notes || '') !== (cred.private_notes || '')) edits.private_notes = notes;
    onSubmit({ action: 'edit_verified', verification_id: verificationId, edits });
  };

  const sendCorrection = () => {
    const corrections = {};
    if ((cTitle.trim() || '') !== (cred.title || '')) corrections.title = cTitle.trim();
    if ((cDescription || '') !== (cred.description || '')) corrections.description = cDescription.trim() || null;
    if ((cDate || '') !== (cred.date_achieved || '')) corrections.date_achieved = cDate || null;
    if (cCategory !== (cred.category || 'special')) corrections.category = cCategory;
    onSubmit({ action: 'request_correction', verification_id: verificationId, corrections, reason: cReason.trim() });
  };

  // ── Correction request mode ──
  if (mode === 'correction') {
    return (
      <div className="space-y-5">
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            {verifier} will review your correction. If they approve it, the corrected version is published as
            version {cred.version + 1} and re-signed — the original stays in the version history, visible on
            the public verification page. Corrections are transparent, never hidden.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cor-title">Corrected title</Label>
          <Input id="cor-title" value={cTitle} onChange={(e) => setCTitle(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cor-description">Corrected description</Label>
          <Textarea id="cor-description" rows={4} value={cDescription} onChange={(e) => setCDescription(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="cor-date">Corrected date</Label>
            <Input id="cor-date" type="date" value={cDate} onChange={(e) => setCDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={cCategory} onValueChange={setCCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cor-reason">What's wrong and why?</Label>
          <Textarea id="cor-reason" rows={3} value={cReason} onChange={(e) => setCReason(e.target.value)} placeholder="e.g. The date on the evidence is the competition final, not the qualifier" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setMode('edit')} disabled={busy}>
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
          </Button>
          <Button className="flex-1" onClick={sendCorrection} disabled={busy || !correctionDirty || !cReason.trim()}>
            <PenLine className="h-4 w-4 mr-1.5" /> Send correction request
          </Button>
        </div>
      </div>
    );
  }

  // ── Edit mode ──
  return (
    <div className="space-y-5">
      {correctionPending && (
        <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 flex items-start gap-2.5">
          <History className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
          <p className="text-xs text-foreground leading-relaxed">
            A correction on this credential is awaiting {verifier}'s review. Proposed change:{' '}
            <span className="italic">{cred.correction.reason}</span>
          </p>
        </div>
      )}
      {cred.correction?.status === 'declined' && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 flex items-start gap-2.5">
          <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
          <p className="text-xs text-foreground leading-relaxed">
            {verifier} declined your correction{cred.correction.declined_reason ? `: “${cred.correction.declined_reason}”` : ''}.
            The verified details stay as they are.
          </p>
        </div>
      )}

      {/* Presentation — freely editable, never attested */}
      <div className="space-y-4 rounded-xl border border-border bg-background/40 p-4">
        <div className="space-y-2">
          <Label>Cover image</Label>
          <CoverImagePicker imageUrl={imageUrl} onChange={setImageUrl} />
          <p className="text-xs text-tertiary">Your cover image isn't part of the verification — change it any time.</p>
        </div>
        <div className="space-y-1.5">
          <Label>Visibility on my public profile</Label>
          <Select value={visibility} onValueChange={setVisibility}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="public">Public — anyone viewing my profile</SelectItem>
              <SelectItem value="link_only">Link only — only with the share link</SelectItem>
              <SelectItem value="private">Private — hidden from my profile</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="v-notes">My private notes</Label>
          <Textarea id="v-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Only you ever see these — never shown publicly" />
        </div>
        <Button className="w-full" onClick={savePresentation} disabled={busy || !presentationDirty || correctionPending}>
          Save presentation changes
        </Button>
      </div>

      {/* Attested — locked, with the reason */}
      <div className="space-y-3 rounded-xl border border-border p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-tertiary" />
            <p className="text-sm font-semibold text-foreground">Verified details</p>
          </div>
          <span className="text-[10px] font-medium text-tertiary uppercase tracking-wide">Version {cred.version}</span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          This was verified by <strong>{verifier}</strong>{verifiedOn ? <> on <strong>{verifiedOn}</strong></> : ''},
          so it can't be edited directly — their signature covers exactly these details.
        </p>
        <div className="space-y-1.5">
          {[
            ['Title', cred.title],
            ['Description', cred.description],
            ['Date achieved', cred.date_achieved ? fmtDay(cred.date_achieved) : null],
            ['Category', CATEGORY_LABELS[cred.category] || cred.category],
          ].filter(([, v]) => v).map(([label, value]) => (
            <div key={label} className="flex items-start gap-3 rounded-lg bg-muted/40 border border-border px-3 py-2">
              <span className="text-[11px] font-medium text-tertiary uppercase tracking-wide w-28 flex-shrink-0 pt-0.5">{label}</span>
              <p className="text-sm text-foreground/90 break-words min-w-0">{String(value).length > 140 ? `${String(value).slice(0, 140)}…` : value}</p>
            </div>
          ))}
        </div>
        <Button variant="outline" className="w-full" onClick={() => setMode('correction')} disabled={busy || correctionPending}>
          <PenLine className="h-4 w-4 mr-1.5" /> Request a correction
        </Button>
      </div>
    </div>
  );
}