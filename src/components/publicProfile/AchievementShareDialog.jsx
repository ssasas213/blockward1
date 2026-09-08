import React, { useEffect, useState } from 'react';
import { Copy, Check, Download, Loader2, QrCode } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

/**
 * AchievementShareDialog — share options for a single verified achievement:
 * copy the permanent verification link, a QR code for the /verify page, and
 * the server-rendered 1080x1080 share card (issuing org, date, signer chain,
 * verify QR) as a downloadable PNG.
 */
export default function AchievementShareDialog({ open, onOpenChange, achievement }) {
  const [copied, setCopied] = useState(false);
  const [qrSvg, setQrSvg] = useState(null);
  const [cardBusy, setCardBusy] = useState(false);

  const url = achievement?.verification_id
    ? `${window.location.origin}/verify/${achievement.verification_id}`
    : achievement?.public_verification_url || '';

  useEffect(() => {
    if (!open || !url || qrSvg) return;
    base44.functions.invoke('generateQr', { data: url, size: 480 })
      .then((res) => { if (res.data?.ok) setQrSvg(res.data.svg); })
      .catch(() => {});
  }, [open, url]);

  if (!achievement || !url) return null;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Verification link copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy the link');
    }
  };

  const downloadCard = async () => {
    setCardBusy(true);
    try {
      const res = await base44.functions.invoke('generateProfileCard', {
        variant: 'achievement',
        verification_id: achievement.verification_id,
      });
      const cardUrl = res.data?.url;
      if (!cardUrl) throw new Error(res.data?.error);
      const blob = await (await fetch(cardUrl)).blob();
      const link = document.createElement('a');
      link.download = `blockward-${achievement.verification_id}.png`;
      link.href = URL.createObjectURL(blob);
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 5000);
      toast.success('Share card downloaded');
    } catch (e) {
      toast.error('Could not generate the card');
    } finally {
      setCardBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share this achievement</DialogTitle>
          <DialogDescription>
            Anyone with the link can check this credential — no account needed.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5">
            <span className="flex-1 truncate text-sm font-mono text-muted-foreground">{url}</span>
            <Button size="sm" variant="outline" onClick={copyLink}>
              {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>

          <div className="flex gap-3 rounded-lg border border-border bg-background p-3">
            <div className="w-24 h-24 flex-shrink-0 flex items-center justify-center rounded-xl bg-white p-2 border border-border">
              {qrSvg ? (
                <div className="w-full [&_svg]:w-full [&_svg]:h-auto" dangerouslySetInnerHTML={{ __html: qrSvg }} />
              ) : (
                <QrCode className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 flex flex-col justify-center">
              <p className="text-sm font-medium text-foreground">QR code</p>
              <p className="text-xs text-muted-foreground mt-0.5">Scans straight to the permanent verification page.</p>
            </div>
          </div>

          <Button className="w-full" variant="outline" onClick={downloadCard} disabled={cardBusy}>
            {cardBusy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
            Download share card
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            A 1080×1080 image with the issuing organisation, date and verification chain.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}