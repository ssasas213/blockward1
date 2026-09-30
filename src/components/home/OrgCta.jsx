import React from 'react';
import { ArrowRight, BookOpen, Check } from 'lucide-react';
import Reveal from '@/components/home/Reveal';

const BENEFITS = [
  'Authorised Verifiers',
  'Digital signatures',
  'Multi-Verifier approval',
  'Public verification',
  'Audit history',
  'Polygon-backed integrity',
];

export default function OrgCta() {
  return (
    <section className="relative py-20 sm:py-28 px-4 sm:px-6 lg:px-8 border-t border-border overflow-hidden">
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(180deg, hsl(252 38% 4%), hsl(258 45% 7%) 50%, hsl(252 38% 4%))' }}
      />
      <div
        className="absolute inset-0 mkt-grid-bg opacity-60 pointer-events-none"
        style={{
          maskImage: 'radial-gradient(ellipse 70% 60% at 50% 50%, black, transparent)',
          WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 50%, black, transparent)',
        }}
      />
      <div className="relative z-10 max-w-4xl mx-auto text-center">
        <Reveal>
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight uppercase leading-[1.1]">
            <span className="text-white/90">Your organisation already issues achievements.</span>
            <br />
            <span className="text-brand-gradient">Make them verifiable.</span>
          </h2>
          <p className="text-base sm:text-lg text-white/60 mt-6 max-w-2xl mx-auto leading-relaxed">
            Give certificates, awards, qualifications and programmes a trusted verification layer
            recipients can carry beyond your organisation.
          </p>
        </Reveal>

        <Reveal delay={0.08}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 mt-10 max-w-3xl mx-auto text-left">
            {BENEFITS.map((b) => (
              <div key={b} className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <span className="h-5 w-5 rounded-full bg-success/15 border border-success/30 flex items-center justify-center flex-shrink-0">
                  <Check className="h-3 w-3 text-success" />
                </span>
                <span className="text-sm text-white/85">{b}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-10">
            <a
              href="/register-organisation"
              className="inline-flex items-center justify-center gap-2 h-12 px-8 rounded-lg bg-brand-gradient text-white font-semibold text-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
            >
              Register Your Organisation <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="/ForOrganisations"
              className="inline-flex items-center justify-center gap-2 h-12 px-8 rounded-lg border border-white/15 bg-white/5 text-white text-sm font-medium transition-all hover:bg-white/10 hover:border-white/25"
            >
              <BookOpen className="h-4 w-4" />
              Learn About Organisations
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}