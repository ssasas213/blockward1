import React, { useEffect, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { Download, Linkedin, MessageCircle, Copy, Check, Loader2, Instagram, Share2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import ShareCard, { CARD_TEMPLATES, CARD_FORMATS } from './ShareCardPreview';
import { cn } from '@/lib/utils';

/**
 * ShareCardDialog — the BlockTalks share-card studio (Phase 1).
 * Four professional templates × three platform formats, live preview,
 * one-click PNG download and direct LinkedIn / X / WhatsApp sharing.
 *
 * GATED: callers may only open this for a genuinely Blockward Verified
 * credential (issuer-authority + signatures + on-chain integrity confirmed —
 * the dashboard only sets share targets for cards whose status is 'verified'
 * with a real BW- credential id). Pending / self-reported achievements never
 * reach this dialog, so they can never carry a Verified badge.
 */
export default function ShareCardDialog({ open, onOpenChange, item, holderName }) {
  const [template, setTemplate] = useState('professional');
  const [format, setFormat] = useState('linkedin');
  const [showName, setShowName] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const captureRef = useRef(null);

  const verificationId = item?.verification_id || null;
  const url = verificationId ? `${window.location.origin}/verify/${verificationId}` : '';
  const data = {
    title: item?.title || '',
    org: item?.org || '',
    date: item?.date || null,
    verifiedAt: item?.verified_at || null,
    cover: item?.banner || item?.cover || null,
    holderName: showName ? (holderName || '') : '',
    showName,
  };

  // QR — one fetch per open, rendered as a data-URI image so html2canvas can capture it.
  useEffect(() => {
    if (!open || !url || qrDataUrl) return;
    base44.functions.invoke('generateQr', { data: url, size: 480 })
      .then((res) => {
        if (res.data?.ok && res.data.svg) {
          const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(res.data.svg)));
          setQrDataUrl(`data:image/svg+xml;base64,${b64}`);
        }
      })
      .catch(() => {});
  }, [open, url]);

  useEffect(() => { if (!open) { setQrDataUrl(null); setCopied(false); } }, [open]);

  if (!verificationId) return null;
  const fmt = CARD_FORMATS.find((x) => x.id === format) || CARD_FORMATS[0];

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); toast.success('Verification link copied'); setTimeout(() => setCopied(false), 2000); }
    catch { toast.error('Could not copy'); }
  };

  const shareText = showName && holderName
    ? `${holderName} earned a new Blockward Verified achievement: “${data.title}”${data.org ? `, verified by ${data.org}` : ''}. Independently checkable:`
    : `A new Blockward Verified achievement: “${data.title}”${data.org ? `, verified by ${data.org}` : ''}. Independently checkable:`;

  const downloadPng = async () => {
    if (!captureRef.current) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(captureRef.current, { scale: 1, width: fmt.w, height: fmt.h, useCORS: true, backgroundColor: null });
      const link = document.createElement('a');
      link.download = `blockward-verified-${template}-${format}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast.success('Share card downloaded');
    } catch {
      toast.error('Could not render the card');
    } finally {
      setDownloading(false);
    }
  };

  // Instagram has no web share intent — offer the native share sheet with the
  // rendered PNG when the browser supports it, otherwise download the card.
  const shareToInstagram = async () => {
    if (!captureRef.current) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(captureRef.current, { scale: 1, width: fmt.w, height: fmt.h, useCORS: true, backgroundColor: null });
      const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
      const file = blob ? new File([blob], 'blockward-verified.png', { type: 'image/png' }) : null;
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Blockward Verified', text: shareText });
      } else {
        const link = document.createElement('a');
        link.download = `blockward-verified-${template}-${format}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        toast.success('Card downloaded — post it to Instagram');
      }
    } catch { toast.error('Could not prepare the card'); }
    finally { setDownloading(false); }
  };

  const previewScale = Math.min(1, 328 / fmt.w);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Share to BlockTalks</DialogTitle>
          <DialogDescription>
            Where achievements start conversations. Pick a professional card and platform — the card carries a QR code straight to the permanent verification page.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 md:grid-cols-[auto,1fr]">
          {/* Preview */}
          <div>
            <div
              className="overflow-hidden rounded-xl border border-border bg-card"
              style={{ width: fmt.w * previewScale, height: fmt.h * previewScale }}
            >
              <div style={{ transform: `scale(${previewScale})`, transformOrigin: 'top left' }}>
                <ShareCard template={template} format={format} data={data} qrDataUrl={qrDataUrl} />
              </div>
            </div>

            {/* Full-size hidden node for pixel-perfect capture */}
            <div style={{ position: 'fixed', left: -20000, top: 0, pointerEvents: 'none' }} aria-hidden="true">
              <ShareCard template={template} format={format} data={data} qrDataUrl={qrDataUrl} innerRef={captureRef} />
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-4 min-w-0">
            <div>
              <Label className="text-xs text-tertiary uppercase tracking-wide">Template</Label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {CARD_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTemplate(t.id)}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-left transition-colors',
                      template === t.id ? 'border-primary bg-primary/10' : 'border-border bg-card hover:bg-hover',
                    )}
                  >
                    <span className="block text-sm font-medium text-foreground">{t.name}</span>
                    <span className="block text-xs text-tertiary truncate">{t.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs text-tertiary uppercase tracking-wide">Format</Label>
              <div className="mt-2 flex gap-2">
                {CARD_FORMATS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFormat(f.id)}
                    className={cn(
                      'flex-1 rounded-lg border px-2 py-2 text-center transition-colors',
                      format === f.id ? 'border-primary bg-primary/10' : 'border-border bg-card hover:bg-hover',
                    )}
                  >
                    <span className="block text-xs font-medium text-foreground">{f.name}</span>
                    <span className="block text-[12px] text-tertiary">{f.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-foreground">Show my name</p>
                <p className="text-xs text-tertiary">Off — the card shows the achievement only.</p>
              </div>
              <Switch checked={showName} onCheckedChange={setShowName} aria-label="Show my name on the share card" />
            </div>

            <div>
              <Label className="text-xs text-tertiary uppercase tracking-wide">Share</Label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button variant="outline" className="justify-start" asChild disabled={!url}>
                  <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer">
                    <Linkedin className="h-4 w-4" /> LinkedIn
                  </a>
                </Button>
                <Button variant="outline" className="justify-start" asChild disabled={!url}>
                  <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer">
                    <Share2 className="h-4 w-4" /> X
                  </a>
                </Button>
                <Button variant="outline" className="justify-start" asChild disabled={!url}>
                  <a href={`https://wa.me/?text=${encodeURIComponent(`${shareText} ${url}`)}`} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                  </a>
                </Button>
                <Button variant="outline" className="justify-start" onClick={shareToInstagram} disabled={downloading}>
                  {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Instagram className="h-4 w-4" />} Instagram
                </Button>
                <Button variant="outline" className="justify-start" onClick={copyLink} disabled={!url}>
                  {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />} Copy link
                </Button>
                <Button variant="outline" className="justify-start" onClick={downloadPng} disabled={downloading}>
                  {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download card
                </Button>
              </div>
              <p className="mt-2 text-xs text-tertiary">
                Instagram posts as an image — the card is prepared and opened in your share sheet.
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}