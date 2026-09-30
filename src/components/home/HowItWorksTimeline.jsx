import React from 'react';
import { PlusCircle, PenTool, ShieldCheck, Share2 } from 'lucide-react';
import Reveal from '@/components/home/Reveal';

const STEPS = [
  {
    icon: PlusCircle,
    title: 'Add',
    text: 'Add a certificate, award, competition win, qualification, role or other achievement.',
  },
  {
    icon: PenTool,
    title: 'Verify',
    text: 'Connect it to the organisation that issued it. Authorised Verifier(s) review the evidence and digitally sign the verification.',
  },
  {
    icon: ShieldCheck,
    title: 'Secure',
    text: 'Blockward creates the credential fingerprint and anchors its proof to Polygon.',
  },
  {
    icon: Share2,
    title: 'Share',
    text: 'Receive one Blockward verification link that anyone can independently check.',
  },
];

export default function HowItWorksTimeline() {
  return (
    <section id="how-it-works" className="mkt-light py-20 sm:py-28 px-4 sm:px-6 lg:px-8 scroll-mt-16">
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <div className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-3">How it works</p>
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight mkt-ink uppercase">
              Add → Verify → Secure → Share
            </h2>
          </div>
        </Reveal>

        <div className="relative">
          {/* Connecting timeline (desktop) */}
          <div
            className="hidden lg:block absolute top-[26px] left-[12.5%] right-[12.5%] h-0.5"
            style={{ background: 'linear-gradient(90deg, hsl(258 70% 53% / 0.25), hsl(258 70% 53% / 0.5), hsl(330 80% 50% / 0.5), hsl(330 80% 50% / 0.25))' }}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-5">
            {STEPS.map((s, i) => (
              <Reveal key={s.title} delay={i * 0.08}>
                <div className="flex flex-col items-center text-center">
                  {/* Node */}
                  <div className="relative z-10 h-[52px] w-[52px] rounded-full bg-white border-2 border-primary/30 shadow-sm flex items-center justify-center mb-5">
                    <s.icon className="h-5 w-5 text-primary" />
                    <span className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-brand-gradient text-white text-[10px] font-bold flex items-center justify-center">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <div className="mkt-card rounded-2xl p-5 w-full">
                    <h3 className="text-base font-semibold mkt-ink mb-2">{s.title}</h3>
                    <p className="text-sm mkt-sub leading-relaxed">{s.text}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}