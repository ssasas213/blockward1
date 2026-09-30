import React from 'react';
import {
  Award, BadgeCheck, BookOpen, Briefcase, Building2, Crown,
  Dumbbell, GraduationCap, HeartHandshake, Target, Trophy, Users,
} from 'lucide-react';
import Reveal from '@/components/home/Reveal';

const CASES = [
  { icon: Briefcase, label: 'Professional Certifications' },
  { icon: GraduationCap, label: 'Academic Awards' },
  { icon: Trophy, label: 'Competitions' },
  { icon: BookOpen, label: 'Courses' },
  { icon: Dumbbell, label: 'Training' },
  { icon: Building2, label: 'Company Programmes' },
  { icon: Target, label: 'Sports' },
  { icon: Crown, label: 'Leadership' },
  { icon: HeartHandshake, label: 'Volunteering' },
  { icon: Users, label: 'Memberships' },
  { icon: BadgeCheck, label: 'Qualifications' },
  { icon: Award, label: 'Awards' },
];

export default function UseCases() {
  return (
    <section className="mkt-light py-20 sm:py-28 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <div className="text-center max-w-3xl mx-auto mb-14">
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight mkt-ink uppercase leading-[1.1]">
              One verification standard. Any achievement.
            </h2>
            <p className="text-base sm:text-lg mkt-sub mt-5 leading-relaxed">
              Blockward isn't built around one school, employer or certificate provider.
            </p>
            <p className="text-base mkt-ink font-medium mt-2">
              Your achievements come from everywhere. Your proof shouldn't have to.
            </p>
          </div>
        </Reveal>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">
          {CASES.map((c, i) => (
            <Reveal key={c.label} delay={(i % 4) * 0.05}>
              <div className="mkt-card mkt-card-hover rounded-xl px-5 py-5 flex items-center gap-3">
                <span className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                  <c.icon className="h-4 w-4 text-primary" />
                </span>
                <span className="text-sm font-medium mkt-ink leading-tight">{c.label}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}