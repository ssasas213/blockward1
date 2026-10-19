import React from 'react';
import { BlockwardMark } from '@/components/brand/BlockwardLogo';

// Scene 3 — The BlockWard Vault: a premium vault panel using the real
// BlockWard logo, example achievement cards, and the newly verified
// credential sliding into its slot.
const ITEMS = [
  { title: 'Robotics Competition Finalist', sub: 'National Robotics League · Verified' },
  { title: 'Leadership Recognition', sub: 'Student Council · Verified' },
  { title: 'Internship Completion', sub: 'Meridian Software Labs · Verified' },
  { title: 'Public Speaking Distinction', sub: 'Debate Society · Verified' },
];

export default function SceneVault() {
  return (
    <div className="absolute inset-0" aria-hidden="true">
      {/* Vault panel */}
      <div className="absolute left-1/2 top-1/2 w-[290px] -translate-x-1/2 -translate-y-1/2 sm:left-auto sm:right-[10%] sm:w-[340px] sm:translate-x-0">
        <div style={{ animation: 'sw-vault-in 0.7s cubic-bezier(0.22,1,0.36,1) both, sw-out 0.5s ease both', animationDelay: '6.2s, 8.75s' }}>
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0D1424]/95 shadow-[0_20px_60px_rgb(0_0_0/0.5)]">
            <div className="flex items-center gap-2 border-b border-white/10 bg-white/[0.03] px-4 py-3">
              <BlockwardMark size="sm" />
              <span className="text-xs font-semibold tracking-wide text-white/80">BlockWard Vault</span>
            </div>
            <div className="space-y-1.5 p-2.5">
              {ITEMS.map((it, i) => (
                <div
                  key={it.title}
                  className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2"
                  style={{ animation: 'sw-in 0.5s ease both', animationDelay: `${6.6 + i * 0.15}s` }}
                >
                  <p className="text-[12px] sm:text-[13px] font-medium leading-tight text-white/85">{it.title}</p>
                  <p className="mt-0.5 text-[10px] text-white/40">{it.sub}</p>
                </div>
              ))}
              {/* The newly verified credential slides into its slot */}
              <div
                className="rounded-lg border border-primary/40 bg-primary/[0.08] px-3 py-2"
                style={{ animation: 'sw-slide-row 0.6s cubic-bezier(0.22,1,0.36,1) both, sw-slot-glow 1.4s ease-in-out 2', animationDelay: '7.7s, 8.3s' }}
              >
                <p className="text-[12px] sm:text-[13px] font-medium leading-tight text-primary">Engineering Excellence Award</p>
                <p className="mt-0.5 text-[10px] text-primary/70">Institute of Engineering · Verified on-chain</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}