import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, PenLine, HardDrive, Link2, Lock, History } from 'lucide-react';

const trustItems = [
  { icon: ShieldCheck, title: 'Tamper-Proof Records', desc: 'Every credential is cryptographically secured and can never be altered or erased.' },
  { icon: PenLine, title: 'Digital Signatures', desc: 'Verifiers and approvers sign with legally-binding digital signatures.' },
  { icon: HardDrive, title: 'Google Drive Archiving', desc: 'Records are permanently archived to each participant\'s own Google Drive.' },
  { icon: Lock, title: 'Blockchain Verification', desc: 'Credentials are minted on-chain, creating an immutable public record.' },
  { icon: Link2, title: 'Public Verification Links', desc: 'Universities and employers verify authenticity instantly via a unique link.' },
  { icon: History, title: 'Permanent Achievement History', desc: 'A portable, verified portfolio that travels with participants for life.' },
];

export default function TrustSection() {
  return (
    <section id="trust" className="relative py-24 px-4 sm:px-6 lg:px-8 bg-slate-950 border-t border-white/5">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-sm font-semibold text-violet-400 uppercase tracking-widest mb-3">Why BlockWard</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 tracking-tight">
              Built on trust, secured by design
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Six pillars that make every achievement verifiable, permanent, and impossible to forge.
            </p>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {trustItems.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="group relative p-6 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-sm hover:bg-white/[0.06] hover:border-violet-500/30 transition-all duration-300"
            >
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-600/0 to-indigo-600/0 group-hover:from-violet-600/5 group-hover:to-indigo-600/5 transition-all duration-300" />
              <div className="relative">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/20 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                  <item.icon className="h-6 w-6 text-violet-300" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{item.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}