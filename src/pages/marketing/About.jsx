import React, { useEffect } from 'react';
import { Award, ShieldCheck, Users, Lock, ArrowRight } from 'lucide-react';
import MarketingShell from '@/components/marketing/MarketingShell';
import { Button } from '@/components/ui/button';

const PRINCIPLES = [
  { icon: Lock, title: 'Records are permanent', desc: 'Once a credential is verified, nobody can quietly edit or delete it — not the student, not the organisation, not us.' },
  { icon: Users, title: 'Students own their record', desc: 'Achievements belong to the person who earned them. They carry their verified portfolio with them for life — across schools, clubs and employers.' },
  { icon: ShieldCheck, title: 'Trust must be earned in public', desc: 'Any credential can be checked by any third party in under a minute. We never ask anyone to just take our word for it.' },
  { icon: Award, title: 'Recognition should be meaningful', desc: 'Endorsements are deliberately scarce, sign-offs are deliberate and named, and rejections stay private. Nothing here is a vanity metric factory.' },
];

export default function About() {
  useEffect(() => { document.title = 'About — BlockWard'; }, []);

  return (
    <MarketingShell
      title="We think proof should outlast the applause."
      subtitle="BlockWard turns achievements into permanent, independently verifiable records — for students, and for the schools, clubs and academies that believe in them."
    >
      {/* The problem */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto space-y-5">
          <h2 className="text-2xl font-semibold text-foreground tracking-tight">Why BlockWard exists</h2>
          <p className="text-base text-muted-foreground leading-relaxed">
            A regional championship, a black belt, a distinction in Grade 8 violin, a term of student-council leadership —
            each of these took real work. And almost always, the recognition ends up in one of three places: a certificate
            in a drawer, a post that scrolls away, or a spreadsheet nobody will ever read again.
          </p>
          <p className="text-base text-muted-foreground leading-relaxed">
            Meanwhile, admissions officers and hiring managers see forged credentials constantly, so they trust paper
            less every year. The people who did the work end up paying the price for the people who fake it.
          </p>
          <p className="text-base text-muted-foreground leading-relaxed">
            BlockWard closes that gap. When an organisation verifies an achievement, it becomes a permanent record the
            student owns — and one that any third party can check independently, in minutes, without an account or a
            phone call.
          </p>
        </div>
      </section>

      {/* Principles */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 border-t border-border">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight mb-3">What we believe</h2>
            <p className="text-base text-muted-foreground max-w-2xl mx-auto">
              A product whose entire promise is trust has to be built a certain way. These are the commitments we don't bend on.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {PRINCIPLES.map((p, i) => (
              <div key={i} className="card-hover p-6 rounded-xl bg-card/40 backdrop-blur-md border border-border">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <p.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-base font-medium text-foreground mb-2">{p.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 border-t border-border">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-semibold text-foreground tracking-tight mb-6">Who uses BlockWard</h2>
          <ul className="space-y-4 text-base text-muted-foreground leading-relaxed">
            <li><strong className="text-foreground">Schools</strong> — keep achievement, behaviour and leadership recognition verifiable and portable, from Year 7 through graduation.</li>
            <li><strong className="text-foreground">Sports clubs &amp; martial arts academies</strong> — gradings, belts and medals with a real, checkable record behind them.</li>
            <li><strong className="text-foreground">Music, chess and competitive organisations</strong> — exam results, ratings and championship placings that follow the student.</li>
            <li><strong className="text-foreground">Students</strong> — one permanent, public portfolio across every organisation they've ever been part of.</li>
            <li><strong className="text-foreground">Universities &amp; employers</strong> — verify any shared credential in under a minute, no account required.</li>
          </ul>

          <div className="mt-10 rounded-2xl border border-primary/20 bg-primary/5 p-8 text-center">
            <p className="text-lg font-semibold text-foreground">Want to see it first?</p>
            <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
              Browse a live example profile, or check how a third party verifies a credential.
            </p>
            <div className="mt-5 flex flex-col sm:flex-row gap-3 justify-center">
              <Button variant="outline" onClick={() => window.location.href = '/DemoProfile'}>
                See an example profile
              </Button>
              <Button onClick={() => window.location.href = '/verify'}>
                Try the verification tool <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}