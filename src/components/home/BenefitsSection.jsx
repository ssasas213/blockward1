import React from 'react';
import {
  ShieldCheck, Link2, Infinity as InfinityIcon, LayoutGrid, BadgeCheck, KeyRound,
} from 'lucide-react';
import Reveal from '@/components/home/Reveal';

const benefits = [
  {
    icon: ShieldCheck,
    title: 'Nobody can call your CV fake',
    desc: 'Every award is signed off by the people who awarded it and locked so it can\'t be edited. Screenshot it, share it — it holds up.',
  },
  {
    icon: Link2,
    title: 'One link for every application',
    desc: 'Drop a single URL into your UCAS form, CV or LinkedIn. Everything you\'ve earned is right there — no attachments, no hunting for certificates.',
  },
  {
    icon: InfinityIcon,
    title: 'Works after you graduate',
    desc: 'School accounts get deleted. This doesn\'t. Your achievements stay yours forever, even years after you walk out the gate.',
  },
  {
    icon: LayoutGrid,
    title: 'Everything in one place',
    desc: 'School, club, dojo, academy — every achievement from every part of your life lives together on one profile.',
  },
  {
    icon: BadgeCheck,
    title: 'Universities and employers verify instantly',
    desc: 'They click your link and see verified proof in seconds. No phone calls to the school office, no "we\'ll get back to you".',
  },
  {
    icon: KeyRound,
    title: 'You own it, not your school',
    desc: 'Your profile belongs to you. Change schools, move cities, switch clubs — it travels with you the whole way.',
  },
];

export default function BenefitsSection() {
  return (
    <section id="benefits" className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8 border-t border-border">
      <div className="max-w-7xl mx-auto">
        <Reveal className="text-center mb-16 sm:mb-20">
          <p className="text-sm text-primary font-medium mb-3">Why students use it</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground tracking-tight mb-4 leading-tight">
            You did the work.
            <br />
            Now you can prove it.
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
            Anyone can write "captain of the team" on a form. You can prove it.
          </p>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {benefits.map((benefit, i) => (
            <Reveal key={i} delay={i * 0.06}>
              <div className="card-hover h-full p-6 sm:p-7 rounded-xl bg-card border border-border">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5">
                  <benefit.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-2 leading-snug">{benefit.title}</h3>
                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">{benefit.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}