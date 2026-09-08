import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { Loader2, Share2, PartyPopper } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

/**
 * CelebrationDialog — shown once per achievement the first time it appears
 * as Verified on this device (the student's My BlockWards page tracks which
 * ones have been celebrated). The highest-emotion second in the product:
 * the generated achievement card plus a one-tap share. Dismissible, never
 * repeated.
 */
export default function CelebrationDialog({ item, onDismiss, onShare }) {
  const [cardUrl, setCardUrl] = useState(null);

  useEffect(() => {
    if (!item?.verification_id) return;
    setCardUrl(null);
    confetti({
      particleCount: 130,
      spread: 80,
      origin: { y: 0.6 },
      colors: ['#8B5CF6', '#EC4899', '#10B981', '#F59E0B'],
      disableForReducedMotion: true,
    });
    let cancelled = false;
    base44.functions.invoke('generateProfileCard', { variant: 'achievement', verification_id: item.verification_id })
      .then((res) => { if (!cancelled && res.data?.url) setCardUrl(res.data.url); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [item?.verification_id]);

  if (!item) return null;

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onDismiss(); }}>
      <DialogContent className="sm:max-w-sm text-center">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-center gap-2 text-xl">
            <PartyPopper className="h-5 w-5 text-primary" /> It's verified!
          </DialogTitle>
          <DialogDescription>
            “{item.title}” is now permanently recorded. Share it while it's fresh — this is the moment people want to see.
          </DialogDescription>
        </DialogHeader>

        <div className="mx-auto aspect-square w-full max-w-[280px] overflow-hidden rounded-xl border border-border bg-muted/40 flex items-center justify-center">
          {cardUrl ? (
            <img src={cardUrl} alt="Your verified achievement card" className="h-full w-full object-cover" />
          ) : (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Button onClick={() => onShare(item)}>
            <Share2 className="h-4 w-4 mr-2" /> Share this achievement
          </Button>
          <Button variant="ghost" onClick={onDismiss}>Maybe later</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}