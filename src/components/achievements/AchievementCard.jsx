import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, Trophy, Medal, Star, Sparkles, Heart, Users, Clock, Share2, ArrowRight } from 'lucide-react';
import InitialsAvatar from '@/components/ui/InitialsAvatar';
import GeneratedCover from '@/components/publicProfile/GeneratedCover';

/**
 * AchievementCard — THE one shared achievement card, used by My BlockWards
 * and the public profile so the two never drift.
 *
 * Anatomy: cover image fills the card (uploaded photo or deterministic
 * generated cover) with a bottom gradient scrim; title over the scrim in
 * large weight; issuing organisation logo + name and the date small at the
 * base; status badge top-right (Verified green, Pending amber, Unverified
 * grey outline); category chip in the category's colour; endorser avatars
 * stacked bottom-left; hover or long-press raises the card and reveals
 * Share / Endorse. Unverified cards use a dashed border and a visible
 * "Get this verified" action.
 */

export const CATEGORY_STYLE = {
  academic: { label: 'Academic', Icon: Medal, grad: 'linear-gradient(135deg, #8B5CF6, #6366F1)', chip: 'border-violet-400/40 bg-violet-400/15 text-violet-200' },
  sports: { label: 'Sports', Icon: Trophy, grad: 'linear-gradient(135deg, #10B981, #059669)', chip: 'border-emerald-400/40 bg-emerald-400/15 text-emerald-200' },
  arts: { label: 'Arts', Icon: Star, grad: 'linear-gradient(135deg, #EC4899, #F472B6)', chip: 'border-pink-400/40 bg-pink-400/15 text-pink-200' },
  leadership: { label: 'Leadership', Icon: Sparkles, grad: 'linear-gradient(135deg, #8B5CF6, #EC4899)', chip: 'border-fuchsia-400/40 bg-fuchsia-400/15 text-fuchsia-200' },
  community: { label: 'Community', Icon: Heart, grad: 'linear-gradient(135deg, #F59E0B, #F97316)', chip: 'border-amber-400/40 bg-amber-400/15 text-amber-200' },
  behaviour: { label: 'Behaviour', Icon: Users, grad: 'linear-gradient(135deg, #64748B, #475569)', chip: 'border-slate-400/40 bg-slate-400/15 text-slate-200' },
  special: { label: 'Special', Icon: BadgeCheck, grad: 'linear-gradient(135deg, #6366F1, #8B5CF6)', chip: 'border-indigo-400/40 bg-indigo-400/15 text-indigo-200' },
};

export const STATUS_BADGE = {
  verified: {
    label: 'Verified', Icon: BadgeCheck,
    card: 'border-transparent bg-success text-success-foreground',
    row: 'border-success/30 bg-success/10 text-success',
  },
  pending: {
    label: 'Pending', Icon: Clock,
    card: 'border-transparent bg-warning text-warning-foreground',
    row: 'border-warning/30 bg-warning/10 text-warning',
  },
  unverified: {
    label: 'Unverified', Icon: null,
    // Grey with an outline rather than a fill — the gap must be obvious.
    card: 'border-border bg-background/70 backdrop-blur-sm text-muted-foreground',
    row: 'border-border bg-muted text-muted-foreground',
  },
};

export const fmtDate = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
};

// Self-reported domains → achievement category (for the chip colour).
const SELF_CATEGORY = {
  academic: 'academic', sport: 'sports', martial_arts: 'sports', chess: 'sports',
  esports: 'sports', music: 'arts', community: 'community',
  professional: 'leadership', other: 'special',
};

/** From a vault achievement (getStudentVault / loadEarnedAchievements). */
export function cardFromVault(v) {
  return {
    id: v.record_id || v.id,
    status: 'verified',
    title: v.title,
    cover: v.image_url || null,
    category: v.category || 'special',
    org: v.organisation_name || null,
    orgLogo: v.organisation_logo || null,
    date: v.date_achieved || v.minted_at || null,
    verification_id: v.verify_id || null,
    raw: v,
  };
}

