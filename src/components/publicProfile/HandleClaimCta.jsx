import React, { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AtSign, Check, Loader2, ShieldCheck, X } from 'lucide-react';

const HANDLE_RE = /^[a-z0-9_]{3,20}$/;

/**
 * HandleClaimCta — the visitor conversion block on public profiles.
 *
 * Instead of a generic "Sign up" button, a signed-out visitor claims their own
 * URL right here: live availability checking against the same endpoint the
 * in-app claim card uses, then the chosen handle is carried into signup
 * (stashed in sessionStorage) and pre-filled into the Profile page's claim
 * card once their account exists. Signed-in viewers never see this block —
 * they get Follow and the endorse actions instead.
 */
export default function HandleClaimCta() {
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

  const claim = () => {
    const h = handleInput.trim().toLowerCase();
    if (availability.state !== 'ok' || !h) return;
    try { sessionStorage.setItem('blockward_claim_handle', h); } catch { /* ignore */ }
    window.location.href = `${createPageUrl('Signup')}?claim_handle=${encodeURIComponent(h)}`;
  };

  return (
    <div className="mt-14 rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 via-card/60 to-brand-pink/10 p-6 sm:p-10">
      <div className="max-w-2xl mx-auto text-center">
        <div className="mx-auto h-12 w-12 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center mb-4">
          <ShieldCheck className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-xl sm:text-3xl font-bold text-foreground">Keep your achievements forever.</h2>
        <p className="text-sm sm:text-base text-muted-foreground mt-3 leading-relaxed">
          Every award, belt, grade and win — verified by the people who were there, permanently recorded, and owned by
          you, not your school. When you graduate and your school email is switched off, your record is still yours.
        </p>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); claim(); }} className="mt-6 max-w-md mx-auto flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium pointer-events-none">
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
        <Button type="submit" disabled={availability.state !== 'ok'}>
          Claim @{handleInput || 'yourname'}
        </Button>
      </form>
      {availability.reason && (
        <p className="text-xs text-destructive mt-2 text-center max-w-md mx-auto">{availability.reason}</p>
      )}
      <p className="text-[11px] text-tertiary mt-3 flex items-center gap-1 justify-center">
        <AtSign className="h-3 w-3" /> Yours forever — change it once every 30 days.
      </p>
    </div>
  );
}