import React, { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { Copy, Check, Download, Loader2, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import ProfileCardImage from '@/components/profile/ProfileCardImage';

/**
 * ProfileShareDialog — share options for a public /@handle profile:
 * copy the link, and download a square 1080x1080 summary image for
 * Instagram/WhatsApp stories. Works for signed-out visitors too.
 */
export default function ProfileShareDialog({ open, onOpenChange, profile }) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const cardRef = useRef(null);

  if (!profile) return null;
  const url = `${window.location.origin}/@${profile.handle}`;

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