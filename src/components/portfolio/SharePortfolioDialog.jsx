import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Copy, Check, Share2, Globe } from 'lucide-react';
import { toast } from 'sonner';

export default function SharePortfolioDialog({ open, onOpenChange, studentId }) {
  const [copied, setCopied] = useState(false);
  const shareUrl = studentId ? `${window.location.origin}/portfolio/${studentId}` : '';

  useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('Portfolio link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy the link');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-primary" /> Share your portfolio
          </DialogTitle>
          <DialogDescription>
            Anyone with this link can view your verified BlockWard achievements — no login required.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-3">
            <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm text-foreground truncate flex-1 font-mono">{shareUrl || '—'}</span>
          </div>
          <Button onClick={copy} className="w-full" disabled={!shareUrl}>
            {copied ? <><Check className="h-4 w-4 mr-2" /> Copied</> : <><Copy className="h-4 w-4 mr-2" /> Copy link</>}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Only achievements marked as public appear on your shared portfolio.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}