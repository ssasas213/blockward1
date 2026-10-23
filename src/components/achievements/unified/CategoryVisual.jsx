import {
  GraduationCap, Trophy, Medal, HeartHandshake, Briefcase, FileBadge, Crown,
  Rocket, Palette, Shapes, Star, Award, BookOpen, Code2, Music, Globe, Leaf,
  Target, Flag, Heart, Users, Zap, Landmark, Wrench, Microscope,
} from 'lucide-react';

/** Fixed icon whitelist for personal achievement categories. */
export const CATEGORY_ICONS = {
  GraduationCap, Trophy, Medal, HeartHandshake, Briefcase, FileBadge, Crown,
  Rocket, Palette, Shapes, Star, Award, BookOpen, Code2, Music, Globe, Leaf,
  Target, Flag, Heart, Users, Zap, Landmark, Wrench, Microscope,
};

/** Fixed colour palette — mid-tones that read on both the dark and light themes. */
export const CATEGORY_COLORS = {
  blue: 'border-blue-500/40 bg-blue-500/10 text-blue-500',
  amber: 'border-amber-500/40 bg-amber-500/10 text-amber-500',
  green: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500',
  rose: 'border-rose-500/40 bg-rose-500/10 text-rose-500',
  indigo: 'border-indigo-500/40 bg-indigo-500/10 text-indigo-500',
  violet: 'border-violet-500/40 bg-violet-500/10 text-violet-500',
  sky: 'border-sky-500/40 bg-sky-500/10 text-sky-500',
  pink: 'border-pink-500/40 bg-pink-500/10 text-pink-500',
  slate: 'border-slate-500/40 bg-slate-500/10 text-slate-500',
  teal: 'border-teal-500/40 bg-teal-500/10 text-teal-500',
};

export const ICON_OPTIONS = Object.keys(CATEGORY_ICONS);
export const COLOR_OPTIONS = Object.keys(CATEGORY_COLORS);

export function CategoryChip({ cat, className = '' }) {
  const Icon = CATEGORY_ICONS[cat?.icon] || Shapes;
  const colorCls = CATEGORY_COLORS[cat?.color] || CATEGORY_COLORS.slate;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${colorCls} ${className}`}>
      <Icon className="h-3 w-3" />
      <span className="truncate max-w-[180px]">{cat?.name || 'Uncategorised'}</span>
    </span>
  );
}