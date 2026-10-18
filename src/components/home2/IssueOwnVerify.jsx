import React from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import Reveal from '@/components/home/Reveal';

// Issue. Own. Verify. — the three concepts, each with a small purposeful
// demonstration. Illustrative data only; no real organisations implied.

function IssueArtifact() {
  return (
    <div className="w-full max-w-[340px] rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <p className="text-[10px] uppercase tracking-widest text-white/45 mb-4">Issuing</p>
      <div className="rounded-xl border border-white/10 p-4">
        <p className="text-[13px] font-medium text-white">National Robotics Championship</p>
        <p className="text-[11px] text-white/45 mt-1">Evidence reviewed · certificate.pdf</p>
      </div>
      <div className="mt-3 rounded-xl border border-primary/25 bg-primary/[0.06] p-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-[13px] text-white">Dr. Amira Haddad</p>
          <p className="text-[11px] text-white/45">Head of Robotics · Authorised Verifier</p>
        </div>
        <span className="text-2xl text-white/90 -rotate-6 flex-shrink-0" style={{ fontFamily: "'Snell Roundhand', cursive" }}>
          A. Haddad
        </span>
      </div>
      <p className="mt-3 flex items-center gap-2 text-[11px] text-white/50">
        <Check className="h-3.5 w-3.5 text-primary" />
        Credential issued · 12 March 2026
      </p>
    </div>
  );
}

function OwnArtifact() {
  const rows = [
    ['National Robotics Championship', 'Meridian Institute of Technology', true],
    ['Advanced Lifeguard Certification', 'Northgate Aquatics', true],
    ['Young Enterprise Award', 'Halcyon Business Trust', false],
  ];
  return (
    <div className="w-full max-w-[340px] rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] uppercase tracking-widest text-white/45">Your Vault</p>
        <span className="font-mono text-[10px] text-white/35">example</span>
      </div>
      <div className="space-y-2.5">
        {rows.map(([t, o, ok]) => (
          <div key={t} className="rounded-xl border border-white/10 p-3.5 flex items-center gap-3">
            <span className={`h-2 w-2 rounded-full flex-shrink-0 ${ok ? 'bg-success' : 'bg-warning'}`} />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] text-white truncate">{t}</p>
              <p className="text-[11px] text-white/45">{o}</p>
            </div>
            {ok && <Check className="h-3.5 w-3.5 text-white/40 flex-shrink-0" />}
          </div>
        ))}
      </div>
    </div>
  );
}

function VerifyArtifact() {
  const checks = ['Issuer verified', 'Status active', 'Integrity confirmed'];
  return (
    <div className="w-full max-w-[340px] rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <p className="text-[10px] uppercase tracking-widest text-white/45 mb-4">Verification result</p>
      <div className="space-y-3">
        {checks.map((c, i) => (
          <motion.div
            key={c}
            initial={{ opacity: 0, x: -8 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ delay: 0.15 + i * 0.18, duration: 0.4 }}
            className="flex items-center gap-3 text-[13px] text-white"
          >
            <span className="h-5 w-5 rounded-full bg-primary/15 border border-primary/40 flex items-center justify-center flex-shrink-0">
              <Check className="h-3 w-3" />
            </span>
            {c}
          </motion.div>
        ))}
      </div>
      <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
        <span className="text-[13px] font-semibold text-white">Authentic</span>
        <span className="font-mono text-[10px] text-white/40">Polygon PoS</span>
      </div>
    </div>
  );
}

const CONCEPTS = [
  {
    id: 'issue',
    n: '01',
    kicker: 'For organisations',
    title: 'Issue',
    body: 'Turn achievements into credentials your organisation stands behind. Authorised verifiers review the evidence and sign; BlockWard records exactly who verified what, and when.',
    artifact: <IssueArtifact />,
  },
  {
    id: 'own',
    n: '02',
    kicker: 'For individuals',
    title: 'Own',
    body: 'Every verified credential lives in your Vault — a permanent, portable record you control. Share one achievement or your whole profile with a single link.',
    artifact: <OwnArtifact />,
  },
  {
    id: null,
    n: '03',
    kicker: 'For employers & universities',
    title: 'Verify',
    body: 'No phone calls, no chasing PDFs. Open the link and see the issuer, the credential\u2019s current status, and an integrity check against its on-chain anchor.',
    artifact: <VerifyArtifact />,
  },
];

export default function IssueOwnVerify() {
  return (
    <section className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <div className="max-w-2xl mb-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-4">Three ideas, one system</p>
            <h2 className="font-display font-black text-4xl sm:text-6xl text-white leading-[1.05] tracking-tight">
              Issue. Own. Verify.
            </h2>
          </div>
        </Reveal>
        {CONCEPTS.map((c, i) => (
          <div
            key={c.n}
            id={c.id || undefined}
            className="grid lg:grid-cols-2 gap-10 lg:gap-20 items-center py-16 sm:py-20 border-t border-white/10 scroll-mt-24"
          >
            <div className={i % 2 === 1 ? 'lg:order-2' : ''}>
              <p className="font-mono text-xs tracking-[0.25em] text-white/35 mb-4">
                {c.n} — {c.kicker}
              </p>
              <h3 className="font-display text-3xl sm:text-5xl text-white mb-5 tracking-tight">{c.title}</h3>
              <p className="text-white/60 leading-relaxed max-w-md">{c.body}</p>
            </div>
            <div className={`flex justify-center ${i % 2 === 1 ? 'lg:order-1 lg:justify-end' : 'lg:justify-start'}`}>
              {c.artifact}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}