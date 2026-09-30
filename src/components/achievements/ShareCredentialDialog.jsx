import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Link as LinkIcon, Copy, QrCode, ExternalLink, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

/** Share a verified credential: copy verification link, QR code, open public page. */
export default function ShareCredentialDialog({ open, onOpenChange, credential }) {
  const [qrUrl, setQrUrl] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const c = credential || {};
  const url = c.bw_id ? `${window.location.origin}/verify/${c.bw_id}` : '';

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(url); toast.success('Verification link copied'); }
    catch { toast.error('Could not copy'); }
  };

  const loadQr = async () => {
    if (qrUrl || qrLoading) return;
    setQrLoading(true);
    try {
      const res = await base44.functions.invoke('generateQr', { text: url });
      const u = res.data?.url || res.data?.qr_url || res.data?.data_url;
      if (u) setQrUrl(u); else toast.error('Could not generate QR');
    } catch { toast.error('Could not generate QR'); }
    finally { setQrLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share credential</DialogTitle>
          <DialogDescription>Anyone with the verification link can confirm this credential's authenticity — no Blockward account needed.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Input readOnly value={url} className="text-xs" />
            <Button size="icon" variant="outline" onClick={copyLink} aria-label="Copy link"><Copy className="h-4 w-4" /></Button>
          </div>
          <Button variant="outline" className="w-full justify-start" onClick={loadQr} disabled={qrLoading || !!qrUrl}>
            {qrLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <QrCode className="h-4 w-4 mr-2" />}
            {qrUrl ? 'QR code ready' : 'Generate QR code'}
          </Button>
          {qrUrl && (
            <div className="flex justify-center rounded-lg border border-border bg-white p-3">
              <img src={qrUrl} alt="Verification QR code" className="h-40 w-40" />
            </div>
          )}
          <Button asChild className="w-full">
            <a href={url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" /> Open public verification page
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}