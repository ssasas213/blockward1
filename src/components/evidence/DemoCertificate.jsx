import React from 'react';
import { cn } from '@/lib/utils';

/**
 * DemoCertificate — a FICTIONAL certificate used only on the homepage to
 * illustrate the product concept. Not a real credential, not a partnership.
 * Issuer "Northstar Design Institute" and recipient "Alex Morgan" do not
 * exist. Rendered as a polished visual component in the Blockward visual
 * system.
 *
 * Props:
 *  - variant: 'original' | 'verified' — controls whether the Blockward
 *    verified overlay/mark is shown.
 *  - className
 */
export default function DemoCertificate({ variant = 'original', className }) {
  const verified = variant === 'verified';
  return (
    <div
      className={cn(
        'relative w-full max-w-[380px] mx-auto rounded-lg overflow-hidden',
        'bg-[#fafaf7] text-[#1a1a1a] shadow-2xl',
        verified && 'verified-glow ring-1 ring-primary/30',
        className
      )}
      style={{ aspectRatio: '1 / 0.72' }}
    >
      {/* Border frame */}
      <div className="absolute inset-[10px] border border-[#c9b06b]/70 rounded-sm pointer-events-none" />
      <div className="absolute inset-[14px] border border-[#c9b06b]/30 rounded-sm pointer-events-none" />

      {/* Corner flourishes */}
      <div className="absolute top-3 left-3 h-6 w-6 border-t-2 border-l-2 border-[#8a7340]/50 rounded-tl-sm" />
      <div className="absolute top-3 right-3 h-6 w-6 border-t-2 border-r-2 border-[#8a7340]/50 rounded-tr-sm" />
      <div className="absolute bottom-3 left-3 h-6 w-6 border-b-2 border-l-2 border-[#8a7340]/50 rounded-bl-sm" />
      <div className="absolute bottom-3 right-3 h-6 w-6 border-b-2 border-r-2 border-[#8a7340]/50 rounded-br-sm" />

      <div className="relative h-full flex flex-col items-center text-center px-8 py-7">
        {/* Issuer mark */}
        <NorthstarMark />

        <p className="mt-3 text-[9px] tracking-[0.35em] uppercase text-[#8a7340] font-semibold">
          Certificate of Achievement
        </p>

        <h3 className="mt-1 font-serif text-[15px] leading-tight text-[#1a2b3c] font-semibold" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
          Professional Certificate<br />in Product Design
        </h3>

        <div className="my-2 h-px w-24 bg-[#c9b06b]/50" />

        <p className="text-[8px] tracking-widest uppercase text-[#7a7a7a]">Awarded to</p>
        <p className="mt-0.5 text-[15px] font-semibold text-[#1a2b3c]" style={{ fontFamily: 'Georgia, serif' }}>
          Alex Morgan
        </p>

        <p className="mt-1.5 text-[9px] leading-relaxed text-[#555] max-w-[240px]">
          For successfully completing the<br />Professional Product Design Programme
        </p>

        <p className="mt-2 text-[9px] text-[#7a7a7a]">
          Awarded <span className="font-medium text-[#444]">14 September 2026</span>
        </p>

        {/* Footer: signature + cert id */}
        <div className="mt-auto w-full flex items-end justify-between pt-3">
          <div className="text-left">
            <SignatureMark />
            <p className="text-[7px] uppercase tracking-wide text-[#7a7a7a] mt-0.5">Registrar</p>
          </div>
          <div className="text-right">
            <p className="text-[7px] uppercase tracking-wide text-[#7a7a7a]">Certificate ID</p>
            <p className="text-[8px] font-mono text-[#444] mt-0.5">NSDI-PD-2026-1042</p>
          </div>
        </div>
      </div>

      {/* Illustrative tag — unobtrusive */}
      <p className="absolute bottom-1.5 left-0 right-0 text-center text-[6px] text-[#aaa] tracking-wide">
        Illustrative certificate — fictional issuer and recipient
      </p>

      {/* Verified overlay (only in the 'verified' variant) */}
      {verified && (
        <div className="absolute inset-0 ring-2 ring-primary/40 rounded-lg pointer-events-none" />
      )}
    </div>
  );
}

function NorthstarMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-10 w-10" aria-hidden="true">
      <circle cx="24" cy="24" r="22" fill="none" stroke="#8a7340" strokeWidth="1.2" />
      <path d="M24 8 L27 21 L40 24 L27 27 L24 40 L21 27 L8 24 L21 21 Z" fill="#c9b06b" />
      <circle cx="24" cy="24" r="3" fill="#1a2b3c" />
    </svg>
  );
}

function SignatureMark() {
  return (
    <svg viewBox="0 0 80 28" className="h-7 w-20" aria-hidden="true">
      <path
        d="M4 20 C 10 8, 16 24, 22 14 S 32 22, 38 12 S 50 20, 58 10 L 72 16"
        fill="none" stroke="#1a3a5c" strokeWidth="1.3" strokeLinecap="round"
      />
    </svg>
  );
}