import React from 'react';
import { motion } from 'framer-motion';
import { Quote, Star } from 'lucide-react';

const testimonials = [
  {
    quote: "BlockWard transformed how we recognise student achievement. Parents love the transparency and universities respect the verification.",
    name: 'Dr. Sarah Mitchell',
    role: 'Principal, St. Mary\'s Academy',
  },
  {
    quote: "Our athletes now carry a verified digital record of every grading and medal. It gives them a real edge in college applications.",
    name: 'Coach Daniel Reyes',
    role: 'Head Instructor, Apex Martial Arts',
  },
  {
    quote: "The blockchain verification gives employers confidence that a candidate's certifications are genuine. It's a game changer.",
    name: 'Priya Nair',
    role: 'Director, Global Training Institute',
  },
];

const logos = ['St. Mary\'s Academy', 'Apex Martial Arts', 'Global Chess Federation', 'Vanguard Sports Club', 'Harmony Music Academy', 'Nexus STEM Institute'];

export default function SocialProof() {
  return (
    <section className="relative py-24 px-4 sm:px-6 lg:px-8 bg-slate-900 border-t border-white/5">
      <div className="max-w-7xl mx-auto">
        {/* logos */}
        <div className="text-center mb-20">
          <p className="text-sm text-slate-500 mb-8 uppercase tracking-widest font-medium">Trusted by organisations worldwide</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6">
            {logos.map((logo, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.06 }}
                className="flex items-center justify-center"
              >
                <span className="text-sm font-semibold text-slate-500 hover:text-slate-300 transition-colors text-center">{logo}</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* testimonials */}
        <div className="text-center mb-14">
          <p className="text-sm font-semibold text-violet-400 uppercase tracking-widest mb-3">Social Proof</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 tracking-tight">
            Loved by educators and organisations
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="p-7 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-sm hover:border-violet-500/20 transition-colors duration-300"
            >
              <Quote className="h-8 w-8 text-violet-500/40 mb-4" />
              <p className="text-slate-300 leading-relaxed mb-6">{t.quote}</p>
              <div className="flex items-center gap-1 mb-4">
                {Array.from({ length: 5 }).map((_, s) => (
                  <Star key={s} className="h-4 w-4 fill-violet-400 text-violet-400" />
                ))}
              </div>
              <div>
                <p className="font-semibold text-white">{t.name}</p>
                <p className="text-sm text-slate-500">{t.role}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}