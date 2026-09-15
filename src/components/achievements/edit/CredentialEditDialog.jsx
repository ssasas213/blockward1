import React, { useState } from 'react';
import { PenLine } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import RequestEditForm from '@/components/achievements/edit/RequestEditForm';
import SelfEditForm from '@/components/achievements/edit/SelfEditForm';
import VerifiedEditForm from '@/components/achievements/edit/VerifiedEditForm';
import { credentialEdit } from '@/lib/credentialEdits';

/**
 * CredentialEditDialog — the state-aware achievement editor.
 * What it offers depends entirely on the credential's state (the server
 * enforces every rule regardless):
 *   request (pending)  → presentation free; attested details behind a
 *                        clear warning that editing resets the review
 *   self (unverified)  → full edit — nothing has been attested
 *   verified           → presentation inline; attested details locked with
 *                        an explanation and a "Request a correction" action
 */
export default function CredentialEditDialog({ target, open, onOpenChange, onDone }) {
  const [busy, setBusy] = useState(false);

  if (!target) return null;

  const submit = async (payload) => {
    setBusy(true);
    try {
      const res = await credentialEdit(payload);
      if (!res?.ok) throw new Error(res?.error || 'Could not save your changes');
      toast.success(
        payload.action === 'request_correction'
          ? 'Correction requested — your verifier will review it'
          : payload.action === 'edit_request' && res.invalidated
            ? 'Saved — sent back for a fresh review'
            : 'Saved'
      );
      onOpenChange(false);
      onDone?.();
      return res;
    } catch (e) {
      toast.error(e?.response?.data?.error || e.message);
      return null;
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLine className="h-4 w-4 text-primary" />
            {target.kind === 'verified' ? 'Edit credential' : 'Edit achievement'}
          </DialogTitle>
          <DialogDescription>
            {target.kind === 'request' &&
              'Your cover image saves straight away. Verified details go back to your reviewer.'}
            {target.kind === 'self' &&
              'Nothing here has been verified yet — edit anything freely.'}
            {target.kind === 'verified' &&
              'Your cover image, visibility and notes are yours to change. Verified details are locked.'}
          </DialogDescription>
        </DialogHeader>
        {target.kind === 'request' && <RequestEditForm request={target.data} busy={busy} onSubmit={submit} />}
        {target.kind === 'self' && <SelfEditForm item={target.data} busy={busy} onSubmit={submit} />}
        {target.kind === 'verified' && <VerifiedEditForm verificationId={target.data.verification_id} busy={busy} onSubmit={submit} />}
      </DialogContent>
    </Dialog>
  );
}