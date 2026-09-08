import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Copy, Check, Printer } from 'lucide-react';
import { toast } from 'sonner';

/**
 * JoinCodeQRDialog — a scannable QR for a school join code, pointing at
 * /join/CODE. Sized for a projector or a printed handout, so a whole class can
 * join by scanning. Print opens a clean, full-page printable sheet.
 */
export default function JoinCodeQRDialog({ open, onOpenChange, code, school, roleLabel }) {
  const [copied, setCopied] = useState(false);
  if (!code) return null;

  const joinUrl = `${window.location.origin}/join/${code}`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=480x480&margin=16&data=${encodeURIComponent(joinUrl)}`;
  const schoolName = school?.name || 'your school';

  const copyLink = () => {
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    toast.success('Join link copied');
    setTimeout(() => setCopied(false), 2000);
  };

  const print = () => {
    const w = window.open('', '_blank', 'width=820,height=980');
    if (!w) { toast.error('Allow pop-ups to print the QR sheet'); return; }
    w.document.write(`<!DOCTYPE html>
<html><head><title>Join ${schoolName} on BlockWard</title>
<style>
  body { font-family: Inter, system-ui, sans-serif; display: flex; flex-direction: column;
         align-items: center; justify-content: center; height: 100vh; margin: 0; gap: 12px; }
  img { width: 420px; height: 420px; }
  h1 { font-size: 28px; margin: 0; }
  .code { font: 700 34px/1 monospace; letter-spacing: 5px; }
  p { color: #555; margin: 0; font-size: 15px; }
</style></head>
<body>
  <h1>Join ${schoolName} on BlockWard</h1>
  <img src="${qrSrc}" alt="Join QR code" onload="setTimeout(() => window.print(), 300)">
  <div class="code">${code}</div>
  <p>Scan with your phone camera${roleLabel ? ` to join as a ${roleLabel}` : ''}</p>
  <p>No phone? Sign up at ${joinUrl}</p>
</body></html>`);
    w.document.close();
    w.focus();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Join QR code</DialogTitle>
          <DialogDescription>
            Put this on the board — {roleLabel ? `${roleLabel}s` : 'students'} scan it with their phone camera and land straight in signup with the code filled in.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4">
          <div className="p-3 bg-white rounded-2xl border border-border">
            <img src={qrSrc} alt={`QR code for join code ${code}`} className="w-56 h-56" />
          </div>
          <code className="text-lg font-mono font-semibold tracking-wider text-foreground">{code}</code>
          <p className="text-xs text-muted-foreground text-center break-all">{joinUrl}</p>
          <div className="flex gap-2 w-full">
            <Button onClick={print} className="flex-1">
              <Printer className="h-4 w-4 mr-2" /> Print
            </Button>
            <Button variant="outline" onClick={copyLink} className="flex-1">
              {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              Copy link
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}