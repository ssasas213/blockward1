import React from 'react';
import { Check, FileText, X } from 'lucide-react';
import Reveal from '@/components/home/Reveal';

const WITHOUT = ['PDF certificate', 'Email attachment', 'Screenshot', 'Physical certificate'];
const WITHOUT_LABELS = ['Hard to verify', 'Easy to lose', 'Scattered everywhere', 'No live status', 'No trusted verification link'];
const WITH = ['Issuer confirmed', 'Verifier signed', 'Integrity confirmed', 'One permanent verification link', 'Share anywhere'];

export default function ProblemSection() {
  return (
    <section className="mkt-light py-20 sm:py-28 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <div className="max-w-3xl mb-14">
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight mkt-ink uppercase leading-[1.1]">
              Stop letting your achievements gather dust in a drawer.
            </h2>
            <p className="text-base sm:text-lg mkt-sub mt-6 leading-relaxed">
              Certificates get buried in folders, lost in inboxes and forgotten after they're earned.
              And when you actually need them, a PDF alone doesn't prove who issued it, whether it has
              been changed, or whether it is still valid.
            </p>
            <p className="text-base sm:text-lg mkt-ink font-medium mt-4">
              Blockward turns those achievements into a trusted record you can carry with you.
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* WITHOUT — muted, scattered */}
            <div className="mkt-card rounded-2xl p-7 opacity-90">
              <div className="flex items-center justify-between mb-6">
                <p className="text-xs font-semibold uppercase tracking-wider mkt-sub">Without Blockward</p>
                <X className="h-5 w-5 text-red-400" />
              </div>
              <div className="space-y-3">
                {WITHOUT.map((t) => (
                  <div key={t} className="flex items-center gap-3 mkt-soft rounded-lg px-4 py-3 border border-dashed mkt-line">
                    <FileText className="h-4 w-4 mkt-sub flex-shrink-0" />
                    <span className="text-sm mkt-sub line-through decoration-red-400/50">{t}</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 pt-5 border-t mkt-line">
                <ul className="space-y-2">
                  {WITHOUT_LABELS.map((l) => (
                    <li key={l} className="flex items-center gap-2 text-sm mkt-sub">
                      <X className="h-3.5 w-3.5 text-red-400 flex-shrink-0" /> {l}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* WITH — clean, verified */}
            <div className="rounded-2xl p-7 mkt-gradient-border">
              <div className="flex items-center justify-between mb-6">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">With Blockward</p>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-gradient px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
                  <Check className="h-3 w-3" /> Blockward Verified
                </span>
              </div>
              <div className="space-y-3">
                {WITH.map((t) => (
                  <div key={t} className="flex items-center gap-3 mkt-soft rounded-lg px-4 py-3">
                    <span className="h-5 w-5 rounded-full bg-primary/10 border border-primary/25 flex items-center justify-center flex-shrink-0">
                      <Check className="h-3 w-3 text-primary" />
                    </span>
                    <span className="text-sm font-medium mkt-ink">{t}</span>
                  </div>
                ))}
              </div>
              <p className="mt-6 pt-5 border-t mkt-line text-sm mkt-sub leading-relaxed">
                The issuer confirms it. An authorised verifier signs it. The record's fingerprint is
                anchored to Polygon. Anyone can check all three — from one link.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}