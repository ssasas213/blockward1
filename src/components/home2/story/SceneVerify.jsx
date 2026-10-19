import React from 'react';
import { BlockwardMark } from '@/components/brand/BlockwardLogo';
import StoryCredential from './CredentialCard';

// Scene 4 — Your future opportunities: the credential travels from the
// Vault to a professional laptop, where the verification checks run and
// land on "Authentic". Illustrative only — never implies a live check.
const CHECKS = [
  { label: 'Issuer verified', delay: 10.0 },
  { label: 'Status active', delay: 10.3 },
  { label: 'Integrity confirmed', delay: 10.6 },
];

export default function SceneVerify() {
  return (
    <div className="absolute inset-0" aria-hidden="true">
      {/* Credential flying from the Vault toward the laptop */}
      <div className="absolute left-1/2 top-1/2 w-52 sm:w-60">
        <div style={{ animation: 'sw-fly 0.9s cubic-bezier(0.55,0,0.25,1) both', animationDelay: '9.45s' }}>
          <StoryCredential />
        </div>
      </div>

      {/* Laptop */}
      <div className="absolute left-1/2 top-1/2 w-[300px] -translate-x-1/2 -translate-y-1/2 sm:w-[380px]">
        <div style={{ animation: 'sw-laptop-in 0.8s cubic-bezier(0.22,1,0.36,1) both', animationDelay: '9.2s' }}>
          <div className="rounded-t-xl border border-white/10 bg-[#101828] p-2 shadow-[0_24px_80px_rgb(0_0_0/0.55)] sm:p-2.5">
            <div className="rounded-lg border border-white/[0.06] bg-[#0A0F1A] p-3 sm:p-4">
              <VerificationCard />
            </div>
          </div>
          <div className="mx-[-7%] h-2.5 rounded-b-xl border border-t-0 border-white/10 bg-[#1A2438] sm:h-3" />
        </div>
      </div>
    </div>
  );
}

// The verification card — same design language as the public verification
// experience. `instant` renders the finished state (reduced-motion fallback).
export function VerificationCard({ instant = false }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <BlockwardMark size="sm" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">Verification</span>
      </div>
      <div className="space-y-2">
        {CHECKS.map((c) => (
          <div
            key={c.label}
            className="flex items-center justify-between rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2"
            style={instant ? undefined : { animation: 'sw-in 0.4s ease both', animationDelay: `${c.delay}s` }}
          >
            <span className="text-[12px] sm:text-[13px] text-white/80">{c.label}</span>
            <span
              className="grid h-[18px] w-[18px] place-items-center rounded-full bg-success/20"
              style={instant ? undefined : { animation: 'sw-pop 0.35s cubic-bezier(0.22,1,0.36,1) both', animationDelay: `${c.delay + 0.15}s` }}
            >
              <svg viewBox="0 0 12 12" className="h-2.5 w-2.5"><path d="M2.5 6.5 L5 9 L9.5 3.5" stroke="#34D399" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
          </div>
        ))}
      </div>
      <div
        className="mt-3 flex items-center justify-center gap-2"
        style={instant ? undefined : { animation: 'sw-pop 0.5s cubic-bezier(0.22,1,0.36,1) both', animationDelay: '10.95s' }}
      >
        <span className="grid h-6 w-6 place-items-center rounded-full bg-primary">
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5"><path d="M3.5 8.5 L6.5 11.5 L12.5 4.5" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
        <span className="font-display text-lg text-white">Authentic</span>
      </div>
    </div>
  );
}