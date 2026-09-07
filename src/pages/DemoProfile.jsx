import React from 'react';
import { Shield, ArrowRight, BadgeCheck, Trophy, Medal, Star, Sparkles, Speech } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Reveal from '@/components/home/Reveal';
import { createPageUrl } from '@/utils';

const DEMO = {
  name: 'Maya Okonkwo',
  initials: 'MO',
  meta: 'Year 12 · Riverside Secondary · London, UK',
  link: 'blockward.app/portfolio/maya-o',
  stats: [
    { label: 'Verified achievements', value: '24' },
    { label: 'Achievement points', value: '1,830' },
    { label: 'Organisations', value: '4' },
  ],
  achievements: [
    {
      icon: Trophy,
      title: 'Regional Champion — 100m Sprint',
      org: 'Riverside Secondary',
      date: 'March 2026',
      verifier: 'Signed by Head of PE · Approved by Principal',
      category: 'Sports',
      catClass: 'border-success/30 bg-success/15 text-success',
    },
    {
      icon: Medal,
      title: 'Blue Belt — BJJ',
      org: 'Gracie Academy London',
      date: 'January 2026',
      verifier: 'Signed by Head Coach · Approved by Academy Owner',
      category: 'Martial Arts',
      catClass: 'border-info/30 bg-info/15 text-info',
    },
    {
      icon: Star,
      title: 'Grade 8 Distinction — Violin',
      org: 'Royal Music Academy',
      date: 'December 2025',
      verifier: 'Signed by Senior Examiner · Approved by Academy Director',
      category: 'Arts',
      catClass: 'border-accent/30 bg-accent/15 text-accent',
    },
    {
      icon: Sparkles,
      title: 'Student Council President',
      org: 'Riverside Secondary',
      date: 'September 2025',
      verifier: 'Signed by Year Head · Approved by Principal',
      category: 'Leadership',
      catClass: 'border-primary/30 bg-primary/15 text-primary',
    },
    {
      icon: Speech,
      title: 'Winner — Regional Debating Championship',
      org: 'Debate Society',
      date: 'May 2025',
      verifier: 'Signed by Club Coach · Approved by Federation',
      category: 'Academic',
      catClass: 'border-warning/30 bg-warning/15 text-warning',
    },
  ],
};

function AchievementRow({ a, i }) {
  return (
    <Reveal delay={i * 0.05}>
      <div className="card-hover flex items-start gap-4 p-5 rounded-xl bg-card/60 backdrop-blur-md border border-border">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <a.icon className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-foreground">{a.title}</h3>
            <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${a.catClass}`}>
              <BadgeCheck className="h-3 w-3" />
              {a.category}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{a.org} · {a.date}</p>
          <p className="text-xs text-tertiary mt-1">{a.verifier}</p>
        </div>
      </div>
    </Reveal>
  );
}

export default function DemoProfile() {
  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      {/* Slim header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <a href={createPageUrl('Home')} className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-semibold text-foreground">BlockWard</span>
          </a>
          <div className="flex items-center gap-3">
            <button onClick={() => window.location.href = createPageUrl('Home')} className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block">
              Back to home
            </button>
            <Button size="sm" onClick={() => window.location.href = createPageUrl('Signup')}>
              Claim yours
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="pt-14 max-w-3xl mx-auto px-4 sm:px-6 pb-24">
        {/* Example banner */}
        <div className="mt-6 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning text-center">
          This is an example profile — so you can see exactly what universities and employers see.
        </div>

        {/* Profile header */}
        <div className="mt-8 rounded-2xl border border-border bg-card/60 backdrop-blur-md p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            <div className="h-20 w-20 rounded-2xl bg-brand-gradient flex items-center justify-center text-2xl font-bold text-white flex-shrink-0">
              {DEMO.initials}
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{DEMO.name}</h1>
              <p className="text-sm text-muted-foreground mt-1">{DEMO.meta}</p>
              <div className="inline-flex items-center gap-2 mt-3 px-3 py-1.5 rounded-lg bg-background border border-border text-xs font-mono text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-success inline-block" aria-hidden />
                {DEMO.link}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-7">
            {DEMO.stats.map((s) => (
              <div key={s.label} className="rounded-xl bg-background/60 border border-border p-4 text-center">
                <p className="text-xl sm:text-2xl font-bold text-foreground">{s.value}</p>
                <p className="text-[11px] sm:text-xs text-muted-foreground mt-1 leading-tight">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Achievements */}
        <h2 className="text-lg font-semibold text-foreground mt-10 mb-4">Verified achievements</h2>
        <div className="space-y-3">
          {DEMO.achievements.map((a, i) => (
            <AchievementRow key={i} a={a} i={i} />
          ))}
        </div>

        {/* CTA */}
        <Reveal>
          <div className="mt-14 rounded-2xl border border-primary/20 bg-primary/5 p-8 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">This could be you.</h2>
            <p className="text-muted-foreground mt-3 max-w-md mx-auto">
              Claim your profile, get your school or club connected, and start collecting receipts for everything you earn.
            </p>
            <Button size="lg" className="mt-6" onClick={() => window.location.href = createPageUrl('Signup')}>
              Claim your profile
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </Reveal>
      </main>
    </div>
  );
}