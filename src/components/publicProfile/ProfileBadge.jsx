import React, { useState } from 'react';
import { BadgeCheck, ShieldCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';

/**
 * ProfileBadge — the EARNED profile verification badge (a trust signal about
 * the PERSON, distinct from credential verification).
 *
 *   tier 'member'   (blue) — active membership in a BlockWard-verified
 *                            organisation. Granted/revoked automatically.
 *   tier 'identity' (gold) — an admin of a verified organisation explicitly
 *                            confirmed this profile is a real enrolled student.
 *
 * tier 'none' renders NOTHING — an absent badge is the signal; a grey
 * "unverified" marker would devalue every other badge.
 *
 * Fixed-contrast colours (not theme tokens): the badge must look identical
 * and stay legible on the public profile's white identity scrim and on dark
 * app surfaces — #1D4ED8 / #B45309 both clear WCAG AA on white and dark.
 * Clicking opens a plain explanation of what the badge means and how it was
 * granted, so a visitor can judge its weight.
 */
export default function ProfileBadge({ tier, orgName, grantedAt, size = 'default' }) {
  const [open, setOpen] = useState(false);
  if (!tier || tier === 'none') return null;

  const identity = tier === 'identity';
  const color = identity ? '#B45309' : '#1D4ED8';
  const Icon = identity ? ShieldCheck : BadgeCheck;
  const label = identity ? 'Identity confirmed' : 'Confirmed member';
  const org = orgName || 'a verified organisation';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={identity ? `Identity confirmed by ${org}` : `Confirmed member of ${org}`}
        aria-label={identity ? `Identity confirmed by ${org}` : `Confirmed member of ${org}`}
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold transition-transform hover:scale-105 focus-visible:ring-2"
        style={{ color, border: `1px solid ${color}55`, background: `${color}14` }}
      >
        <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
        {label}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
                style={{ color, border: `1px solid ${color}55`, background: `${color}14` }}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            {identity ? (
              <>
                <p>
                  An administrator of <span className="font-medium text-foreground">{org}</span> — a real
                  organisation verified by BlockWard — has explicitly confirmed that this profile belongs to
                  a genuine enrolled student on their roster.
                  {grantedAt && <> Confirmed on {format(new Date(grantedAt), 'd MMMM yyyy')}.</>}
                </p>
                <p>
                  The confirmation is logged with who confirmed it and when. The badge is removed if the
                  organisation loses its BlockWard verification or revokes the confirmation.
                </p>
              </>
            ) : (
              <>
                <p>
                  This student holds an active membership in{' '}
                  <span className="font-medium text-foreground">{org}</span>, an organisation verified by
                  BlockWard.
                </p>
                <p>
                  The badge is granted automatically when the membership starts and removed automatically if
                  the membership ends or the organisation loses verification. It confirms affiliation, not
                  individual identity — look for the gold <span className="font-medium text-foreground">Identity confirmed</span> badge for that.
                </p>
              </>
            )}
            <p className="border-t border-border pt-3 text-xs text-tertiary">
              BlockWard badges are earned — never purchased and never self-declared.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}