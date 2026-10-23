import React from 'react';
import { MoreVertical, ShieldAlert } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import DefaultBannerCover from './banner/DefaultBannerCover';
import { fmtDate } from './AchievementCard';
import { CategoryChip } from './unified/CategoryVisual';
import { cn } from '@/lib/utils';

/**
 * PortfolioCard — the premium dashboard achievement card: 16:9 banner (the
 * holder's optional cover, or a category-based default), title, issuing
 * organisation and date beneath, a simple status line, personal category
 * chips, and a discreet kebab menu for personalisation actions. Verification
 * status is honest: only achievements whose independent integrity checks
 * passed read "Blockward Verified".
 */

const TONE = {
  green: { dot: 'bg-success', text: 'text-success' },
  amber: { dot: 'bg-warning', text: 'text-warning' },
  red: { dot: 'bg-destructive', text: 'text-destructive' },
  grey: { dot: 'bg-muted-foreground/40', text: 'text-muted-foreground' },
};

export function resolveCardStatus(item) {
  if (item.integrity === 'failed') return { label: 'Verification failed', tone: 'red' };
  if (item.status === 'verified' || item.status === 'independent') return { label: 'Blockward Verified', tone: 'green' };
  if (item.status === 'revoked') return { label: 'Revoked', tone: 'red' };
  if (item.status === 'pending') return { label: 'Pending verification', tone: 'amber' };
  if (item.status === 'unverified') return { label: 'Self-reported', tone: 'grey' };
  return { label: 'Unverified', tone: 'grey' };
}

export default function PortfolioCard({ it, banner, categories = [], featured = false, menuActions = [], onOpen, onGetVerified, onEdit, className = '' }) {
  const card = it.card;
  const st = resolveCardStatus(card);
  const tone = TONE[st.tone] || TONE.grey;
  const hasMenu = menuActions.length > 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen?.(it)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen?.(it); } }}
      className={cn(
        'card-hover group relative flex w-full cursor-pointer flex-col overflow-hidden rounded-xl border border-border bg-card text-left',
        card.status === 'unverified' && 'border-dashed',
        className,
      )}
    >
      {/* Banner — 16:9, always the same ratio */}
      <div className="relative aspect-video w-full overflow-hidden bg-secondary">
        {banner ? (
          <img src={banner} alt={card.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" />
        ) : (
          <DefaultBannerCover categories={categories} fallback={card.category} />
        )}

        {featured && (
          <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-amber-300 backdrop-blur-sm">
            ★ Featured
          </span>
        )}

        {/* Discreet kebab — personalisation actions */}
        {hasMenu && (
          <span
            className="absolute right-2 top-2 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 max-sm:opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button" aria-label="Achievement actions"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-black/50 text-white backdrop-blur-sm transition-colors hover:bg-black/70"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {menuActions.map((a, i) => (
                  <React.Fragment key={a.label}>
                    {i > 0 && a.group !== menuActions[i - 1].group && <DropdownMenuSeparator />}
                    <DropdownMenuItem
                      onClick={() => a.onSelect?.()}
                      className={a.danger ? 'text-destructive focus:text-destructive' : ''}
                    >
                      {a.Icon && <a.Icon className="h-4 w-4 mr-2" />} {a.label}
                    </DropdownMenuItem>
                  </React.Fragment>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </span>
        )}

        {card.integrity === 'failed' && (
          <span className="absolute bottom-2 left-2.5 inline-flex items-center gap-1 rounded-full border border-destructive/50 bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-red-300">
            <ShieldAlert className="h-2.5 w-2.5" /> Integrity check failed
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
        <h3 className="line-clamp-1 text-sm font-semibold text-foreground">{card.title}</h3>
        <p className="truncate text-xs text-muted-foreground">
          {[card.org, fmtDate(card.date)].filter(Boolean).join(' · ') || '—'}
        </p>
        <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', tone.text)}>
          <span className={cn('h-1.5 w-1.5 rounded-full', tone.dot)} /> {st.label}
        </span>
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {categories.slice(0, 2).map((c) => <CategoryChip key={c.id} cat={c} className="px-1.5 py-0 text-[11px]" />)}
            {categories.length > 2 && <span className="text-[11px] text-tertiary self-center">+{categories.length - 2}</span>}
          </div>
        )}
        {card.status === 'unverified' && (onGetVerified || onEdit) && (
          <div className="mt-auto flex gap-1.5 pt-1.5">
            {onGetVerified && (
              <button
                onClick={(e) => { e.stopPropagation(); onGetVerified(card); }}
                className="flex-1 rounded-lg border border-border bg-secondary/70 px-2 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary"
              >
                Get this verified
              </button>
            )}
            {onEdit && (
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(card); }}
                className="rounded-lg border border-border bg-secondary/70 px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary"
              >
                Edit
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Compact list row for the list view. */
export function PortfolioRow({ it, banner, featured = false, menuActions = [], onOpen }) {
  const card = it.card;
  const st = resolveCardStatus(card);
  const tone = TONE[st.tone] || TONE.grey;
  return (
    <div className="group relative flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:bg-hover/50">
      <button onClick={() => onOpen?.(it)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <div className="h-10 w-[72px] flex-shrink-0 overflow-hidden rounded-md bg-secondary" style={{ aspectRatio: '16/9' }}>
          {banner ? (
            <img src={banner} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <DefaultBannerCover categories={[]} fallback={card.category} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {card.title} {featured && <span className="text-amber-500">★</span>}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {[card.org, fmtDate(card.date)].filter(Boolean).join(' · ')}
          </p>
        </div>
      </button>
      {card.integrity === 'failed' && <ShieldAlert className="h-3.5 w-3.5 text-destructive flex-shrink-0" aria-label="Integrity check failed" />}
      <span className={cn('inline-flex flex-shrink-0 items-center gap-1.5 text-xs font-medium', tone.text)}>
        <span className={cn('h-1.5 w-1.5 rounded-full', tone.dot)} /> {st.label}
      </span>
      {menuActions.length > 0 && (
        <span onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label="Achievement actions" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-hover hover:text-foreground flex-shrink-0">
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {menuActions.map((a, i) => (
                <React.Fragment key={a.label}>
                  {i > 0 && a.group !== menuActions[i - 1].group && <DropdownMenuSeparator />}
                  <DropdownMenuItem onClick={() => a.onSelect?.()} className={a.danger ? 'text-destructive focus:text-destructive' : ''}>
                    {a.Icon && <a.Icon className="h-4 w-4 mr-2" />} {a.label}
                  </DropdownMenuItem>
                </React.Fragment>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
      )}
    </div>
  );
}