import React, { useEffect, useState } from 'react';
import { Shield, Building2, Award, FileSearch } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const ORG_URL = '/ForOrganisations';

const COLUMNS = [
  { title: 'For students', links: [
    { label: 'Example profile', href: '/DemoProfile' },
    { label: 'Benefits', href: '/#benefits' },
    { label: 'Claim your profile', href: '/Signup' },
  ]},
  { title: 'For organisations', links: [
    { label: 'Overview', href: ORG_URL },
    { label: 'How it works', href: `${ORG_URL}#how-it-works` },
    { label: 'Features', href: `${ORG_URL}#features` },
    { label: 'Industries', href: `${ORG_URL}#industries` },
  ]},
  { title: 'Company', links: [
    { label: 'About', href: '/about' },
    { label: 'Contact', href: '/contact' },
  ]},
  { title: 'Resources', links: [
    { label: 'Verify a credential', href: '/verify' },
    { label: 'Documentation', href: '/documentation' },
    { label: 'Security', href: '/security' },
  ]},
];

/**
 * TrustStats — live platform counters, pulled from the platformStats function.
 * The whole block stays hidden until every number is persuasive (the function
 * returns show: false below its thresholds) — no vanity metrics, no fake "10k+".
 */
function TrustStats() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let active = true;
    base44.functions.invoke('platformStats', {})
      .then((res) => { if (active && res.data?.ok && res.data.show) setStats(res.data); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  if (!stats) return null;

  const items = [
    { icon: Building2, value: stats.orgs, label: 'Organisations issuing verified credentials' },
    { icon: Award, value: stats.credentials, label: 'Credentials permanently recorded' },
    { icon: FileSearch, value: stats.verifications, label: 'Public credential checks performed' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12 pt-8 border-t border-border">
      {items.map((s) => (
        <div key={s.label} className="rounded-xl border border-border bg-card/40 backdrop-blur-md p-5">
          <s.icon className="h-5 w-5 text-primary mb-2" />
          <p className="text-3xl font-bold text-foreground leading-none">{s.value.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-2 leading-snug">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

export default function SiteFooter() {
  return (
    <footer className="py-12 px-4 sm:px-6 lg:px-8 bg-background border-t border-border">
      <div className="max-w-7xl mx-auto">
        <TrustStats />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="h-5 w-5 text-primary" />
              <span className="font-semibold text-foreground">BlockWard</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              Verified achievements that last forever — owned by you.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="text-sm font-medium text-foreground mb-3">{col.title}</h4>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a href={link.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{link.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">© 2026 BlockWard. All rights reserved.</p>
          <div className="flex items-center gap-5 text-sm text-muted-foreground">
            <a href="/privacy" className="hover:text-foreground transition-colors">Privacy</a>
            <a href="/terms" className="hover:text-foreground transition-colors">Terms</a>
            <a href="/security" className="hover:text-foreground transition-colors">Security</a>
          </div>
        </div>
      </div>
    </footer>
  );
}