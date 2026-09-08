import React from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, Trophy, Medal, Star, Sparkles, Heart, Users } from 'lucide-react';
import InitialsAvatar from '@/components/ui/InitialsAvatar';
import GeneratedCover from '@/components/publicProfile/GeneratedCover';

export const CATEGORY_STYLE = {
  academic: { Icon: Medal, grad: 'linear-gradient(135deg, #8B5CF6, #6366F1)' },
  sports: { Icon: Trophy, grad: 'linear-gradient(135deg, #10B981, #059669)' },
  arts: { Icon: Star, grad: 'linear-gradient(135deg, #EC4899, #F472B6)' },
  leadership: { Icon: Sparkles, grad: 'linear-gradient(135deg, #8B5CF6, #EC4899)' },
  community: { Icon: Heart, grad: 'linear-gradient(135deg, #F59E0B, #F97316)' },
  behaviour: { Icon: Users, grad: 'linear-gradient(135deg, #64748B, #475569)' },
  special: { Icon: BadgeCheck, grad: 'linear-gradient(135deg, #6366F1, #8B5CF6)' },
};

export const fmtDate = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
};

/**
 * AchievementTile — one verified credential in the public profile grid.
 * The cover image (uploaded photo or deterministic generated cover) fills the
 * card; a gradient scrim keeps the overlaid title legible over light and
 * dark images alike. Org logo and date sit small at the base, verified badge
 * top-right, endorser avatars stack in the corner, and hovering reveals the
 * endorse action for signed-in viewers.
 */
export default function AchievementTile({ achievement, onClick, canEndorse, onEndorse }) {
  const date = fmtDate(achievement.date_delivered || achievement.date_approved || achievement.date_achieved);
  const endorsers = (achievement.endorsements || []).slice(0, 4);

  return (
    <button
      onClick={onClick}
      className="card-hover group relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-border bg-card text-left"
    >
      <div className="absolute inset-0 transition-transform duration-200 group-hover:scale-[1.03]">
        {achievement.image_url ? (
          <img src={achievement.image_url} alt={achievement.title} className="h-full w-full object-cover" />
        ) : (
          // No uploaded photo — deterministic branded cover built from the
          // category, issuing organisation and title.
          <GeneratedCover
            bare
            compact
            title={achievement.title}
            category={achievement.category}
            orgName={achievement.organisation_name}
            orgLogo={achievement.organisation_logo}
          />
        )}
      </div>
      {/* Scrim — the same treatment for light and dark cover photos */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" aria-hidden="true" />

      {/* Verified — top-right */}
      <span
        className="absolute top-2.5 right-2.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/45 backdrop-blur-sm border border-white/25"
        title="Verified by the issuing organisation"
      >
        <BadgeCheck className="h-4 w-4 text-white" />
      </span>

      {/* Endorse — revealed on hover for signed-in viewers */}
      {canEndorse && (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onEndorse?.(achievement); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onEndorse?.(achievement); } }}
          className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-black/45 backdrop-blur-sm border border-white/25 px-2 py-1 text-[11px] font-semibold text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 hover:bg-black/65 cursor-pointer"
        >
          <Heart className="h-3.5 w-3.5" /> Endorse
        </span>
      )}

      {/* Endorser avatars stack — above the base line */}
      {endorsers.length > 0 && (
        <div className="absolute bottom-11 right-2.5 flex -space-x-1.5">
          {endorsers.map((e) => (
            <span key={e.id} className="rounded-full ring-2 ring-white/80">
              <InitialsAvatar name={e.endorser.name} src={e.endorser.avatar_url} size="xs" />
            </span>
          ))}
        </div>
      )}

      {/* Base — title over the scrim, org logo and date small beneath */}
      <div className="absolute inset-x-0 bottom-0 p-3">
        <h3 className={`text-sm font-semibold leading-snug text-white line-clamp-2 drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)] ${endorsers.length > 0 ? 'pr-7' : ''}`}>
          {achievement.title}
        </h3>
        <div className="mt-1.5 flex items-center gap-1.5 min-w-0">
          {achievement.organisation_logo ? (
            <img src={achievement.organisation_logo} alt="" className="h-3.5 w-3.5 rounded-full object-cover flex-shrink-0" />
          ) : (
            <InitialsAvatar name={achievement.organisation_name || '?'} size="xs" />
          )}
          <span className="text-[11px] text-white/85 truncate flex-1">{achievement.organisation_name}</span>
          {date && <span className="text-[11px] text-white/60 whitespace-nowrap">{date}</span>}
        </div>
        {(achievement.participant_role || achievement.team_slug) && (
          <div className="mt-1 flex items-center gap-1.5">
            {achievement.participant_role && (
              <span className="inline-flex items-center gap-1 rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-medium text-white">
                <Users className="h-2.5 w-2.5" />{achievement.participant_role}
              </span>
            )}
            {achievement.team_slug && (
              <Link
                to={`/team/${achievement.team_slug}`}
                onClick={(e) => e.stopPropagation()}
                className="text-[10px] text-white/70 hover:text-white hover:underline"
              >
                Team record →
              </Link>
            )}
          </div>
        )}
      </div>
    </button>
  );
}