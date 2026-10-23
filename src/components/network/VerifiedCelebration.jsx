import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { Linkedin, MessageCircle, Share2, Copy, Check, PartyPopper, ExternalLink, MessagesSquare, X } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

/**
 * VerifiedCelebration — shown ONCE per achievement, the first time it appears
 * as Blockward Verified (the dashboard gates this: only cards with status
 * 'verified' AND a real issuer-verified credential celebrate — pending and
 * self-reported achievements never see this screen). The moment is
 * celebration-first: confetti, the verified card preview, and one-tap
 * sharing. Nothing is ever posted anywhere without an explicit user click.
 */
export default function VerifiedCelebration({ item, onDismiss, onOpenStudio }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!item) return;
    confetti({
      particleCount: 140,
      spread: 85,
      origin: { y: 0.6 },
      colors: ['#2563EB', '#60A5FA', '#10B981', '#F59E0B'],
      disableForReducedMotion: true,
    });
  }, [item?.verification_id]);

  if (!item) return null;
  const url = `${window.location.origin}/verify/${item.verification_id}`;
  const shareText = `I earned a new Blockward Verified achievement: “${item.title}”${item.org ? `, verified by ${item.org}` : ''}. Independently checkable on Polygon:`;

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); toast.success('Verification link copied'); setTimeout(() => setCopied(false), 2000); }
    catch { toast.error('Could not copy'); }
  };

  const platforms = [
    { key: 'linkedin', label: 'LinkedIn', Icon: Linkedin, href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}` },
    { key: 'x', label: 'X', Icon: Share2, href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}` },
    { key: 'whatsapp', label: 'WhatsApp', Icon: MessageCircle, href: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${url}`)}` },
  ];

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onDismiss(); }}>
      <DialogContent className="sm:max-w-md text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 border border-primary/30">
          <PartyPopper className="h-7 w-7 text-primary" />
        </div>
        <h2 className="page-title text-center">Your achievement is now Blockward Verified!</h2>
        <p className="page-subtitle text-center">
          Your achievement has been independently verified and secured on Polygon. Share your accomplishment with the world.
        </p>

        <div className="rounded-xl border border-success/30 bg-success/5 p-3 text-sm text-foreground">
          <span className="font-semibold">“{item.title}”</span>
          {item.org ? <span className="text-muted-foreground"> · verified by {item.org}</span> : null}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {platforms.map((p) => (
            <Button key={p.key} variant="outline" asChild className="h-11">
              <a href={p.href} target="_blank" rel="noopener noreferrer">
                <p.Icon className="h-4 w-4" /> <span className="text-sm">{p.label}</span>
              </a>
            </Button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={copyLink}>
            {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />} Copy link
          </Button>
          <Button onClick={() => onOpenStudio(item)}>
            <MessagesSquare className="h-4 w-4" /> Share to BlockTalks
          </Button>
        </div>

        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" asChild>
            <a href={url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5" /> View verification page
            </a>
          </Button>
          <button onClick={onDismiss} className="inline-flex items-center gap-1 text-xs text-tertiary hover:text-foreground">
            <X className="h-3.5 w-3.5" /> Maybe later
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}