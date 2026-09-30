import React from 'react';
import { ArrowDown, BadgeCheck, Building2, Fingerprint, ShieldCheck } from 'lucide-react';
import Reveal from '@/components/home/Reveal';

const LAYERS = [
  {
    icon: Building2,
    title: 'Issuer',
    badge: 'Verified Organisation',
    text: 'The organisation behind the achievement is registered and trusted by Blockward.',
  },
  {
    icon: BadgeCheck,
    title: 'Verifier',
    badge: 'Authorised Signature',
    text: 'One or more authorised people confirm the achievement.',
  },
  {
    icon: Fingerprint,
    title: 'Integrity',
    badge: 'Blockchain Confirmed',
    text: "The verified credential's cryptographic commitment matches the record anchored on Polygon.",
  },
];

export default function VerifiedMeaning() {
  return (
    <section className="relative py-20 sm:py-28 px-4 sm:px-6 lg:px-8 border-t border-border overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 20%, hsl(258 90% 66% / 0.08), transparent 65%)' }}
      />
      <div className="relative z-10 max-w-3xl mx-auto">
        <Reveal>
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-white uppercase leading-[1.1]">
              What does <span className="text-brand-gradient">“Blockward Verified”</span> actually mean?
            </h2>
          </div>
        </Reveal>

        <div className="space-y-0">
          {LAYERS.map((l, i) => (
            <div key={l.title}>
              <Reveal delay={i * 0.07}>
                <div className="surface-card rounded-2xl p-6 flex items-start gap-4 card-hover">
                  <div className="h-11 w-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                    <l.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="text-xs font-semibold uppercase tracking-wider text-white/40">{l.title}</span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2.5 py-0.5 text-[11px] font-medium text-success">
                        <ShieldCheck className="h-3 w-3" /> {l.badge}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed mt-2">{l.text}</p>
                  </div>
                </div>
              </Reveal>
              {i < LAYERS.length - 1 && (
                <div className="flex justify-center py-2">
                  <ArrowDown className="h-4 w-4 text-primary/60" />
                </div>
              )}
            </div>
          ))}
        </div>

        <Reveal delay={0.15}>
          <div className="mt-8 border-brand-gradient rounded-2xl p-8 text-center">
            <div className="inline-flex items-center gap-2.5 bg-brand-gradient rounded-full px-6 py-3 text-lg sm:text-xl font-bold uppercase tracking-wide text-white">
              <ShieldCheck className="h-6 w-6" />
              Blockward Verified
            </div>
            <p className="mt-6 text-lg font-semibold text-white">
              Not just uploaded. Not just stored. <span className="text-brand-gradient">Verified.</span>
            </p>
            <p className="mt-3 text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed">
              Anyone can upload a document. Blockward only issues this badge after the issuer confirms
              the achievement, an authorised verifier signs it and the on-chain commitment matches —
              a distinction anyone checking can confirm for themselves.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}