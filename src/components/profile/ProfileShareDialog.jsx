import React, { useEffect, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { Copy, Check, Download, Loader2, Share2, QrCode, Printer, Maximize2, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import ProfileCardImage from '@/components/profile/ProfileCardImage';

/**
 * ProfileShareDialog — share options for a public /@handle profile:
 * copy the link, download a square 1080x1080 summary image, and a QR code
 * (downloadable, printable, and viewable full-screen for sharing in person).
 * Works for signed-out visitors too.
 */
export default function ProfileShareDialog({ open, onOpenChange, profile }) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [qrSvg, setQrSvg] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const cardRef = useRef(null);

  const url = profile ? `${window.location.origin}/@${profile.handle}` : '';
  const qrDataUri = qrSvg ? `data:image/svg+xml;utf8,${encodeURIComponent(qrSvg)}` : null;

  // Fetch the QR once per handle (cached in state).
  useEffect(() => {
    if (!open || !profile?.handle || qrSvg) return;
    setQrLoading(true);
    base44.functions.invoke('generateQr', { data: `${window.location.origin}/@${profile.handle}`, size: 480 })
      .then((res) => {
        if (res.data?.ok) setQrSvg(res.data.svg);
        else throw new Error(res.data?.error);
      })
      .catch(() => toast.error('Could not generate the QR code'))
      .finally(() => setQrLoading(false));
  }, [open, profile?.handle]);

  if (!profile) return null;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Link copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy the link');
    }
  };

  const downloadImage = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        width: 1080, height: 1080, scale: 1, backgroundColor: null, logging: false,
      });
      const link = document.createElement('a');
      link.download = `blockward-${profile.handle}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast.success('Story image downloaded');
    } catch {
      toast.error('Could not generate the image');
    } finally {
      setDownloading(false);
    }
  };

  const downloadQr = () => {
    if (!qrSvg) return;
    try {
      const blob = new Blob([qrSvg], { type: 'image/svg+xml' });
      const link = document.createElement('a');
      link.download = `blockward-${profile.handle}-qr.svg`;
      link.href = URL.createObjectURL(blob);
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 5000);
      toast.success('QR code downloaded');
    } catch {
      toast.error('Could not download the QR');
    }
  };

  const printQr = () => {
    if (!qrDataUri) return;
    const w = window.open('', '_blank', 'width=620,height=760');
    if (!w) { toast.error('Allow pop-ups to print'); return; }
    w.document.write(`<!DOCTYPE html><html><head><title>BlockWard · @${profile.handle}</title>
      <style>
        body { font-family: Inter, system-ui, sans-serif; display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; margin:0; color:#0f172a; }
        img { width:340px; height:340px; }
        h1 { font-size:24px; margin:16px 0 4px; }
        p { color:#64748b; margin:0 0 24px; }
      </style></head><body>
      <img src="${qrDataUri}" alt="QR code for @${profile.handle}" />
      <h1>${profile.name || ''}</h1>
      <p>@${profile.handle} · verified achievements on BlockWard</p>
      <script>window.onload = () => { window.print(); };</script>
      </body></html>`);
    w.document.close();
  };

  const qrBox = (className) => (
    <div className={`flex items-center justify-center rounded-xl bg-white p-3 border border-border ${className}`}>
      {qrLoading ? (
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      ) : qrSvg ? (
        <div className="w-full [&_svg]:w-full [&_svg]:h-auto" dangerouslySetInnerHTML={{ __html: qrSvg }} />
      ) : (
        <QrCode className="h-8 w-8 text-muted-foreground" />
      )}
    </div>
  );

  return (
    <>
      <ProfileCardImage
        domRef={cardRef}
        data={{
          name: profile.name,
          handle: profile.handle,
          bio: profile.bio,
          avatarUrl: profile.avatar_url,
          schoolName: profile.schoolName,
          count: profile.count,
        }}
      />

      {/* Full-screen QR — for showing a phone/tablet to someone in person */}
      {fullscreen && (
        <div className="fixed inset-0 z-[60] bg-background flex flex-col">
          <div className="flex justify-end p-4">
            <Button variant="ghost" size="icon" onClick={() => setFullscreen(false)} aria-label="Close">
              <X className="h-5 w-5" />
            </Button>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center px-6 pb-16">
            <div className="max-w-xs w-full">
              {qrBox('shadow-xl mb-6')}
              <div className="text-center">
                <p className="text-xl font-bold text-foreground">{profile.name}</p>
                <p className="text-sm text-primary font-semibold">@{profile.handle}</p>
                <p className="text-xs text-muted-foreground mt-2 break-all">{url}</p>
              </div>
              <div className="flex gap-2 justify-center mt-6">
                <Button variant="outline" size="sm" onClick={downloadQr} disabled={!qrSvg}>
                  <Download className="h-4 w-4 mr-1.5" /> Download
                </Button>
                <Button variant="outline" size="sm" onClick={printQr} disabled={!qrSvg}>
                  <Printer className="h-4 w-4 mr-1.5" /> Print
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-4 w-4 text-primary" /> Share this profile
            </DialogTitle>
            <DialogDescription>
              Anyone with this link can view the verified profile — no account needed.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5">
              <span className="flex-1 truncate text-sm font-mono text-muted-foreground">{url}</span>
              <Button size="sm" variant="outline" onClick={copyLink}>
                {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>

            {/* QR — share in person at tournaments, fairs, open days */}
            <div className="flex gap-3 rounded-lg border border-border bg-background p-3">
              {qrBox('w-24 h-24 flex-shrink-0')}
              <div className="flex flex-col gap-1.5 min-w-0">
                <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <QrCode className="h-4 w-4 text-primary" /> QR code
                </p>
                <p className="text-xs text-muted-foreground">Scan to open the profile — print it or show it in person.</p>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  <Button size="sm" variant="outline" onClick={() => setFullscreen(true)} disabled={!qrSvg}>
                    <Maximize2 className="h-3.5 w-3.5 mr-1" /> Full screen
                  </Button>
                  <Button size="sm" variant="outline" onClick={downloadQr} disabled={!qrSvg}>
                    <Download className="h-3.5 w-3.5 mr-1" /> SVG
                  </Button>
                  <Button size="sm" variant="outline" onClick={printQr} disabled={!qrSvg}>
                    <Printer className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>

            <Button className="w-full" variant="outline" onClick={downloadImage} disabled={downloading}>
              {downloading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
              Download story image
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              A square image with the name, handle and verified count — perfect for stories.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}