/** From a BlockWardVerificationRegistry record (public profile). */
export function cardFromRegistry(r) {
  return {
    id: r.registry_id || r.id,
    status: 'verified',
    title: r.title,
    cover: r.image_url || null,
    category: r.category || 'special',
    org: r.organisation_name || null,
    orgLogo: r.organisation_logo || null,
    date: r.date_delivered || r.date_approved || r.date_achieved || null,
    verification_id: r.verification_id || null,
    endorsers: r.endorsements || [],
    participant_role: r.participant_role || null,
    team_slug: r.team_slug || null,
    raw: r,
  };
}

/** From an AchievementRequest (pending). Archived/minted ones should not be shown. */
export function cardFromRequest(r) {
  return {
    id: r.id,
    status: 'pending',
    title: r.title,
    cover: r.image_url || null,
    category: r.category || 'special',
    org: r.school_name || r.credential_type_title || null,
    orgLogo: null,
    date: r.date_achieved || r.submitted_at || null,
    raw: r,
  };
}

/** From a SelfReportedAchievement. */
export function cardFromSelf(s) {
  return {
    id: s.id,
    status: s.status === 'verification_requested' ? 'pending' : 'unverified',
    title: s.title,
    cover: s.image_url || null,
    category: SELF_CATEGORY[s.domain] || 'special',
    org: s.organisation_name || null,
    orgLogo: null,
    date: s.date_achieved || null,
    description: s.description || null,
    raw: s,
  };
}

