import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, MessagesSquare, ShieldCheck, Share2, Building2, Users, Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import GlowActionButton from '@/components/ui/GlowActionButton';

// BlockTalks — BlockWard's professional achievement-sharing platform.
// Public introductory page: explains the upcoming feature while keeping the
// same premium dark aesthetic as the homepage. No fake content — everything
// here describes what BlockTalks will do, clearly framed as coming soon.

const PREVIEWS = [
  {
    icon: Share2,
    title: 'Share verified achievements',
    copy: 'Turn any Blockward Verified credential into a polished share card — professional, celebration, academic or minimal — ready for LinkedIn, Instagram and beyond.',
  },
  {
    icon: MessagesSquare,
    title: 'Where achievements start conversations',
    copy: 'Post verified wins to a professional feed built for substance: recruiters, admissions officers and peers see real, tamper-evident proof — not self-declared claims.',
  },
  {
    icon: Building2,
    title: 'Organisation recognition',
    copy: 'Issuing organisations celebrate and recognise verified achievements publicly, adding institutional weight to every credential on the feed.',
  },
];

const PRINCIPLES = [
  { icon: ShieldCheck, label: 'Only Blockward Verified credentials can be shared' },
  { icon: Users, label: 'Sharing is always explicit — achievements are never auto-published' },
  { icon: Sparkles, label: 'Anchor-backed proof travels with every post' },
];

export default function BlockTalks() {
  return (
    <div className="min-h-screen font-sans antialiased bg-[#0A0F1A] text-white">
      {/* Simple top bar — back to the main site */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#0A0F1A]/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2">
            <span className="font-display text-lg font-bold tracking-tight">BlockTalks</span>
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[12px] font-semibold text-primary">Coming soon</span>
          </Link>
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-white/70 transition-colors hover:text-white">
            Back to Blockward <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden pt-32 pb-20 sm:pt-40">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 60% 45% at 50% 0%, rgba(37, 99, 235, 0.16), transparent 65%)',
          }}
        />
        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-primary">
            <MessagesSquare className="h-3.5 w-3.5" /> A BlockWard platform
          </p>
          <h1 className="font-display text-5xl font-black leading-[1.05] tracking-tight sm:text-6xl">
            BlockTalks
          </h1>
          <p className="mt-4 font-display text-xl text-primary sm:text-2xl">Where achievements start conversations.</p>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-white/70">
            The professional network for verified achievement. BlockTalks turns your Blockward
            Verified credentials into shareable, tamper-evident proof — so every win you post is
            one a university, employer or organisation can independently check.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <GlowActionButton
              icon={Sparkles}
              label="Get Started"
              subtitle="Create your Blockward profile"
              onClick={() => (window.location.href = '/Signup')}
            />
            <Button
              size="lg"
              variant="outline"
              className="h-12 bg-transparent px-8 text-base text-white border-white/20 hover:bg-white/5"
              asChild
            >
              <Link to="/">Explore BlockWard</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* What BlockTalks will do */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mb-10 text-center">
          <h2 className="section-heading text-white sm:text-2xl">Three things, done properly</h2>
          <p className="mt-2 text-sm text-white/60">Launching in phases — each one fully verified, never half-built.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {PREVIEWS.map((p) => (
            <div
              key={p.title}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-colors duration-200 hover:border-primary/40"
            >
              <div className="mb-4 inline-grid h-11 w-11 place-items-center rounded-xl border border-primary/25 bg-primary/10">
                <p.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="card-title text-white sm:text-base">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/60">{p.copy}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Trust principles */}
      <section className="mx-auto max-w-4xl px-4 pb-24 sm:px-6">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8">
          <h2 className="section-heading text-white sm:text-xl">Built on the same trust rules</h2>
          <ul className="mt-5 space-y-3.5">
            {PRINCIPLES.map((pr) => (
              <li key={pr.label} className="flex items-start gap-3 text-sm text-white/70">
                <pr.icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                {pr.label}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="border-t border-white/5 bg-white/[0.02] py-16">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
          <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Be first in the conversation.</h2>
          <p className="mt-3 text-sm text-white/60">
            Create your Blockward profile now — verified achievements will be ready to share the
            moment BlockTalks opens.
          </p>
          <div className="mt-7 flex items-center justify-center gap-3">
            <Button onClick={() => (window.location.href = '/Signup')}>
              Get Started <ArrowRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/" className="text-white/70 hover:text-white">Back to homepage</Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/5 py-8">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6">
          <p className="text-xs text-white/40">BlockTalks — Where achievements start conversations.</p>
        </div>
      </footer>
    </div>
  );
}