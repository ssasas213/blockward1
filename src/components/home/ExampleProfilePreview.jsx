import React from 'react';
import { BadgeCheck, Award, Trophy, Music, ArrowRight } from 'lucide-react';
import InitialsAvatar from '@/components/ui/InitialsAvatar';
import { createPageUrl } from '@/utils';

// Example data — labelled as an example on the card itself. Mirrors the
// shape and visual language of the real public profile (ProfileHero +
// AchievementTile): banner, white identity card, category badges and a
// "Verified by" line on every achievement.
const EXAMPLE_ACHIEVEMENTS = [
  {
    icon: Award,
    category: 'Academic',
    title: 'Top in Year — Mathematics',
    org: 'Riverside Secondary',
    verifiedBy: 'Ms. Adeyemi · Head of Maths',
    date: 'Jun 2026',
  },
  {
    icon: Trophy,
    category: 'Sports',
    title: 'Regional Champion — 100m Sprint',
    org: 'Riverside Secondary',
    verifiedBy: 'Mr. Grant · Head of PE',
    date: 'Mar 2026',
  },
  {
    icon: Music,
    category: 'Music',
    title: 'Grade 8 Distinction — Violin',
    org: 'Royal Music Academy',
    verifiedBy: 'Dr. Ellis · Senior Examiner',
    date: 'Dec 2025',
  },
];

export default function ExampleProfilePreview() {
  return (
    <div className="relative w-full max-w-[560px] mx-auto">
      {/* Subtle static radial glow behind the preview */}
      <div
        aria-hidden="true"
        className="absolute -inset-8 rounded-[2.5rem] pointer-events-none"
        style={{ background: 'radial-gradient(closest-side, hsl(258 90% 66% / 0.16), transparent 75%)' }}
      />

      <div className="relative rounded-2xl border border-white/10 bg-card overflow-hidden shadow-2xl">
        {/* Example label — always visible, never implies real data */}
        <span className="absolute top-3 right-3 z-10 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/50 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur">
          Example profile
        </span>

        {/* Banner — same treatment as the real profile banner */}
        <div className="relative h-20 sm:h-24 bg-brand-gradient">
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{ background: 'radial-gradient(80% 90% at 78% 0%, hsl(0 0% 100% / 0.16), transparent 70%)' }}
          />
        </div>

        {/* Identity card — solid white scrim like the real ProfileHero */}
        <div className="px-4 sm:px-5 -mt-9 sm:-mt-11 relative">
          <div className="rounded-xl bg-white p-4 sm:p-5 shadow-lg">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="rounded-full ring-4 ring-white shadow-md shrink-0 -mt-7 sm:-mt-9">
                <InitialsAvatar name="Maya Okonkwo" size="lg" />
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-lg sm:text-xl font-bold leading-tight" style={{ color: '#17121F' }}>
                  Maya Okonkwo
                </p>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-sm font-medium" style={{ color: '#4B4453' }}>@maya-o</span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#1E8E4E]/30 bg-[#1E8E4E]/10 px-2 py-0.5 text-[11px] font-semibold text-[#17803D]">
                    <BadgeCheck className="h-3.5 w-3.5" /> Verified
                  </span>
                </div>
                <p className="text-xs sm:text-sm mt-1.5" style={{ color: '#4B4453' }}>
                  Year 12 · Riverside Secondary · London
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Achievements — each with a category and who verified it */}
        <div className="px-4 sm:px-5 pt-4 pb-4 space-y-2.5">
          {EXAMPLE_ACHIEVEMENTS.map((a) => (
            <div key={a.title} className="rounded-xl border border-border bg-secondary/50 p-3.5 flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <a.icon className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-foreground">{a.title}</p>
                  <span className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {a.category}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{a.org} · {a.date}</p>
                <p className="text-xs mt-1.5 flex items-center gap-1.5 text-success">
                  <BadgeCheck className="h-3.5 w-3.5 shrink-0" />
                  Verified by {a.verifiedBy}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* One working link to the full interactive example profile */}
        <div className="border-t border-border px-4 sm:px-5 py-3">
          <a
            href={createPageUrl('DemoProfile')}
            className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1.5"
          >
            View the full example profile
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </div>
  );
}