export default function AchievementCard({ item, onClick, onShare, onEndorse, canEndorse, onGetVerified, className = '' }) {
  const [pressed, setPressed] = useState(false);
  const pressTimer = useRef(null);
  const status = STATUS_BADGE[item.status] || STATUS_BADGE.verified;
  const cat = CATEGORY_STYLE[item.category] || CATEGORY_STYLE.special;
  const endorsers = (item.endorsers || []).slice(0, 4);
  const canShowActions = item.status === 'verified' && (onShare || (canEndorse && onEndorse));

  // Long-press on touch devices reveals the actions (hover equivalent).
  const onTouchStart = () => {
    pressTimer.current = setTimeout(() => setPressed(true), 450);
  };
  const clearPress = () => {
    clearTimeout(pressTimer.current);
    if (pressed) setTimeout(() => setPressed(false), 2600);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } }}
      onTouchStart={onTouchStart}
      onTouchEnd={clearPress}
      onTouchMove={clearPress}
      className={`card-hover group relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-card text-left cursor-pointer
        ${item.status === 'unverified' ? 'border-2 border-dashed border-border' : 'border border-border'} ${className}`}
    >
      {/* Cover — uploaded photo or deterministic generated cover */}
      <div className="absolute inset-0 transition-transform duration-200 group-hover:scale-[1.03]">
        {item.cover ? (
          <img src={item.cover} alt={item.title} className="h-full w-full object-cover" />
        ) : (
          <GeneratedCover
            bare
            compact
            title={item.title}
            category={item.category}
            orgName={item.org}
          />
        )}
      </div>
      {/* Scrim — same treatment for light and dark cover photos */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" aria-hidden="true" />

      {/* Status badge — top-right */}
      <span className={`absolute top-2.5 right-2.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${status.card}`}>
        {status.Icon && <status.Icon className="h-3 w-3" />}
        {status.label}
      </span>

      {/* Category chip — top-left, in the category's colour */}
      <span className={`absolute top-2.5 left-2.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cat.chip}`}>
        {cat.label}
      </span>

      {/* Hover / long-press actions */}
      {canShowActions && (
        <div className={`absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center gap-2 transition-opacity duration-200 ${pressed ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          {onShare && (
            <span
              role="button" tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onShare(item); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onShare(item); } }}
              className="inline-flex items-center gap-1.5 rounded-full bg-black/55 backdrop-blur-sm border border-white/25 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black/75 cursor-pointer"
            >
              <Share2 className="h-3.5 w-3.5" /> Share
            </span>
          )}
          {canEndorse && onEndorse && (
            <span
              role="button" tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onEndorse(item); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onEndorse(item); } }}
              className="inline-flex items-center gap-1.5 rounded-full bg-black/55 backdrop-blur-sm border border-white/25 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black/75 cursor-pointer"
            >
              <Heart className="h-3.5 w-3.5" /> Endorse
            </span>
          )}
        </div>
      )}

      {/* Endorser avatars — stacked bottom-left above the base line */}
      {endorsers.length > 0 && (
        <div className="absolute bottom-11 left-2.5 flex -space-x-1.5">
          {endorsers.map((e) => (
            <span key={e.id} className="rounded-full ring-2 ring-white/80">
              <InitialsAvatar name={e.endorser?.name || '?'} src={e.endorser?.avatar_url || null} size="xs" />
            </span>
          ))}
        </div>
      )}

      {/* Base — title over the scrim; org name when org-issued, category otherwise; date */}
      <div className="absolute inset-x-0 bottom-0 p-3">
        <h3 className={`text-sm font-semibold leading-snug text-white line-clamp-2 drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)] ${endorsers.length > 0 ? 'pl-8' : ''}`}>
          {item.title}
        </h3>
        <div className="mt-1.5 flex items-center gap-1.5 min-w-0">
          {item.orgLogo ? (
            <img src={item.orgLogo} alt="" className="h-3.5 w-3.5 rounded-full object-cover flex-shrink-0" />
          ) : (
            <InitialsAvatar name={item.org || cat.label} size="xs" />
          )}
          <span className="text-[11px] text-white/85 truncate flex-1">{item.org || cat.label}</span>
          {fmtDate(item.date) && <span className="text-[11px] text-white/60 whitespace-nowrap">{fmtDate(item.date)}</span>}
        </div>
        {(item.participant_role || item.team_slug) && (
          <div className="mt-1 flex items-center gap-1.5">
            {item.participant_role && (
              <span className="inline-flex items-center gap-1 rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-medium text-white">
                <Users className="h-2.5 w-2.5" />{item.participant_role}
              </span>
            )}
            {item.team_slug && (
              <Link
                to={`/team/${item.team_slug}`}
                onClick={(e) => e.stopPropagation()}
                className="text-[10px] text-white/70 hover:text-white hover:underline"
              >
                Team record →
              </Link>
            )}
          </div>
        )}
        {/* Unverified — the way to close the gap is one tap away */}
        {item.status === 'unverified' && onGetVerified && (
          <button
            onClick={(e) => { e.stopPropagation(); onGetVerified(item); }}
            className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-lg border border-border bg-secondary/90 px-2 py-1.5 text-[11px] font-semibold text-foreground backdrop-blur-sm hover:bg-secondary"
          >
            Get this verified <ArrowRight className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

/** Compact list row — the toggle view for students with many records. */
export function AchievementRow({ item, onClick, onShare }) {
  const status = STATUS_BADGE[item.status] || STATUS_BADGE.verified;
  const cat = CATEGORY_STYLE[item.category] || CATEGORY_STYLE.special;
  const Icon = cat.Icon;
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 sm:p-4 rounded-lg border border-border bg-card/60 hover:bg-hover/50 transition-colors flex items-center gap-3"
    >
      <div className="h-10 w-10 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center" style={{ background: cat.grad }}>
        {item.cover ? (
          <img src={item.cover} alt="" className="h-full w-full object-cover" />
        ) : (
          <Icon className="h-5 w-5 text-white" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">
          {[item.org || cat.label, fmtDate(item.date)].filter(Boolean).join(' · ')}
        </p>
      </div>
      {item.status === 'verified' && onShare && (
        <span
          role="button" tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onShare(item); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onShare(item); } }}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-hover hover:text-foreground flex-shrink-0"
          title="Share"
        >
          <Share2 className="h-4 w-4" />
        </span>
      )}
      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold flex-shrink-0 ${status.row}`}>
        {status.Icon && <status.Icon className="h-3 w-3" />}
        {status.label}
      </span>
    </button>
  );
}