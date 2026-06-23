import React from 'react';
import { motion } from 'framer-motion';
import { FileText, Search, PenLine, ShieldCheck, HardDrive, Link2, ArrowDown } from 'lucide-react';

const steps = [
  { icon: FileText, title: 'Achievement Created', desc: 'A teacher, coach, instructor, or manager creates a record with supporting evidence.' },
  { icon: Search, title: 'Verification', desc: 'Evidence is reviewed and validated by the responsible verifier.' },
  { icon: PenLine, title: 'Digital Signatures', desc: 'Authorised individuals sign the record with their digital signature.' },
  { icon: ShieldCheck, title: 'Approval', desc: 'The organisation authorises the achievement, completing the trust chain.' },
  { icon: HardDrive, title: 'Permanent Archive', desc: 'Stored securely in Google Drive and on the BlockWard blockchain.' },
  { icon: Link2, title: 'Public Verification', desc: 'Universities, employers, and organisations can verify authenticity instantly.' },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="relative py-24 px-4 sm:px-6 lg:px-8 bg-slate-900 border-t border-white/5">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-20">
          <p className="text-sm font-semibold text-violet-400 uppercase tracking-widest mb-3">How it works</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 tracking-tight">
            From achievement to permanent record
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            A six-stage verification lifecycle that turns any accomplishment into a trusted, verifiable credential.
          </p>
        </div>

        <div className="relative">
          {/* vertical line */}
          <div className="absolute left-6 sm:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-violet-500/0 via-violet-500/40 to-violet-500/0 sm:-translate-x-1/2" />

          {steps.map((step, i) => {
            const isLeft = i % 2 === 0;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.5 }}
                className={`relative flex items-center mb-12 last:mb-0 ${isLeft ? 'sm:justify-start' : 'sm:justify-end'}`}
              >
                {/* node */}
                <div className="absolute left-6 sm:left-1/2 -translate-x-1/2 z-10">
                  <div className="h-12 w-12 rounded-full bg-slate-900 border-2 border-violet-500/50 flex items-center justify-center shadow-lg shadow-violet-500/20">
                    <step.icon className="h-5 w-5 text-violet-300" />
                  </div>
                </div>

                {/* card */}
                <div className={`ml-20 sm:ml-0 sm:w-[calc(50%-3rem)] ${isLeft ? 'sm:pr-0' : 'sm:pl-0'}`}>
                  <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-sm hover:border-violet-500/30 transition-colors duration-300">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-xs font-mono text-violet-400">0{i + 1}</span>
                      <span className="h-px flex-1 bg-white/10" />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">{step.title}</h3>
                    <p className="text-sm text-slate-400 leading-relaxed">{step.desc}</p>
                  </div>
                </div>

                {i < steps.length - 1 && (
                  <ArrowDown className="hidden sm:block absolute left-1/2 -translate-x-1/2 -bottom-7 h-4 w-4 text-violet-500/40" />
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}