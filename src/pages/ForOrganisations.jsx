import React from 'react';
import { ArrowRight, CheckCircle2, PenTool, ShieldCheck, Users, FileSearch, Award, Undo2, History, Network, ExternalLink, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SiteHeader from '@/components/home/SiteHeader';
import SiteFooter from '@/components/home/SiteFooter';

const ORG_NAV = [
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Features', href: '#features' },
  { label: 'Security', href: '#security' },
];

const FLOW = [
  ['Register', 'Your organisation registers its Blockward account with name, website, official domain and contact email.'],
  ['Blockward verification', 'Blockward staff review the organisation. Only Approved organisations become Verified Issuers.'],
  ['Add authorised Verifiers', 'The Organisation Owner invites its Verifiers — the named people who review achievements.'],
  ['Define verification policies', 'Set how many signatures each credential type needs — single-Verifier or joint multi-Verifier.'],
  ['Holder requests verification', 'A Holder submits their achievement for your organisation to verify.'],
  ['Verifier(s) review and sign', 'Every signature is an explicit authorisation — stored signatures are never applied automatically.'],
  ['Polygon anchoring', 'A cryptographic commitment of the attested details is anchored to Polygon.'],
  ['Blockward Verified', 'The credential becomes Blockward Verified with a public link anyone can check.'],
];

const FEATURES = [
  { icon: ShieldCheck, title: 'Verified Issuer profile', text: 'A public issuer profile only after Blockward approval — a trust mark, not a self-declaration.' },
  { icon: Users, title: 'Authorised Verifiers', text: 'Named people with explicit authority to verify on your behalf, managed by the Organisation Owner.' },
  { icon: PenTool, title: 'Reusable secure signatures', text: 'Verifiers store their signature once — but every credential still requires their explicit approval.' },
  { icon: Users, title: 'Multi-Verifier policies', text: 'Require one signature, or two-of-two joint verification for high-assurance credentials.' },
  { icon: FileSearch, title: 'Verification queue', text: 'A live queue of holder requests with full evidence review before any signature.' },
  { icon: Award, title: 'Credential issuance', text: 'Approved requests become Blockward Verified credentials automatically.' },
  { icon: Undo2, title: 'Revocation', text: 'Revoke a compromised or issued-in-error credential. The on-chain record stays — the page shows REVOKED.' },
  { icon: History, title: 'Audit trail', text: 'Every event — invites, openings, signatures, thresholds, anchors — is timestamped and immutable.' },
  { icon: Network, title: 'Blockchain anchoring', text: 'Tamper-evident commitments on Polygon Amoy (testnet) during beta, Polygon PoS for production.' },
  { icon: ExternalLink, title: 'Public verification', text: 'Each credential gets a permanent public verification page — no account required to check it.' },
];

export default function ForOrganisations() {
  return (
    <div className="min-h-screen font-sans antialiased">
      <SiteHeader
        navLinks={ORG_NAV}
        onSignIn={() => (window.location.href = '/Login')}
        onGetStarted={() => (window.location.href = '/register-organisation')}
        ctaLabel="Register an Organisation"
      />

      {/* Hero */}
      <section className="relative py-28 px-4 sm:px-6 lg:px-8 accent-glow overflow-hidden">
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/50 px-4 py-1.5 text-xs text-muted-foreground mb-8">
            <Building2 className="h-3.5 w-3.5 text-primary" /> For issuer organisations
          </div>
          <h1 className="text-4xl sm:text-6xl font-bold text-foreground tracking-tight leading-[1.05]">
            Turn your achievements into <span className="text-brand-gradient">credentials people can independently verify.</span>
          </h1>
          <p className="text-lg text-muted-foreground mt-6 max-w-2xl mx-auto leading-relaxed">
            Certificates, awards, completions and wins — issued under your organisation's authority, signed by
            your authorised verifiers, and cryptographically secured so no one — not even Blockward — can alter them.
          </p>
          <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" className="text-base px-8 h-12" onClick={() => (window.location.href = '/register-organisation')}>
              Register an Organisation <ArrowRight className="ml-1 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" className="text-base px-8 h-12" onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}>
              How it works
            </Button>
          </div>
        </div>
      </section>

      {/* The flow */}
      <section id="how-it-works" className="py-24 px-4 sm:px-6 lg:px-8 border-t border-border">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-semibold text-foreground tracking-tight text-center">From registration to Blockward Verified</h2>
          <div className="mt-14 space-y-0">
            {FLOW.map(([title, text], i) => (
              <div key={title} className="relative flex gap-5 pb-8 last:pb-0">
                {i < FLOW.length - 1 && <span className="absolute left-[15px] top-9 bottom-0 w-px bg-border" />}
                <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/25 flex items-center justify-center flex-shrink-0 z-10">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{title}</h3>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed max-w-2xl">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 border-t border-border">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-semibold text-foreground tracking-tight text-center">Everything an issuer needs</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-14">
            {FEATURES.map((f) => (
              <div key={f.title} className="surface-card rounded-2xl p-6 card-hover">
                <div className="h-11 w-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section id="security" className="py-24 px-4 sm:px-6 lg:px-8 border-t border-border">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-semibold text-foreground tracking-tight">Your authority. Your verifiers. On-chain proof.</h2>
          <p className="text-base text-muted-foreground mt-4 max-w-xl mx-auto">
            Register your organisation, add your verifiers, and start issuing credentials people can trust
            without taking your — or our — word for it.
          </p>
          <Button size="lg" className="text-base px-8 h-12 mt-8" onClick={() => (window.location.href = '/register-organisation')}>
            Register an Organisation <ArrowRight className="ml-1 h-5 w-5" />
          </Button>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}