import React, { useState } from 'react';
import { ArrowRight, Award, BookOpen, Briefcase, Check, GraduationCap, Trophy } from 'lucide-react';
import Reveal from '@/components/home/Reveal';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'Academic', label: 'Academic' },
  { key: 'Professional', label: 'Professional' },
  { key: 'Competitions', label: 'Competitions' },
  { key: 'Courses', label: 'Courses' },
  { key: 'Awards', label: 'Awards' },
];

const ITEMS = [
  { icon: Briefcase, title: 'AWS Cloud Practitioner', issuer: 'Amazon Web Services', cat: 'Professional' },
  { icon: Trophy, title: 'Mathematics Competition — Gold', issuer: 'Organisation', cat: 'Competitions' },
  { icon: BookOpen, title: 'AI Engineering Challenge', issuer: 'Company', cat: 'Courses' },
  { icon: Award, title: 'Leadership Programme', issuer: 'Organisation', cat: 'Awards' },
  { icon: GraduationCap, title: 'Top of Class — Physics', issuer: 'School', cat: 'Academic' },
];

const FILTER_ICON = { Academic: GraduationCap, Professional: Briefcase, Competitions: Trophy, Courses: BookOpen, Awards: Award };

export default function ProfileShowcase() {
  const [filter, setFilter] = useState('all');
  const shown = filter === 'all' ? ITEMS : ITEMS.filter((i) => i.cat === filter);

  return (
    <section className="mkt-light py-20 sm:py-28 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <Reveal>
          <div>
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight mkt-ink uppercase leading-[1.1]">
              One place for everything you've actually achieved.
            </h2>
            <p className="text-base sm:text-lg mkt-sub mt-6 leading-relaxed">
              Different organisations. Different stages of your life. One verified record.
            </p>
            <button
              onClick={() => (window.location.href = '/Signup')}
              className="mt-8 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:shadow-lg"
            >
              Build Your Profile <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          {/* Profile preview */}
          <div className="mkt-card rounded-2xl p-6 shadow-lg">
            <div className="flex items-center gap-4 pb-5 border-b border-slate-200">
              <div className="h-12 w-12 rounded-full bg-brand-gradient text-white font-bold flex items-center justify-center">
                M
              </div>
              <div>
                <p className="text-base font-semibold mkt-ink">Mazen Example</p>
                <p className="text-sm mkt-sub">Engineering Student</p>
              </div>
            </div>

            {/* Category filters */}
            <div className="flex flex-wrap gap-1.5 mt-5">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-all ${
                    filter === f.key
                      ? 'bg-slate-900 border-slate-900 text-white'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-400'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="mt-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider mkt-sub mb-2">Verified achievements</p>
              <div className="space-y-2">
                {shown.map((item) => {
                  const Icon = FILTER_ICON[item.cat] || item.icon;
                  return (
                    <div key={item.title} className="flex items-center gap-3 rounded-lg bg-slate-50 border border-slate-200 px-4 py-3">
                      <span className="h-7 w-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                        <Icon className="h-3.5 w-3.5 text-primary" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium mkt-ink truncate">{item.title}</p>
                        <p className="text-xs mkt-sub truncate">{item.issuer}</p>
                      </div>
                      <Check className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}