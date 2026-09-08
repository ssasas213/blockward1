import React, { useEffect } from 'react';
import { Lock, PenTool, Network, Database, Eye } from 'lucide-react';
import MarketingShell from '@/components/marketing/MarketingShell';

const PILLARS = [
  {
    icon: PenTool,
    title: 'A complete chain of custody',
    desc: 'Every credential records who nominated it, who verified it, how they verified it (in person, from evidence, against official records, or with a third party), and exactly when each step happened. Signatures are attributed to named individuals — never to a vague department.',
  },
  {
    icon: Network,
    title: 'Anchored to a public ledger',
    desc: 'Approved credentials are written to a public ledger (Polygon network). The transaction hash, network and timestamp are shown on every verification page, with a link to a public explorer so anyone can confirm the anchor independently — including after the issuing organisation stops using BlockWard.',
  },
  {
    icon: Lock,
    title: 'Records cannot be quietly changed',
    desc: 'Once verified, a credential cannot be edited or deleted — by the student, the organisation, or BlockWard. If an achievement turns out to be wrong, the only recourse is visible, permanent revocation. There is no invisible back door.',
  },
  {
    icon: Database,
    title: 'Data isolation by default',
    desc: 'Each organisation only ever sees its own members and records. Students control the visibility of their public profile — public, link-only, or private — and verification pages expose only public-safe fields, never private contact details.',
  },
];

export default function Security() {
  useEffect(() => { document.title = 'Security — BlockWard'; }, []);

  return (
    <MarketingShell
      title="Security you can check yourself."
      subtitle="BlockWard's value rests on records that can't be forged or quietly altered. Here is exactly how that works — and how to confirm it without trusting us."
    >
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PILLARS.map((p, i) => (
            <div key={i} className="card-hover p-6 rounded-xl bg-card border border-border">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <p.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-base font-medium text-foreground mb-2">{p.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="py-16 px-4 sm:px-6 lg:px-8 border-t border-border">
        <div className="max-w-3xl mx-auto space-y-8">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold text-foreground tracking-tight mb-3">
              <Eye className="h-5 w-5 text-primary" /> Verify it yourself, right now
            </h2>
            <p className="text-base text-muted-foreground leading-relaxed">
              Pick any credential a candidate shares with you, open its verification page, and click through to the
              public explorer link in the blockchain record section. What you see there is anchored on the ledger —
              outside our control. That's the point.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-foreground tracking-tight mb-3">What we never do</h2>
            <ul className="space-y-2.5 text-base text-muted-foreground leading-relaxed">
              <li>· Never edit or delete a verified credential behind the scenes.</li>
              <li>· Never sell or share student data with advertisers or data brokers.</li>
              <li>· Never expose a student's private contact details on a public page.</li>
              <li>· Never allow anonymous endorsements or signatures — accountability is a feature.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-foreground tracking-tight mb-3">Found an issue?</h2>
            <p className="text-base text-muted-foreground leading-relaxed">
              If you believe you've found a security or integrity problem, tell us directly through the contact page —
              mark it "Verification help" or "Press &amp; partnerships" and include details. We take every report seriously.
            </p>
            <a href="/contact" className="inline-flex items-center gap-1.5 mt-4 text-sm font-medium text-primary hover:underline">
              Contact us →
            </a>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}