import React from 'react';
import { ShieldCheck, PenLine, UserRound, Link2, Lock, History } from 'lucide-react';

const trustItems = [
  { icon: ShieldCheck, title: 'Tamper-evident records', desc: 'Every credential carries a cryptographic fingerprint anchored on a public ledger — any change to the record is immediately detectable.' },
  { icon: PenLine, title: 'Digital signatures', desc: 'Typed or drawn signatures with full signer attribution and an audit trail.' },
  { icon: UserRound, title: 'Student-owned records', desc: 'Each member owns a portable record of what they earned — the organisation verifies it, but never holds it hostage.' },
  { icon: Lock, title: 'Independently checkable', desc: 'Once verified, anyone can check a credential against its public verification page and on-chain anchor — no account, no phone call.' },
  { icon: Link2, title: 'Public verification', desc: 'Universities and employers verify authenticity instantly via a unique link.' },
  { icon: History, title: 'Portable history', desc: 'A portable, verified portfolio that travels with participants across schools, clubs and employers.' },
];

export default function TrustSection() {
  return (
    <section id="trust" className="py-20 px-4 sm:px-6 lg:px-8 border-t border-border">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-sm text-primary font-medium mb-2">Why BlockWard</p>
          <h2 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight mb-3">
            Built on trust, secured by design
          </h2>
          <p className="text-base text-muted-foreground max-w-2xl mx-auto">
            Six pillars that make every achievement verifiable, portable, and independently checkable.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {trustItems.map((item, i) => (
            <div
              key={i}
              className="card-hover p-6 rounded-xl bg-card border border-border"
            >
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <item.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-base font-medium text-foreground mb-2">{item.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}