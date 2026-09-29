import React from 'react';
import { PlusCircle, PenTool, ShieldCheck, Share2 } from 'lucide-react';

const STEPS = [
  {
    icon: PlusCircle,
    title: 'Add',
    text: 'Add an achievement — a certificate, competition win, course, award or role.',
  },
  {
    icon: PenTool,
    title: 'Verify',
    text: 'Connect it to the issuing organisation. Their authorised Verifier(s) review the evidence and sign it — with joint verification for high-assurance credentials.',
  },
  {
    icon: ShieldCheck,
    title: 'Secure',
    text: 'Blockward creates a cryptographic commitment of the exact attested details and anchors it to Polygon. It becomes Blockward Verified.',
  },
  {
    icon: Share2,
    title: 'Share',
    text: 'Share one verification link anywhere — admissions, employers, teams. Anyone can re-check it against the blockchain, no account needed.',
  },
];

const AUDIENCES = [
  'Individuals',
  'Universities',
  'Companies',
  'Certification providers',
  'Training organisations',
  'Competitions',
  'Sports organisations',
  'Schools',
  'Clubs',
  'Professional associations',
];

export default function UniversalSections() {
  return (
    <>
      <section id="how-it-works" className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8 border-t border-border">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-5xl font-bold text-foreground tracking-tight">Add → Verify → Secure → Share</h2>
            <p className="text-base sm:text-lg text-muted-foreground mt-4 max-w-2xl mx-auto">
              Four steps between an achievement and proof that stands on its own.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {STEPS.map((s, i) => (
              <div key={s.title} className="surface-card rounded-2xl p-6 card-hover relative">
                <span className="absolute top-5 right-6 text-xs font-semibold text-tertiary">{String(i + 1).padStart(2, '0')}</span>
                <div className="h-11 w-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                  <s.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-4 sm:px-6 lg:px-8 border-t border-border">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">Built for every kind of achievement</h2>
          <p className="text-muted-foreground mt-3">
            One verification standard — from professional certifications to tournament wins. Schools are one
            use case among many, never the product.
          </p>
          <div className="flex flex-wrap justify-center gap-2.5 mt-8">
            {AUDIENCES.map((a) => (
              <span key={a} className="rounded-full border border-border bg-secondary/50 px-4 py-1.5 text-sm text-muted-foreground">
                {a}
              </span>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}