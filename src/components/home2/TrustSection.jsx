import React from 'react';
import { Check } from 'lucide-react';
import Reveal from '@/components/home/Reveal';

const CHECKS = [
  {
    title: 'A named issuer',
    body: 'The credential names the organisation that verified it, and the authorised person who signed.',
  },
  {
    title: 'Live status',
    body: 'Current validity, visible to anyone with the link. If a credential is revoked, that is never hidden.',
  },
  {
    title: 'Integrity',
    body: 'The credential\u2019s content fingerprint is recomputed and compared against the commitment recorded on-chain when it was issued.',
  },
];

export default function TrustSection() {
  return (
    <section id="trust" className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8 scroll-mt-16">
      <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
        <Reveal>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-4">Why it counts</p>
            <h2 className="font-display font-black text-4xl sm:text-6xl text-white leading-[1.05] tracking-tight mb-6">
              More than a claim.
            </h2>
            <p className="text-white/60 leading-relaxed mb-8 max-w-lg">
              Anyone can write an achievement on a CV. A BlockWard credential carries three
              things a self-reported claim never has:
            </p>
            <ol className="space-y-5">
              {CHECKS.map((c, i) => (
                <li key={c.title} className="flex gap-4">
                  <span className="font-mono text-xs text-white/30 pt-1">{`0${i + 1}`}</span>
                  <div>
                    <p className="text-sm font-semibold text-white mb-1">{c.title}</p>
                    <p className="text-sm text-white/55 leading-relaxed">{c.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-8 text-xs text-white/40 leading-relaxed max-w-lg border-l-2 border-primary/30 pl-4">
              Blockchain anchoring protects a credential's integrity after it is issued. It does
              not replace the issuer's judgement — the organisation's verification is what
              attests the achievement itself.
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          {/* Miniature render of the public verification result */}
          <div className="max-w-md w-full lg:ml-auto rounded-2xl border border-white/10 bg-white/[0.02] p-6 shadow-[0_30px_80px_rgb(0_0_0/0.45)]">
            <div className="flex items-center justify-between mb-5">
              <p className="text-[10px] uppercase tracking-widest text-white/45">Verification result</p>
              <span className="font-mono text-[11px] text-white/40">BW-K4T2M9QP</span>
            </div>

            <div className="rounded-xl border border-white/10 p-4">
              <p className="text-[10px] uppercase tracking-widest text-white/35 mb-1.5">Issuer</p>
              <p className="text-[13px] text-white">Meridian Institute of Technology</p>
              <p className="text-[11px] text-white/45 mt-0.5">Verified by Dr. Amira Haddad, Head of Robotics</p>
            </div>

            <div className="mt-3 rounded-xl border border-white/10 p-4 flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-widest text-white/35">Status</p>
              <p className="flex items-center gap-2 text-[13px] text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                Active
              </p>
            </div>

            <div className="mt-3 rounded-xl border border-primary/25 bg-primary/[0.05] p-4">
              <p className="text-[10px] uppercase tracking-widest text-white/35 mb-1.5">Integrity</p>
              <div className="flex items-center gap-2 text-[12px] font-mono text-white/70">
                <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                <span>recomputed 9f3a…c71b = anchored 9f3a…c71b</span>
              </div>
              <p className="mt-2 text-[10px] text-white/35">Content commitment · anchored on Polygon PoS</p>
            </div>

            <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between">
              <p className="text-[13px] font-semibold text-white">Authentic</p>
              <p className="text-[11px] text-white/35">Checked without an account</p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}