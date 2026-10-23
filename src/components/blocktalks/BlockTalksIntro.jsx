import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, MessagesSquare, ShieldCheck, Share2, Building2, Users, Sparkles, LogIn,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { setPostAuthRedirect, toLogin } from '@/lib/authRedirectGuard';

// BlockTalksIntro — the public introduction shown to logged-out visitors on
// /BlockTalks. Signing in or creating an account RETURNS the user here (via
// the post-auth intent), never to a generic dashboard.

const PREVIEWS = [
  {
    icon: Share2,
    title: 'Share verified achievements',
    copy: 'Turn any Blockward Verified credential into a professional announcement — with the issuing organisation, live verification status and a link anyone can independently check.',
  },
  {
    icon: MessagesSquare,
    title: 'Where achievements start conversations',
    copy: 'A professional feed built for substance: recruiters, admissions officers and peers see real, tamper-evident proof — not self-declared claims.',
  },
  {
    icon: Building2,
    title: 'Organisation recognition',
    copy: 'Verified organisations publicly recognise achievements they issued — always with the holder\'s explicit approval first.',
  },
];

const PRINCIPLES = [
  { icon: ShieldCheck, label: 'Only Blockward Verified credentials can carry the badge' },
  { icon: Users, label: 'Sharing is always opt-in — achievements are never auto-published' },
  { icon: Sparkles, label: 'Private achievements and evidence files always stay private' },
];

export default function BlockTalksIntro() {
  const signIn = () => { setPostAuthRedirect('/BlockTalks'); toLogin(); };
  const createAccount = () => { setPostAuthRedirect('/BlockTalks'); window.location.href = '/Signup'; };

  return (
    <div className="min-h-screen font-sans antialiased bg-[#0A0F1A] text-white">
      {/* Top bar */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#0A0F1A]/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2">
            <MessagesSquare className="h-5 w-5 text-primary" />
            <span className="font-display text-lg font-bold tracking-tight">BlockTalks</span>
          </Link>
          <div className="flex items-center gap-3">
            <button onClick={signIn} className="text-sm text-white/70 transition-colors hover:text-white">Sign in</button>
            <Button size="sm" onClick={createAccount}>Create account <ArrowRight className="ml-1.5 h-4 w-4" /></Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden pt-32 pb-20 sm:pt-40">
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(ellipse 60% 45% at 50% 0%, rgba(37, 99, 235, 0.16), transparent 65%)' }}
        />
        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-primary">
            <MessagesSquare className="h-3.5 w-3.5" /> A BlockWard platform
          </p>
          <h1 className="font-display text-5xl font-black leading-[1.05] tracking-tight sm:text-6xl">BlockTalks</h1>
          <p className="mt-4 font-display text-xl text-primary sm:text-2xl">Where achievements start conversations.</p>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-white/70">
            The professional network for verified achievement. Share your Blockward Verified
            credentials as announcements that any university, employer or organisation can
            independently check.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" onClick={signIn} className="h-12 px-8 text-base">
              <LogIn className="h-4 w-4" /> Sign in to continue
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 bg-transparent px-8 text-base text-white border-white/20 hover:bg-white/5"
              onClick={createAccount}
            >
              Create an account
            </Button>
          </div>
          <p className="mt-4 text-sm text-white/50">
            Uses your existing BlockWard account — no separate BlockTalks login.
          </p>
        </div>
      </section>

      {/* What BlockTalks does */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mb-10 text-center">
          <h2 className="section-heading text-white sm:text-2xl">Built for verified achievement</h2>
          <p className="mt-2 text-sm text-white/60">Every post carries proof, not promises.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {PREVIEWS.map((p) => (
            <div key={p.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-colors duration-200 hover:border-primary/40">
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
          <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Join the conversation.</h2>
          <p className="mt-3 text-sm text-white/60">
            Sign in with your existing BlockWard account — verified achievements are ready to share.
          </p>
          <div className="mt-7 flex items-center justify-center gap-3">
            <Button onClick={signIn}><LogIn className="h-4 w-4" /> Sign in</Button>
            <Button variant="ghost" asChild>
              <Link to="/" className="text-white/70 hover:text-white">Back to BlockWard</Link>
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