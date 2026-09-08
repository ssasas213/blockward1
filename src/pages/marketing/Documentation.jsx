import React, { useEffect } from 'react';
import { FileText, ShieldCheck, PenTool, Award, Link2, Users, AtSign, Briefcase } from 'lucide-react';
import MarketingShell from '@/components/marketing/MarketingShell';

const LIFECYCLE = [
  { icon: FileText, title: '1. Achievement created', desc: 'A student requests verification of something they did, or a staff member records an award — with evidence attached in either case.' },
  { icon: ShieldCheck, title: '2. Verification', desc: 'The nominated verifier reviews the evidence. An organisation admin gives second approval for higher-assurance credentials. Tier 3 adds an independent external verifier.' },
  { icon: PenTool, title: '3. Signed', desc: 'Each reviewer signs with a typed or drawn digital signature, records how they verified it, and the attestation is timestamped.' },
  { icon: Award, title: '4. Permanently recorded', desc: 'The approved credential is written to a public ledger and delivered to the student\'s vault. It cannot be edited or deleted afterwards.' },
  { icon: Link2, title: '5. Shared & checked', desc: 'The student shares their profile or a verification link. Any third party checks the full record at /verify in under a minute — no account needed.' },
];

const TIERS = [
  { tier: 'Tier 1', title: 'Nominated verifier', desc: 'One named staff member — the coach, teacher or examiner who witnessed or reviewed the achievement — signs off. Right for day-to-day awards.' },
  { tier: 'Tier 2', title: 'Verifier + organisation admin', desc: 'The verifier signs, then a different organisation admin independently approves. Right for significant credentials like leadership roles and championships.' },
  { tier: 'Tier 3', title: 'Verifier + admin + external verifier', desc: 'Both internal sign-offs, plus an independent third party (examiner, federation officer, event organiser) confirms via a one-time secure link. Right for credentials where the stakes are highest.' },
];

export default function Documentation() {
  useEffect(() => { document.title = 'Documentation — BlockWard'; }, []);

  return (
    <MarketingShell
      title="How BlockWard works, end to end."
      subtitle="The credential lifecycle, verification tiers, sharing model and public verification — written for the people who have to explain it to someone else."
    >
      {/* Lifecycle */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-semibold text-foreground tracking-tight mb-8">The credential lifecycle</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {LIFECYCLE.map((s, i) => (
              <div key={i} className="p-6 rounded-xl bg-card  border border-border">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <s.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-base font-medium text-foreground">{s.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Verification tiers */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 border-t border-border">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-semibold text-foreground tracking-tight mb-3">Verification tiers</h2>
          <p className="text-base text-muted-foreground mb-8 max-w-2xl">
            Organisations choose how much assurance each type of credential requires. More signers, more scrutiny.
          </p>
          <div className="space-y-4">
            {TIERS.map((t) => (
              <div key={t.tier} className="flex flex-col sm:flex-row sm:items-start gap-4 p-5 rounded-xl bg-card  border border-border">
                <span className="inline-flex px-2.5 py-1 rounded-md bg-primary/10 border border-primary/20 text-xs font-semibold text-primary w-fit flex-shrink-0">{t.tier}</span>
                <div>
                  <h3 className="text-base font-medium text-foreground">{t.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mt-1">{t.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Core concepts */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 border-t border-border">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-semibold text-foreground tracking-tight mb-8">Core concepts</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-6 rounded-xl bg-card  border border-border">
              <AtSign className="h-5 w-5 text-primary mb-3" />
              <h3 className="text-base font-medium text-foreground mb-2">Handles &amp; public profiles</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Every student gets a unique handle — like <span className="font-mono text-foreground">@maya-o</span> — at a
                permanent public URL. They choose what appears there, and can pin up to six highlights. Old handles
                redirect, so links never break.
              </p>
            </div>
            <div className="p-6 rounded-xl bg-card  border border-border">
              <Users className="h-5 w-5 text-primary mb-3" />
              <h3 className="text-base font-medium text-foreground mb-2">Team credentials</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                One verification covers a whole team. Each teammate gets their own personal copy of the credential with
                their role on it — but only after they consent to being listed on the shared team record.
              </p>
            </div>
            <div className="p-6 rounded-xl bg-card  border border-border">
              <ShieldCheck className="h-5 w-5 text-primary mb-3" />
              <h3 className="text-base font-medium text-foreground mb-2">Peer endorsements</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Members can vouch for a specific achievement of a peer, in their own words. Each member gets a small,
                per-term budget — no roll-over, never anonymous — so an endorsement always means something.
              </p>
            </div>
            <div className="p-6 rounded-xl bg-card  border border-border">
              <Briefcase className="h-5 w-5 text-primary mb-3" />
              <h3 className="text-base font-medium text-foreground mb-2">Opportunities</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Organisations post internships, competitions, trials and scholarships. Students apply with their verified
                credentials attached — no CV claims — and their matches are shown before they apply.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* For verifiers / IT */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 border-t border-border">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-semibold text-foreground tracking-tight mb-6">Checking a credential yourself</h2>
          <p className="text-base text-muted-foreground leading-relaxed mb-4">
            Every credential has a public ID in the format <span className="font-mono text-foreground">BW-YEAR-CODE</span>.
            The candidate can share it — or a full link — as text, email or PDF. Paste either into the public
            verification tool and you'll see the credential, the issuing organisation, every signer with their role and
            verification method, the full timestamp chain, and the blockchain record with its public explorer link.
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>· No BlockWard account is required to verify a credential.</li>
            <li>· A revoked credential is clearly marked as invalid — revocation is permanent and visible.</li>
            <li>· Verification pages never expose the student's email or private contact details.</li>
          </ul>
          <a href="/verify" className="inline-flex items-center gap-1.5 mt-6 text-sm font-medium text-primary hover:underline">
            Open the public verification tool →
          </a>
        </div>
      </section>
    </MarketingShell>
  );
}