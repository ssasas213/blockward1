import React, { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AtSign, Check, Loader2, ShieldCheck, X } from 'lucide-react';

const HANDLE_RE = /^[a-z0-9_]{3,20}$/;
const DISMISS_KEY = 'bw_claim_cta_dismissed';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function readDismissed(anonId) {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    // The dismissal is stored against the visitor's bw_anon_id — a different
    // anon id (different device / cleared id) is a different visitor.
    if (anonId && d?.anon && d.anon !== anonId) return false;
    return Date.now() - (d?.at || 0) < THIRTY_DAYS_MS;
  } catch { return false; }
}

/**
 * ClaimBanner — the dismissible visitor-conversion prompt on public profiles.
 * Signed-out visitors only (never the owner or signed-in users, who get
 * Follow and the endorse actions instead). Two variants:
 *  - bar (profile has achievements): quiet and secondary — a slim closable
 *    bar pinned to the bottom of the viewport on mobile, a compact card
 *    after the content on desktop. Never blocks scrolling.
 *  - hero (empty profile): the claim card is the main content.
 * The inline handle claim checks availability live (same endpoint as the
 * in-app card) and carries the chosen handle into signup.
 */
export default function ClaimBanner({ anonId, hasAchievements = false }) {
  const [dismissed, setDismissed] = useState(() => readDismissed(anonId));
  const [handleInput, setHandleInput] = useState('');
  const [availability, setAvailability] = useState({ state: 'idle', reason: null });
  const timer = useRef(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // Live availability — debounced 500ms, same check as the in-app claim card.
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

  const close = () => {
    try { localStorage.setItem(DISMISS_KEY, JSON.stringify({ anon: anonId || null, at: Date.now() })); } catch { /* ignore */ }
    setDismissed(true);
  };

  const claim = () => {
    const h = handleInput.trim().toLowerCase();
    if (availability.state !== 'ok' || !h) return;
    try { sessionStorage.setItem('blockward_claim_handle', h); } catch { /* ignore */ }
    window.location.href = `${createPageUrl('Signup')}?claim_handle=${encodeURIComponent(h)}`;
  };

  if (dismissed) return null;

  const claimForm = (compact) => (
    <form onSubmit={(e) => { e.preventDefault(); claim(); }} className={`flex flex-col sm:flex-row gap-2 ${compact ? '' : 'mt-6 max-w-md mx-auto'}`}>
      <div className="relative flex-1">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium pointer-events-none whitespace-nowrap">
          blockward.me/@
        </span>
        <Input
          value={handleInput}
          onChange={(e) => setHandleInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
          maxLength={20}
          placeholder="yourname"
          className="pl-[9.5rem] pr-9 bg-background"
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
      <Button type="submit" disabled={availability.state !== 'ok'} size={compact ? 'sm' : 'default'}>
        Claim @{handleInput || 'yourname'}
      </Button>
    </form>
  );

  const claimReason = availability.reason && <p className="text-xs text-destructive mt-1.5">{availability.reason}</p>;

  // ── Empty profile — the claim card IS the content ──
  if (!hasAchievements) {
    return (
      <div className="relative mt-14 rounded-2xl border border-primary/25 bg-card p-6 sm:p-10">
        <button onClick={close} aria-label="Dismiss" className="absolute top-3 right-3 p-1.5 rounded-md text-muted-foreground hover:bg-hover hover:text-foreground transition-colors">
          <X className="h-4 w-4" />
        </button>
        <div className="max-w-2xl mx-auto text-center">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center mb-4">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-xl sm:text-3xl font-bold text-foreground">Keep your achievements forever.</h2>
          <p className="text-sm sm:text-base text-muted-foreground mt-3 leading-relaxed">
            Every award, belt, grade and win gets verified by the people who were there — and stays yours after you leave school.
          </p>
        </div>
        {claimForm(false)}
        {claimReason}
        <p className="text-[11px] text-tertiary mt-3 flex items-center gap-1 justify-center">
          <AtSign className="h-3 w-3" /> Yours forever — change it once every 30 days.
        </p>
      </div>
    );
  }

  // ── Profile with achievements — quiet, secondary, closable ──
  return (
    <>
      {/* Desktop — compact card after the content, in-flow */}
      <div className="hidden md:block relative mt-10 rounded-xl border border-border bg-card p-4">
        <button onClick={close} aria-label="Dismiss" className="absolute top-2.5 right-2.5 p-1.5 rounded-md text-muted-foreground hover:bg-hover hover:text-foreground transition-colors">
          <X className="h-4 w-4" />
        </button>
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Keep your achievements forever</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Every award, belt, grade and win gets verified by the people who were there — and stays yours after you leave school.
            </p>
          </div>
          <div className="lg:ml-auto lg:w-[400px]">
            {claimForm(true)}
            {claimReason}
          </div>
        </div>
      </div>

      {/* Mobile — slim closable bar pinned to the bottom of the viewport.
          It floats above content but never blocks scrolling and is one tap
          away from gone for 30 days. */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card shadow-lg px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <button onClick={close} aria-label="Dismiss" className="absolute top-2 right-2 p-1.5 rounded-md text-muted-foreground hover:bg-hover hover:text-foreground transition-colors">
          <X className="h-4 w-4" />
        </button>
        <div className="pr-8">
          <p className="text-xs font-semibold text-foreground">Keep your achievements forever</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Verified by the people who were there — and yours after you leave school.
          </p>
          {claimForm(true)}
          {claimReason}
        </div>
      </div>
    </>
  );
}