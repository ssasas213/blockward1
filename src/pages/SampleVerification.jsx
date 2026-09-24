import React, { useEffect } from 'react';
import { Shield, BadgeCheck, ArrowLeft, Clock, Network, PenTool, Building2, Calendar } from 'lucide-react';
import { DEMO } from '@/pages/DemoProfile';

/**
 * SampleVerification — the "View verification" target for the example profile.
 * Clearly labelled SAMPLE at every level: banner, title, and body. Never shows
 * a green "Verified" badge — it shows the neutral sample state only.
 */
export default function SampleVerification() {
  const params = new URLSearchParams(window.location.search);
  const idx = Math.min(Math.max(parseInt(params.get('a') || '0', 10) || 0, 0), DEMO.achievements.length - 1);
  const a = DEMO.achievements[idx];

  useEffect(() => {
    document.title = 'Sample verification | BlockWard';
    let robots = document.head.querySelector('meta[name="robots"]');
    if (!robots) { robots = document.createElement('meta'); robots.setAttribute('name', 'robots'); document.head.appendChild(robots); }
    robots.setAttribute('content', 'noindex');
  }, []);

  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      <header className="border-b border-border bg-card">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <a href="/DemoProfile" className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-semibold text-foreground">BlockWard</span>
            <span className="ml-1 px-1.5 py-0.5 rounded-md border border-primary/30 bg-primary/15 text-[10px] font-semibold uppercase tracking-wide text-primary">Beta</span>
          </a>
          <a href="/DemoProfile" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to example profile
          </a>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* SAMPLE banner — impossible to miss */}
        <div className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-4 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <BadgeCheck className="h-4 w-4 text-warning" />
            <span className="text-sm font-semibold text-warning">Sample — not a real credential</span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            This page shows what a real verification page looks like. All names, organisations and
            details are fictional sample data, and no blockchain record exists for it.
          </p>
        </div>

        {/* Credential card */}
        <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <a.icon className="h-6 w-6 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">{a.title}</h1>
              <p className="text-sm text-muted-foreground mt-1">{a.category} · {a.date}</p>
            </div>
          </div>

          <div className="mt-6 space-y-3 text-sm">
            <div className="flex items-center gap-2.5">
              <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground">Issuing organisation:</span>
              <span className="text-foreground font-medium">{a.org} <span className="text-tertiary font-normal">(sample)</span></span>
            </div>
            <div className="flex items-center gap-2.5">
              <PenTool className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground">Signers:</span>
              <span className="text-foreground font-medium">{a.verifier} <span className="text-tertiary font-normal">(sample)</span></span>
            </div>
            <div className="flex items-center gap-2.5">
              <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground">Date achieved:</span>
              <span className="text-foreground font-medium">{a.date}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Network className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground">Network:</span>
              <span className="px-2 py-0.5 rounded-md border border-warning/30 bg-warning/10 text-[11px] font-semibold text-warning">No blockchain record — sample</span>
            </div>
          </div>
        </div>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          In the live product, this page shows the real signer chain and the on-chain anchor
          (written to the Sepolia testnet during beta), and a green "Verified" state only when
          every check passes.{' '}
          <a href="/verify" className="text-primary hover:underline">Try the real verification tool →</a>
        </p>
      </main>
    </div>
  );
}