import React from 'react';
import { Check } from 'lucide-react';

// Six scene artifacts for the signature journey animation.
// Restrained, stroke-and-surface style: blue on navy, no cartoon, no crypto
// clichés. Each scene is a self-contained static render — Journey.jsx owns
// all choreography.

export function TrophyScene() {
  return (
    <div className="relative flex flex-col items-center">
      <div
        className="absolute top-0 w-64 h-64 rounded-full blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, hsl(217 84% 53% / 0.18), transparent 70%)' }}
      />
      <svg width="150" height="170" viewBox="0 0 150 170" fill="none" aria-hidden="true" className="relative">
        <defs>
          <linearGradient id="bw-trophy" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7db0ff" />
            <stop offset="100%" stopColor="#2563EB" />
          </linearGradient>
        </defs>
        <path d="M45 20 h60 v34 a30 30 0 0 1 -60 0 z" fill="url(#bw-trophy)" />
        <path d="M45 26 h-16 a4 4 0 0 0 -4 4 v6 a18 18 0 0 0 18 18" stroke="#2563EB" strokeWidth="5" fill="none" />
        <path d="M105 26 h16 a4 4 0 0 1 4 4 v6 a18 18 0 0 1 -18 18" stroke="#2563EB" strokeWidth="5" fill="none" />
        <path d="M70 86 h10 v24 h-10 z" fill="#2563EB" />
        <rect x="50" y="112" width="50" height="10" rx="3" fill="#2563EB" />
        <rect x="42" y="126" width="66" height="10" rx="3" fill="#2563EB" opacity="0.55" />
      </svg>
      <p className="mt-6 font-mono text-[11px] text-white/40 tracking-[0.25em] uppercase">Achievement</p>
    </div>
  );
}

export function CredentialScene() {
  return (
    <div className="w-[320px] rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center">
      <div className="flex items-center justify-center gap-2.5 mb-4">
        <div className="h-6 w-6 rounded-md bg-primary/20 border border-primary/40 flex items-center justify-center">
          <Check className="h-3.5 w-3.5 text-white" />
        </div>
        <p className="text-xs font-semibold text-white">Meridian Institute of Technology</p>
      </div>
      <p className="text-[10px] uppercase tracking-widest text-white/40 mb-1.5">Digital credential</p>
      <p className="font-display text-lg text-white leading-snug">
        National Robotics Championship — First Place
      </p>
      <p className="mt-3 text-xs text-white/50">Verified by Dr. Amira Haddad, Head of Robotics</p>
      <p className="mt-4 font-mono text-[11px] text-white/40 tracking-widest">BW-K4T2M9QP</p>
    </div>
  );
}

export function AnchorScene() {
  return (
    <div className="flex flex-col items-center">
      <svg width="130" height="130" viewBox="0 0 130 130" fill="none" aria-hidden="true">
        <defs>
          <radialGradient id="bw-fp-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#2563EB" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="65" cy="65" r="64" fill="url(#bw-fp-glow)" />
        {[14, 26, 38, 50].map((r, i) => (
          <circle
            key={r}
            cx="65"
            cy="65"
            r={r}
            stroke="#5b93f5"
            strokeOpacity={0.9 - i * 0.18}
            strokeWidth="2.5"
            fill="none"
            strokeDasharray={i % 2 === 0 ? '58 12' : '34 10'}
            strokeLinecap="round"
            transform={`rotate(${i * 55} 65 65)`}
          />
        ))}
        <circle cx="65" cy="65" r="4.5" fill="#5b93f5" />
      </svg>
      <p className="mt-2 font-mono text-xs text-white/60 tracking-[0.2em]">9f3a…c71b</p>
      <div
        className="h-8 w-px my-2"
        style={{ background: 'linear-gradient(180deg, hsl(217 84% 53% / 0.75), hsl(217 84% 53% / 0.05))' }}
      />
      <div className="flex items-center gap-1.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <React.Fragment key={i}>
            {i > 0 && <div className="h-px w-2 bg-white/15" />}
            <div
              className={
                i === 2
                  ? 'h-8 w-8 rounded-md border border-primary/60 bg-primary/15 flex items-center justify-center shadow-[0_0_16px_hsl(217_84%_53%/0.35)]'
                  : 'h-8 w-8 rounded-md border border-white/10 bg-white/[0.03]'
              }
            >
              {i === 2 && <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />}
            </div>
          </React.Fragment>
        ))}
      </div>
      <p className="mt-3 text-[10px] uppercase tracking-[0.15em] text-white/40">Content commitment · Polygon PoS</p>
    </div>
  );
}

function VaultRow({ title, org }) {
  return (
    <div className="rounded-xl border border-white/10 p-3.5 flex items-center gap-3">
      <div className="h-8 w-8 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center flex-shrink-0">
        <Check className="h-4 w-4 text-white/80" />
      </div>
      <div className="min-w-0">
        <p className="text-[13px] text-white leading-tight truncate">{title}</p>
        <p className="text-[11px] text-white/45 mt-0.5">{org}</p>
      </div>
    </div>
  );
}

export function VaultScene() {
  return (
    <div className="w-[330px] rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/55">BlockWard Vault</p>
        <span className="font-mono text-[10px] text-white/35">04</span>
      </div>
      <div className="rounded-xl border border-primary/30 bg-primary/[0.07] p-3.5 flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center flex-shrink-0">
          <Check className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] text-white leading-tight truncate">National Robotics Championship</p>
          <p className="text-[11px] text-white/45 mt-0.5">Meridian Institute of Technology</p>
        </div>
      </div>
      <div className="mt-2.5 space-y-2.5 opacity-40">
        <VaultRow title="Advanced Lifeguard Certification" org="Northgate Aquatics" />
        <VaultRow title="Grade 8 Violin — Distinction" org="City of Lakes Music Academy" />
      </div>
    </div>
  );
}

export function ShareScene() {
  return (
    <div className="flex items-center gap-5 sm:gap-8">
      <div className="w-[180px] rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-[10px] uppercase tracking-widest text-white/45 mb-2">From your Vault</p>
        <p className="text-[13px] text-white leading-tight">National Robotics Championship</p>
        <p className="mt-2 font-mono text-[10px] text-white/40">BW-K4T2M9QP</p>
      </div>
      <div className="relative h-px w-14 sm:w-24 border-t border-dashed border-white/25">
        <div className="absolute -top-[5px] left-1/2 -translate-x-1/2 h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_12px_hsl(217_84%_53%/0.8)]" />
      </div>
      <div className="w-[180px] rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-[10px] uppercase tracking-widest text-white/45 mb-2">To</p>
        <p className="text-[13px] text-white leading-tight">University Admissions</p>
        <p className="mt-2 text-[11px] text-white/40">One verification link</p>
      </div>
    </div>
  );
}

export function VerifyScene() {
  const rows = [
    ['Issuer', 'Verified organisation'],
    ['Status', 'Active'],
    ['Integrity', 'Fingerprint matches anchor'],
  ];
  return (
    <div className="w-[320px] rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <p className="text-[10px] uppercase tracking-widest text-white/45 mb-4">Independently checked</p>
      <div className="space-y-3">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-4">
            <span className="text-[13px] text-white/70">{k}</span>
            <span className="flex items-center gap-2 text-[13px] text-white text-right">
              <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />
              {v}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
        <span className="text-[13px] font-semibold text-white">Authentic</span>
        <span className="font-mono text-[10px] text-white/40">Polygon PoS</span>
      </div>
    </div>
  );
}