import React from 'react';
import { motion } from 'framer-motion';
import { Award, HardDrive, PenLine, GraduationCap, Building2, Globe } from 'lucide-react';
import AnimatedCounter from './AnimatedCounter';

const stats = [
  { icon: Award, value: 125000, suffix: '+', label: 'Achievements Verified' },
  { icon: HardDrive, value: 98000, suffix: '+', label: 'Records Archived' },
  { icon: PenLine, value: 310000, suffix: '+', label: 'Digital Signatures' },
  { icon: GraduationCap, value: 450, suffix: '+', label: 'Schools Using BlockWard' },
  { icon: Building2, value: 1200, suffix: '+', label: 'Organisations Using BlockWard' },
  { icon: Globe, value: 24, suffix: '', label: 'Countries Supported' },
];

export default function StatisticsSection() {
  return (
    <section className="relative py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-violet-950 via-slate-950 to-indigo-950 border-t border-white/5 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(124,58,237,0.15),transparent_60%)]" />
      <div className="relative max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-sm font-semibold text-violet-400 uppercase tracking-widest mb-3">By the numbers</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 tracking-tight">
            Trusted at scale
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            Organisations worldwide rely on BlockWard to verify and preserve what matters.
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-5">
          {stats.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: (i % 3) * 0.1 }}
              className="p-8 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-md text-center hover:border-violet-500/30 transition-colors duration-300"
            >
              <div className="inline-flex h-12 w-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/20 items-center justify-center mb-5">
                <stat.icon className="h-6 w-6 text-violet-300" />
              </div>
              <p className="text-4xl sm:text-5xl font-extrabold text-white mb-2 tracking-tight">
                <AnimatedCounter value={stat.value} suffix={stat.suffix} />
              </p>
              <p className="text-sm text-slate-400">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}