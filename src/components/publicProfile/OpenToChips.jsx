import React from 'react';
import { Sparkles } from 'lucide-react';
import { OPEN_TO_OPTIONS } from '@/lib/profileThemes';

// The "open to" status banner under the bio — what this student is looking
// for. Also feeds the Opportunities matcher server-side. tone 'scrim' sits
// on the fixed white identity card, so it uses fixed AA-verified colours
// (#6D28D9 on white ≈ 5.9:1) instead of the theme accent, which can be a
// light palette colour that fails AA on white.
export default function OpenToChips({ openTo, tone = 'token' }) {
  const opts = (openTo || []).map((id) => OPEN_TO_OPTIONS.find((o) => o.id === id)).filter(Boolean);
  if (!opts.length) return null;
  const cls = tone === 'scrim'
    ? {
        box: 'border-[#6D28D9]/25 bg-[#6D28D9]/8',
        icon: 'text-[#6D28D9]',
        label: 'text-[#6D28D9]',
        chip: 'border-[#6D28D9]/30 bg-[#6D28D9]/8 text-[#6D28D9]',
      }
    : {
        box: 'border-primary/25 bg-primary/10',
        icon: 'text-primary',
        label: 'text-primary',
        chip: 'border-primary/30 bg-primary/10 text-primary',
      };
  return (
    <div className={`inline-flex flex-wrap items-center gap-1.5 rounded-xl border px-2.5 py-1.5 ${cls.box}`}>
      <Sparkles className={`h-3.5 w-3.5 ${cls.icon}`} aria-hidden="true" />
      <span className={`text-[11px] font-semibold uppercase tracking-wide ${cls.label}`}>Open to</span>
      {opts.map((o) => (
        <span key={o.id} className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${cls.chip}`}>
          {o.label}
        </span>
      ))}
    </div>
  );
}