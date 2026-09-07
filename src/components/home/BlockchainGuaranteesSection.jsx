import React from 'react';
import { Link2, Lock, Network, ShieldCheck, FileSearch } from 'lucide-react';

const guarantees = [
  {
    icon: Lock,
    title: 'Cryptographically anchored',
    desc: 'Every approved credential is written to a public ledger (Polygon) via an on-chain transaction. Its hash, network and timestamp are permanently verifiable — the record cannot be edited or deleted by anyone, including BlockWard.',
  },
  {
    icon: ShieldCheck,
    title: 'Tamper-evident by design',
    desc: 'Any attempt to alter a credential — title, recipient, date, or issuing organisation — breaks the on-chain anchor instantly. Employers and universities can confirm authenticity independently, without contacting you.',
  },
  {
    icon: Network,
    title: 'Independent public verification',
    desc: 'Each credential ships with a public verification page and a transaction record viewable on the Polygon explorer. Third parties verify the anchor themselves — no accounts, no gatekeeping, no doubt.',
  },
  {
    icon: FileSearch,
    title: 'Institution-grade audit trail',
    desc: 'Signatures, signer identities, verification methods, and timestamps form a complete chain of custody from nomination to approval — alongside the on-chain record and Drive-archived evidence.',
  },
];

export default function BlockchainGuaranteesSection() {
  return (
    <section id="security" className="py-20 px-4 sm:px-6 lg:px-8 border-t border-border">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-sm text-primary font-medium mb-2">Security &amp; integrity</p>
          <h2 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight mb-3">
            Guaranteed by cryptography, not by promises
          </h2>
          <p className="text-base text-muted-foreground max-w-2xl mx-auto">
            Your organisation's credibility is the product. Here is exactly how we protect it.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {guarantees.map((g, i) => (
            <div
              key={i}
              className="card-hover p-6 rounded-xl bg-card/40 backdrop-blur-md border border-border"
            >
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <g.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-base font-medium text-foreground mb-2">{g.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{g.desc}</p>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
          <Link2 className="h-4 w-4 text-tertiary" />
          Students never see any of this complexity — they only see: Verified. Permanently recorded. Cannot be edited or deleted.
        </p>
      </div>
    </section>
  );
}