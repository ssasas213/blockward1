import React from 'react';
import { Shield } from 'lucide-react';
import { createPageUrl } from '@/utils';

const ORG_URL = createPageUrl('ForOrganisations');

export default function SiteFooter() {
  return (
    <footer className="py-12 px-4 sm:px-6 lg:px-8 bg-background border-t border-border">
      <div className="max-w-7xl mx-auto">
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

          {[
            { title: 'For students', links: [
              { label: 'Example profile', href: createPageUrl('DemoProfile') },
              { label: 'Benefits', href: createPageUrl('Home') + '#benefits' },
            ]},
            { title: 'For organisations', links: [
              { label: 'Overview', href: ORG_URL },
              { label: 'How it works', href: ORG_URL + '#how-it-works' },
              { label: 'Features', href: ORG_URL + '#features' },
              { label: 'Industries', href: ORG_URL + '#industries' },
            ]},
            { title: 'Company', links: [{ label: 'About', href: '#top' }, { label: 'Contact', href: '#top' }]},
            { title: 'Resources', links: [{ label: 'Verification', href: ORG_URL + '#demo' }, { label: 'Security', href: '#top' }]},
          ].map((col) => (
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
            <a href="#top" className="hover:text-foreground transition-colors">Privacy</a>
            <a href="#top" className="hover:text-foreground transition-colors">Terms</a>
            <a href="#top" className="hover:text-foreground transition-colors">Security</a>
          </div>
        </div>
      </div>
    </footer>
  );
}