import React from 'react';
import { BadgeCheck, Building2, UserRound } from 'lucide-react';
import Reveal from '@/components/home/Reveal';

const AUDIENCES = [
  {
    icon: UserRound,
    title: 'Individuals',
    text: "Build a trusted record of achievements that doesn't disappear when you leave a school, company or programme.",
  },
  {
    icon: Building2,
    title: 'Organisations',
    text: 'Give the credentials you issue a verification layer recipients can use anywhere.',
  },
  {
    icon: BadgeCheck,
    title: 'Verifiers',
    text: 'Confirm achievements through a controlled, auditable signing process tied to your organisation.',
  },
];

export default function AudienceProof() {
  return (
    <section className="mkt-light py-20 sm:py-24 px-4 sm:px-6 lg:px-8 border-t border-slate-200">
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight mkt-ink uppercase text-center mb-14">
            Proof that travels with you.
          </h2>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {AUDIENCES.map((a, i) => (
            <Reveal key={a.title} delay={i * 0.07}>
              <div className="mkt-card mkt-card-hover rounded-2xl p-7 h-full">
                <div className="h-11 w-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                  <a.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mkt-ink mb-2">{a.title}</h3>
                <p className="text-sm mkt-sub leading-relaxed">{a.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}