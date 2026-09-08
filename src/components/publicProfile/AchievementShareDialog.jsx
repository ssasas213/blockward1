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
 * the server-rendered share cards as downloadable PNGs — 9:16 for stories
 * and 1:1 for feeds (generateProfileCard, variant 'achievement').
 */
export default function AchievementShareDialog({ open, onOpenChange, achievement }) {
  const [copied, setCopied] = useState(false);
  const [qrSvg, setQrSvg] = useState(null);
  const [busyFormat, setBusyFormat] = useState(null);

  const verificationId = achievement?.verification_id || achievement?.verify_id || null;
  const url = verificationId
    ? `${window.location.origin}/verify/${verificationId}`
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

  const downloadCard = async (format) => {
    if (!verificationId) return;
    setBusyFormat(format);
    try {
      const res = await base44.functions.invoke('generateProfileCard', {
        variant: 'achievement',
        verification_id: verificationId,
        format, // 'story' (9:16) or 'square' (1:1)
      });
      const cardUrl = res.data?.url;
      if (!cardUrl) throw new Error(res.data?.error);
      const blob = await (await fetch(cardUrl)).blob();
      const link = document.createElement('a');
      link.download = `blockward-${verificationId}-${format}.png`;
      link.href = URL.createObjectURL(blob);
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 5000);
      toast.success(format === 'story' ? 'Story card downloaded' : 'Feed card downloaded');
    } catch (e) {
      toast.error('Could not generate the card');
    } finally {
      setBusyFormat(null);
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

          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={() => downloadCard('story')} disabled={!!busyFormat}>
              {busyFormat === 'story' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              Story 9:16
            </Button>
            <Button variant="outline" onClick={() => downloadCard('square')} disabled={!!busyFormat}>
              {busyFormat === 'square' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              Feed 1:1
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Share cards with the issuing organisation, date and verification chain — one for stories, one for feeds.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}