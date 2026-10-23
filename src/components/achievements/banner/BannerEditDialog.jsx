import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import BannerPicker from './BannerPicker';
import { setBanner } from '@/lib/achievementMeta';

/**
 * BannerEditDialog — add / replace / remove the decorative cover image of an
 * EXISTING achievement (including already Blockward Verified ones). Writes
 * owner-controlled presentation metadata (AchievementMeta.banner_url) only:
 * the credential, its evidence, the BW-HASH-V1 commitment, the Merkle proof
 * and the Polygon transaction are never touched.
 */
export default function BannerEditDialog({ open, onOpenChange, ownerEmail, achievementRef, initialUrl, onSaved }) {
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!open) setBusy(false); }, [open]);

  const persist = async (url) => {
    if (busy) return;
    setBusy(true);
    try {
      await setBanner(ownerEmail, achievementRef, url);
      toast.success(url ? 'Cover image updated' : 'Cover image removed');
      onSaved?.(url);
      onOpenChange(false);
    } catch (e) {
      toast.error(e?.response?.data?.error || e?.message || 'Could not save the cover image');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit cover image</DialogTitle>
          <DialogDescription>
            A decorative cover for your portfolio. It is not evidence, and it never affects
            verification, your credential or its blockchain record.
          </DialogDescription>
        </DialogHeader>
        <BannerPicker
          value={open ? (initialUrl || null) : null}
          onChange={persist}
          compact
        />
        {busy && <p className="text-xs text-muted-foreground">Saving…</p>}
      </DialogContent>
    </Dialog>
  );
}