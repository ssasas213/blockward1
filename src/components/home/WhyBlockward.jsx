import React from 'react';
import { BadgeCheck, Building2, Check, Fingerprint, Link2 } from 'lucide-react';
import Reveal from '@/components/home/Reveal';

const CARDS = [
  {
    icon: Link2,
    title: 'Prove it in seconds',
    text: "Instead of sending someone a certificate and hoping they trust it, send one Blockward link they can independently verify.",
    visual: (
      <div className="flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
        <Link2 className="h-3.5 w-3.5 text-primary flex-shrink-0" />
        <span className="font-mono text-[11px] text-slate-600 truncate">blockward.app/verify/BW-8F2K9Q</span>
        <Check className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
      </div>
    ),
  },
  {
    icon: Building2,
    title: 'Verified at the source',
    text: 'Blockward connects the achievement to the organisation that actually issued it and records verification from authorised Verifiers.',
    visual: (
      <div className="flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
        <Building2 className="h-3.5 w-3.5 text-primary flex-shrink-0" />
        <span className="text-[11px] text-slate-600 truncate">Amazon Web Services</span>
        <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
          <Check className="h-2.5 w-2.5" /> Verified
        </span>
      </div>
    ),
  },
  {
    icon: Fingerprint,
    title: 'Tamper-evident by design',
    text: 'Once verified, Blockward generates a cryptographic fingerprint and anchors its proof to Polygon. Changes can be detected.',
    visual: (
      <div className="flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
        <Fingerprint className="h-3.5 w-3.5 text-primary flex-shrink-0" />
        <span className="font-mono text-[11px] text-slate-600 truncate">6fb6…1271b8</span>
        <span className="ml-auto text-[10px] font-semibold text-primary bg-primary/5 border border-primary/20 rounded-full px-2 py-0.5">
          Polygon PoS
        </span>
      </div>
    ),
  },
  {
    icon: BadgeCheck,
    title: 'One record that follows you',
    text: 'Bring achievements from different organisations into one Blockward profile instead of leaving them scattered across emails, PDFs and folders.',
    visual: (
      <div className="flex flex-wrap gap-1.5">
        {['Certification', 'Competition', 'Course', 'Award'].map((t) => (
          <span key={t} className="rounded-full bg-slate-50 border border-slate-200 px-2.5 py-1 text-[10px] font-medium text-slate-600">
            {t}
          </span>
        ))}
      </div>
    ),
  },
];

export default function WhyBlockward() {
  return (
    <section id="why-blockward" className="mkt-light py-20 sm:py-28 px-4 sm:px-6 lg:px-8 scroll-mt-16">
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <div className="text-center max-w-3xl mx-auto mb-14">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-3">Why Blockward?</p>
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight mkt-ink leading-[1.1] uppercase">
              Your achievements should be as easy to prove as they are to share.
            </h2>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {CARDS.map((c, i) => (
            <Reveal key={c.title} delay={i * 0.06}>
              <div className="mkt-card mkt-card-hover rounded-2xl p-6 h-full flex flex-col">
                <div className="h-11 w-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                  <c.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-base font-semibold mkt-ink mb-2">{c.title}</h3>
                <p className="text-sm mkt-sub leading-relaxed flex-1">{c.text}</p>
                <div className="mt-5">{c.visual}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}