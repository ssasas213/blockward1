import React from 'react';
import {
  GraduationCap, Trophy, Swords, Dices, Gamepad2, Music, Building2, Heart,
} from 'lucide-react';

const industries = [
  { icon: GraduationCap, title: 'Education', examples: 'Schools, universities, academies' },
  { icon: Trophy, title: 'Sports Clubs', examples: 'Football, athletics, swimming' },
  { icon: Swords, title: 'Martial Arts', examples: 'BJJ, Judo, Karate, Taekwondo' },
  { icon: Dices, title: 'Chess Organisations', examples: 'Clubs, federations, tournaments' },
  { icon: Gamepad2, title: 'Esports Teams', examples: 'Tournaments, rankings, rosters' },
  { icon: Music, title: 'Music Academies', examples: 'Grade exams, recitals, awards' },
  { icon: Building2, title: 'Professional Orgs', examples: 'Certifications, training, CPD' },
  { icon: Heart, title: 'Community Programs', examples: 'Volunteering, youth, leadership' },
];

export default function IndustriesSection() {
  return (
    <section id="industries" className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-950 border-t border-white/10">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-sm text-slate-500 font-medium mb-2">Industries</p>
          <h2 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight mb-3">
            Not just schools. Any organisation.
          </h2>
          <p className="text-base text-slate-400 max-w-2xl mx-auto">
            BlockWard adapts to your organisation type — with custom roles, credential types, and approval workflows for each.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {industries.map((item, i) => (
            <div
              key={i}
              className="p-5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
            >
              <div className="h-10 w-10 rounded-lg bg-white/5 flex items-center justify-center mb-4">
                <item.icon className="h-5 w-5 text-slate-300" />
              </div>
              <h3 className="text-base font-medium text-white mb-1">{item.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{item.examples}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}