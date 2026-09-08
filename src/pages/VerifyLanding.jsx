import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Search, CheckCircle2, AlertCircle, FileSearch, Building2, PenTool, Network, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Accepts a full verification link OR a bare credential ID (BW-…). */
function extractCredentialId(raw) {
  const s = (raw || '').trim();
  if (!s) return null;
  const urlMatch = s.match(/\/verify\/([A-Za-z0-9-]+)/i);
  if (urlMatch) return urlMatch[1];
  const compact = s.replace(/\s/g, '');
  if (/^BW-/i.test(compact)) return compact.toUpperCase();
  if (/^[A-Za-z0-9][A-Za-z0-9-]{4,}$/.test(s)) return s;
  return null;
}

const WHAT_YOU_SEE = [
  {
    icon: CheckCircle2,
    title: 'Valid or invalid — stated plainly',
    desc: 'A green banner means the credential is authentic and current. A red banner means it was revoked or never fully verified. No guessing, no grey zone.',
  },
  {
    icon: Building2,
    title: 'The issuing organisation',
    desc: 'Exactly which school, club, academy or organisation stands behind the credential — and that they were an active, verified issuer at the time.',
  },
  {
    icon: PenTool,
    title: 'Every signer, with their role',
    desc: 'The nominated verifier, the organisation approver and — for higher-assurance credentials — an independent external verifier. Each with how they verified it: in person, from evidence, or against official records.',
  },
  {
    icon: FileSearch,
    title: 'The full timestamp chain',
    desc: 'When the achievement happened, when it was signed, when it was approved and when it was permanently recorded — in order, unaltered.',
  },
  {
    icon: Network,
    title: 'The blockchain record',
    desc: 'The transaction hash, network and timestamp anchoring the credential to a public ledger — viewable on a public explorer, independent of BlockWard.',
  },
];

export default function VerifyLanding() {
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    document.title = 'Verify a credential — BlockWard';
    window.scrollTo(0, 0);
    return () => { document.title = 'BlockWard — Verified Achievements'; };
  }, []);

  const check = () => {
    const id = extractCredentialId(input);
    if (!id) {
      setError("That doesn't look like a BlockWard credential link or ID. Credential IDs look like BW-2026-ABCD1234.");
      return;
    }
    navigate(`/verify/${id}`);
  };

  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      {/* Brand header */}
      <header className="fixed top-0 left-0 right-0 z-40 glass border-b border-border">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-semibold text-foreground">BlockWard</span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link to="/documentation" className="text-muted-foreground hover:text-foreground transition-colors">Documentation</Link>
            <Link to="/ForOrganisations" className="text-muted-foreground hover:text-foreground transition-colors hidden sm:inline">For organisations</Link>
          </div>
        </div>
      </header>

      <main className="pt-14">
        {/* Hero + lookup */}
        <section className="bg-sidebar pt-16 pb-20 px-4 sm:px-6">
          <div className="max-w-2xl mx-auto text-center">
            <p className="text-xs font-medium text-white/60 uppercase tracking-widest mb-3">Public verification tool</p>
            <h1 className="text-3xl sm:text-5xl font-semibold text-white tracking-tight leading-tight">
              Check a credential — no account needed.
            </h1>
            <p className="text-base text-white/70 mt-4 leading-relaxed">
              Verifying a candidate's achievement takes under a minute. Paste the link or credential ID they shared
              and read the full record for yourself.
            </p>

            <div className="mt-8 rounded-2xl border border-white/10 bg-card p-5 text-left">
              <label htmlFor="credential-input" className="block text-sm font-medium text-white/80 mb-2">
                Credential link or ID
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  id="credential-input"
                  type="text"
                  placeholder="e.g. BW-2026-ABCD1234 or https://…/verify/BW-2026-ABCD1234"
                  value={input}
                  onChange={(e) => { setInput(e.target.value); setError(null); }}
                  onKeyDown={(e) => e.key === 'Enter' && check()}
                  className="flex-1 h-11 rounded-lg bg-background border border-border px-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <Button size="lg" onClick={check}>
                  <Search className="mr-1.5 h-4 w-4" /> Check credential
                </Button>
              </div>
              {error && (
                <p className="mt-3 text-sm text-destructive flex items-start gap-1.5">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /> {error}
                </p>
              )}
              <p className="mt-3 text-xs text-white/50">
                Every BlockWard credential carries a public ID in the format BW-YEAR-CODE. The candidate can copy it
                from their profile or credential card.
              </p>
            </div>
          </div>
        </section>

        {/* What the record shows */}
        <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight mb-3">
                What the verification page shows
              </h2>
              <p className="text-base text-muted-foreground max-w-2xl mx-auto">
                Built for the people who have to decide: admissions officers, HR reviewers, scholarship panels, coaches.
                Everything you need to trust the credential — on one page.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {WHAT_YOU_SEE.map((item, i) => (
                <div key={i} className="card-hover p-6 rounded-xl bg-card border border-border">
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

        {/* How a third party checks — the short version */}
        <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8 border-t border-border">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight mb-8 text-center">
              Three steps, then you're done
            </h2>
            <ol className="space-y-6">
              {[
                { title: 'Ask the candidate for their credential', desc: 'They share a public verification link or the credential ID — either works. Nothing is private-only about verification; students control profile visibility, but a credential they share with you always checks out as it was issued.' },
                { title: 'Paste it into the box above', desc: 'The lookup is public and instant. You never need a BlockWard account, and the candidate is not notified that you checked.' },
                { title: 'Read the record', desc: 'Confirm the name matches your candidate, the issuing organisation is who you expected, and the signer chain and timestamps line up. For extra assurance, open the public explorer link in the blockchain record section.' },
              ].map((s, i) => (
                <li key={i} className="flex gap-4">
                  <span className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-sm font-semibold text-primary flex-shrink-0">{i + 1}</span>
                  <div>
                    <h3 className="text-base font-medium text-foreground">{s.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed mt-1">{s.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Org CTA */}
        <section className="py-16 px-4 sm:px-6 lg:px-8 border-t border-border">
          <div className="max-w-3xl mx-auto rounded-2xl border border-primary/20 bg-primary/5 p-8 text-center">
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">Issue credentials your candidates are proud to share.</h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
              Schools, clubs and academies use BlockWard so every award they give is independently verifiable — forever.
            </p>
            <Button className="mt-5" onClick={() => window.location.href = '/ForOrganisations'}>
              See how organisations use BlockWard <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </section>

        {/* Slim footer */}
        <footer className="py-10 px-4 border-t border-border">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>© 2026 BlockWard</span>
            <div className="flex items-center gap-5">
              <Link to="/documentation" className="hover:text-foreground transition-colors">Documentation</Link>
              <Link to="/security" className="hover:text-foreground transition-colors">Security</Link>
              <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
              <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}