import React from 'react';
import Reveal from '@/components/home/Reveal';

export default function StatementSection() {
  return (
    <section className="relative overflow-hidden py-24 sm:py-32 px-4 sm:px-6 lg:px-8">
      {/* Dark gradient band */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, hsl(252 38% 4%), hsl(258 45% 7%) 50%, hsl(252 38% 4%))',
        }}
      />
      <div
        className="absolute inset-0 mkt-grid-bg opacity-60"
        style={{
          maskImage: 'radial-gradient(ellipse 70% 60% at 50% 50%, black, transparent)',
          WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 50%, black, transparent)',
        }}
      />
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[300px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, hsl(263 70% 52% / 0.12), transparent 70%)' }}
      />

      <div className="relative z-10 max-w-4xl mx-auto text-center">
        <Reveal>
          <h2 className="text-3xl sm:text-5xl lg:text-6xl font-bold uppercase tracking-tight leading-[1.08]">
            <span className="text-white/90">A certificate says you achieved something.</span>
            <br />
            <span className="text-brand-gradient">Blockward proves it.</span>
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="text-base sm:text-lg text-white/60 mt-8 max-w-2xl mx-auto leading-relaxed">
            Anyone can create a document. What matters is being able to prove where an achievement
            came from, who verified it and whether the record has changed.
          </p>
          <p className="text-base sm:text-lg text-white font-medium mt-3">This is what Blockward adds.</p>
        </Reveal>
      </div>
    </section>
  );
}