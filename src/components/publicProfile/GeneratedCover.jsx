import React from 'react';

// Deterministic string hash — same input always produces the same cover.
function hashString(str) {
  let h = 2166136261;
  const s = String(str || '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

// Base two-tone palettes per category (matches the app's category gradients).
const PALETTES = {
  academic: ['#8B5CF6', '#6366F1'],
  sports: ['#10B981', '#059669'],
  arts: ['#EC4899', '#F472B6'],
  leadership: ['#8B5CF6', '#EC4899'],
  community: ['#F59E0B', '#F97316'],
  behaviour: ['#64748B', '#475569'],
  special: ['#6366F1', '#8B5CF6'],
};

const ANGLES = [135, 160, 115, 200];

/**
 * GeneratedCover — a deterministic generated cover for achievements without an
 * uploaded photo. Built purely from the category palette, the issuing
 * organisation's name/logo and the title: the same input always renders the
 * same image, and a profile of many achievements shows varied, branded covers
 * instead of identical placeholders.
 */
export default function GeneratedCover({ title, category, orgName, orgLogo, className = '', compact = false, bare = false }) {
  const palette = PALETTES[category] || PALETTES.special;
  const h = hashString(`${title}|${category}|${orgName}`);
  const angle = ANGLES[h % ANGLES.length];
  // Hash-seeded decorative shapes — positions/sizes are stable per achievement.
  const c1 = { x: 62 + (h % 30), y: 18 + ((h >> 3) % 25), r: 34 + ((h >> 5) % 22) };
  const c2 = { x: 12 + ((h >> 7) % 22), y: 66 + ((h >> 9) % 18), r: 22 + ((h >> 11) % 16) };

  return (
    <div
      className={`relative h-full w-full overflow-hidden ${className}`}
      style={{ background: `linear-gradient(${angle}deg, ${palette[0]}, ${palette[1]})` }}
    >
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 75" preserveAspectRatio="none" aria-hidden="true">
        <circle cx={c1.x} cy={c1.y} r={c1.r} fill="rgba(255,255,255,0.12)" />
        <circle cx={c2.x} cy={c2.y} r={c2.r} fill="rgba(255,255,255,0.08)" />
        <path d={`M -5 ${20 + (h % 15)} Q 50 ${5 + ((h >> 4) % 20)}, 105 ${30 + ((h >> 6) % 15)}`} stroke="rgba(255,255,255,0.14)" strokeWidth="0.8" fill="none" />
      </svg>

      {/* Organisation badge — hidden in `bare` mode when the card renders its own base line */}
      {!bare && (
        <div className="absolute top-2 left-2 flex items-center gap-1.5 rounded-full bg-black/25 px-2 py-0.5 backdrop-blur-sm">
          {orgLogo ? (
            <img src={orgLogo} alt="" className="h-3.5 w-3.5 rounded-full object-cover" />
          ) : (
            <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
          )}
          <span className="max-w-[100px] truncate text-[10px] font-medium text-white/90">{orgName || 'Verified'}</span>
        </div>
      )}

      {/* Title — compact mode (small thumbnails) hides it */}
      {!compact && (
        <div className="absolute inset-x-2.5 bottom-2">
          <p className="line-clamp-2 text-[12px] font-semibold leading-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]">{title}</p>
        </div>
      )}
    </div>
  );
}