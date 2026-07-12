import React from 'react';
import { ShieldCheck, PenLine, HardDrive, Link2, Lock, History } from 'lucide-react';

const trustItems = [
  { icon: ShieldCheck, title: 'Tamper-Proof Records', desc: 'Every credential is cryptographically secured and can never be altered or erased.' },
  { icon: PenLine, title: 'Digital Signatures', desc: 'Verifiers and approvers sign with legally-binding digital signatures.' },
  { icon: HardDrive, title: 'Drive Archiving', desc: 'Records are permanently archived to each participant\'s own Google Drive.' },
  { icon: Lock, title: 'Blockchain Verification', desc: 'Credentials are minted on-chain, creating an immutable public record.' },
  { icon: Link2, title: 'Public Verification', desc: 'Universities and employers verify authenticity instantly via a unique link.' },
  { icon: History, title: 'Permanent History', desc: 'A portable, verified portfolio that travels with participants for life.' },
];

export default function TrustSection() {
  return (
    <section id="trust" className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-950 border-t border-white/10">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-sm text-slate-500 font-medium mb-2">Why BlockWard</p>
          <h2 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight mb-3">
            Built on trust, secured by design
          </h2>
          <p className="text-base text-slate-400 max-w-2xl mx-auto">
            Six pillars that make every achievement verifiable, permanent, and impossible to forge.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {trustItems.map((item, i) => (
            <div
              key={i}
              className="p-6 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
            >
              <div className="h-10 w-10 rounded-lg bg-white/5 flex items-center justify-center mb-4">
                <item.icon className="h-5 w-5 text-slate-300" />
              </div>
              <h3 className="text-base font-medium text-white mb-2">{item.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}