import React from 'react';
import { motion } from 'framer-motion';
import {
  GraduationCap, Trophy, Swords, Dices, Gamepad2, Music, Building2, Heart,
} from 'lucide-react';

const industries = [
  { icon: GraduationCap, emoji: '🏫', title: 'Education', examples: 'Schools, universities, academies', color: 'from-blue-500 to-indigo-500' },
  { icon: Trophy, emoji: '🏆', title: 'Sports Clubs', examples: 'Football, athletics, swimming', color: 'from-emerald-500 to-teal-500' },
  { icon: Swords, emoji: '🥋', title: 'Martial Arts Academies', examples: 'BJJ, Judo, Karate, Taekwondo', color: 'from-red-500 to-orange-500' },
  { icon: Dices, emoji: '♟', title: 'Chess Organisations', examples: 'Clubs, federations, tournaments', color: 'from-amber-500 to-yellow-500' },
  { icon: Gamepad2, emoji: '🎮', title: 'Esports Teams', examples: 'Tournaments, rankings, rosters', color: 'from-fuchsia-500 to-pink-500' },
  { icon: Music, emoji: '🎵', title: 'Music Academies', examples: 'Grade exams, recitals, awards', color: 'from-violet-500 to-purple-500' },
  { icon: Building2, emoji: '🏢', title: 'Professional Organisations', examples: 'Certifications, training, CPD', color: 'from-slate-400 to-slate-600' },
  { icon: Heart, emoji: '🌍', title: 'Community Programs', examples: 'Volunteering, youth, leadership', color: 'from-cyan-500 to-blue-500' },
];

export default function IndustriesSection() {
  return (
    <section id="industries" className="relative py-24 px-4 sm:px-6 lg:px-8 bg-slate-950 border-t border-white/5">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-sm font-semibold text-violet-400 uppercase tracking-widest mb-3">Industries</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 tracking-tight">
            Not just schools. Any organisation.
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            BlockWard adapts to your organisation type — with custom roles, credential types, and approval workflows for each.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {industries.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: (i % 4) * 0.07 }}
              whileHover={{ y: -6 }}
              className="group relative p-6 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-sm hover:border-white/20 transition-all duration-300 overflow-hidden"
            >
              <div className={`absolute -top-12 -right-12 h-32 w-32 rounded-full bg-gradient-to-br ${item.color} opacity-0 group-hover:opacity-20 blur-2xl transition-opacity duration-500`} />
              <div className="relative">
                <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                  <item.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-base font-semibold text-white mb-1.5">{item.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{item.examples}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}