import React, { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  AtSign, Check, Copy, ExternalLink, Eye, Globe, Link2, Loader2, Share2, Sparkles, X,
} from 'lucide-react';
import ProfileShareDialog from '@/components/profile/ProfileShareDialog';

const HANDLE_RE = /^[a-z0-9_]{3,20}$/;

/**
 * PublicProfileLinkCard — the student's link-in-bio moment, at the top of the
 * Profile page. Claimed: shows the public URL large and copyable with
 * "View my profile" and "Share" actions. Unclaimed: an inline handle input
 * with live availability checking and a one-tap claim.
 */
export default function PublicProfileLinkCard({ profile, onSaved }) {
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [count, setCount] = useState(0);

  const [handleInput, setHandleInput] = useState('');
  const [availability, setAvailability] = useState({ state: 'idle', reason: null });
  const [claiming, setClaiming] = useState(false);
  const timer = useRef(null);

  const handle = profile?.handle;
  const name = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : '';

  // Verified-achievement count for the share card (owner-only endpoint).
  useEffect(() => {
    if (!handle) return;
    let active = true;
    base44.functions.invoke('updatePublicProfile', { get_my: true })
      .then((res) => { if (active) setCount(res.data?.achievements?.length || 0); })
      .catch(() => {});
    return () => { active = false; };
  }, [handle]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // Live handle availability — debounced, same check the settings panel uses.
  useEffect(() => {
    const h = handleInput.trim().toLowerCase();
    if (!h) { setAvailability({ state: 'idle', reason: null }); return; }
    if (!HANDLE_RE.test(h)) {
      setAvailability({ state: 'invalid', reason: '3–20 characters — lowercase letters, numbers and underscores' });
      return;
    }
    setAvailability({ state: 'checking', reason: null });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const res = await base44.functions.invoke('checkHandleAvailability', { handle: h });
        const d = res.data || {};
        setAvailability(d.available ? { state: 'ok', reason: null } : { state: 'taken', reason: d.reason || 'That handle is already taken' });
      } catch {
        setAvailability({ state: 'idle', reason: null });
      }
    }, 500);
  }, [handleInput]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`blockward.me/@${handle}`);
      setCopied(true);
      toast.success('Link copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy the link');
    }
  };

  const claim = async () => {
    const h = handleInput.trim().toLowerCase();
    setClaiming(true);
    try {
      const res = await base44.functions.invoke('updatePublicProfile', { handle: h });
      if (!res.data?.ok) throw new Error(res.data?.error || 'Could not claim that handle');
      toast.success(`Your profile link is blockward.me/@${h}`);
      if (onSaved) onSaved();
    } catch (e) {
      toast.error(e?.response?.data?.error || e.message);
    } finally {
      setClaiming(false);
    }
  };

  if (handle) {
    return (
      <>
        <Card className="border-primary/25 bg-gradient-to-br from-primary/10 via-card/60 to-brand-pink/10 backdrop-blur-md shadow-sm">
          <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center gap-5">
            <div className="flex items-center gap-4 min-w-0 flex-1">
              <div className="h-12 w-12 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center flex-shrink-0">
                <Globe className="h-6 w-6 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Your public profile</p>
                <div className="flex items-center gap-2 mt-1 min-w-0">
                  <p className="text-xl sm:text-2xl font-bold text-foreground truncate font-mono">blockward.me/@{handle}</p>
                  <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={copyLink} aria-label="Copy your profile link">
                    {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
                  </Button>
                  <span
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-background/60 px-2 py-0.5 text-xs text-muted-foreground flex-shrink-0"
                    title="Total public profile views"
                  >
                    <Eye className="h-3.5 w-3.5" /> {profile?.profile_views || 0}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {count} verified {count === 1 ? 'achievement' : 'achievements'} — share this link with universities, employers and friends.
                </p>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Button variant="outline" onClick={() => window.open(`${window.location.origin}/@${handle}`, '_blank')}>
                <ExternalLink className="h-4 w-4 mr-2" /> View my profile
              </Button>
              <Button onClick={() => setShareOpen(true)}>
                <Share2 className="h-4 w-4 mr-2" /> Share
              </Button>
            </div>
          </CardContent>
        </Card>
        <ProfileShareDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          profile={{ name, handle, bio: profile?.bio || null, avatar_url: profile?.avatar_url || null, count }}
        />
      </>
    );
  }

  return (
    <Card className="border-primary/25 bg-gradient-to-br from-primary/10 via-card/60 to-brand-pink/10 backdrop-blur-md shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center flex-shrink-0">
            <Link2 className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-foreground">Claim your profile link</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Your verified achievements get a permanent public page — this is the link you put in your Instagram bio and send to universities.
            </p>
            <div className="mt-4 flex flex-col sm:flex-row gap-2 max-w-md">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium pointer-events-none">
                  blockward.me/@
                </span>
                <Input
                  value={handleInput}
                  onChange={(e) => setHandleInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  maxLength={20}
                  placeholder="yourname"
                  className="pl-[9.5rem] pr-9"
                  aria-label="Choose your handle"
                />
                {handleInput && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2">
                    {availability.state === 'ok' && <Check className="h-4 w-4 text-success" />}
                    {availability.state === 'checking' && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    {['taken', 'invalid'].includes(availability.state) && <X className="h-4 w-4 text-destructive" />}
                  </span>
                )}
              </div>
              <Button onClick={claim} disabled={availability.state !== 'ok' || claiming}>
                {claiming ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Claim
              </Button>
            </div>
            {availability.reason && <p className="text-xs text-destructive mt-2">{availability.reason}</p>}
            <p className="text-[11px] text-tertiary mt-2 flex items-center gap-1">
              <AtSign className="h-3 w-3" /> Yours forever — you can change it once every 30 days.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}