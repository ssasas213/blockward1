import { CATEGORY_ICONS, CATEGORY_COLORS } from '@/components/achievements/unified/CategoryVisual';
import { GraduationCap, Trophy, Medal, HeartHandshake, Briefcase, FileBadge, Crown, Rocket, Palette, Shapes, Star, Award, BookOpen, Wrench, Zap } from 'lucide-react';

/**
 * DefaultBannerCover — the attractive category-based default cover shown when
 * an achievement has no banner image. A soft tinted 16:9 panel carrying the
 * achievement's category icon: the category identifies the card, the
 * achievement title (rendered by the card body) carries the meaning.
 */

// Personal-category colour keys → RGB triplets for soft tints.
const RGB = {
  blue: '37 99 235', amber: '180 83 9', green: '5 150 105', rose: '190 18 60',
  indigo: '79 70 229', violet: '109 40 217', sky: '2 132 199', pink: '190 24 93',
  slate: '71 85 105', teal: '13 148 136',
};

// Achievement-category fallback (when no personal category is assigned).
const ACH_FALLBACK = {
  certification: { Icon: FileBadge, color: 'blue' },
  competition: { Icon: Trophy, color: 'amber' },
  academic: { Icon: GraduationCap, color: 'blue' },
  professional: { Icon: Briefcase, color: 'indigo' },
  course: { Icon: BookOpen, color: 'sky' },
  training: { Icon: Wrench, color: 'slate' },
  award: { Icon: Award, color: 'amber' },
  challenge: { Icon: Zap, color: 'violet' },
  other: { Icon: Shapes, color: 'slate' },
};

export default function DefaultBannerCover({ categories = [], fallback, className = '' }) {
  const personal = categories[0] || null;
  const fb = ACH_FALLBACK[fallback] || ACH_FALLBACK.other;
  const colorKey = personal?.color || fb.color;
  const rgb = RGB[colorKey] || RGB.slate;
  const Icon = (personal && CATEGORY_ICONS[personal.icon]) || fb.Icon || Shapes;

  return (
    <div
      className={`relative h-full w-full overflow-hidden ${className}`}
      style={{
        background:
          `radial-gradient(90% 90% at 20% 0%, rgb(${rgb} / 0.14), transparent 60%),` +
          `linear-gradient(180deg, hsl(var(--secondary)), hsl(var(--card)))`,
      }}
      aria-hidden="true"
    >
      <div className="absolute inset-0 pf-pattern-dots opacity-60" />
      <Icon
        className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2"
        style={{ color: `rgb(${rgb} / 0.32)` }}
      />
    </div>
  );
}