import React from 'react';
import { BlockwardMark } from '@/components/brand/BlockwardLogo';

// The shared credential artifact — one consistent card reused across every
// scene so the journey reads as a single continuous object moving through
// the story. Visual language matches the site: dark card, blue border,
// BlockWard mark, verified indicator.
export default function StoryCredential({ title = 'Engineering Excellence Award', org = 'Institute of Engineering', className = '' }) {
  return (
    <div className={`w-52 sm:w-60 overflow-hidden rounded-xl border border-primary/40 bg-[#0D1424]/95 shadow-[0_8px_40px_rgb(0_0_0/0.45),0_0_24px_rgb(37_99_235/0.16)] ${className}`}>
      <div className="flex items-center gap-2 border-b border-white/10 px-4 pb-2 pt-3">
        <BlockwardMark size="sm" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">Blockward</span>
      </div>
      <div className="px-4 py-3">
        <p className="font-display text-sm sm:text-base leading-snug text-white">{title}</p>
        <p className="mt-1 text-[11px] text-white/45">{org}</p>
      </div>
      <div className="flex items-center gap-1.5 px-4 pb-3">
        <span className="h-1.5 w-1.5 rounded-full bg-success" />
        <span className="text-[10px] font-medium tracking-wide text-success/90">Verified on-chain</span>
      </div>
    </div>
  );
}