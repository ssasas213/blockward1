import React, { useEffect } from 'react';
import SiteHeader from '@/components/home/SiteHeader';
import SiteFooter from '@/components/home/SiteFooter';

const DEFAULT_NAV = [
  { label: 'For students', href: '/' },
  { label: 'For organisations', href: '/ForOrganisations' },
  { label: 'Verify a credential', href: '/verify' },
  { label: 'Documentation', href: '/documentation' },
];

/**
 * MarketingShell — common frame for public marketing pages: fixed header over
 * a dark hero band (so the transparent header stays readable), content, and
 * the site footer with real links + live trust stats.
 */
export default function MarketingShell({ title, subtitle, navLinks = DEFAULT_NAV, children }) {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div className="min-h-screen font-sans antialiased">
      <SiteHeader
        navLinks={navLinks}
        onSignIn={() => { window.location.href = '/Login'; }}
        onGetStarted={() => { window.location.href = '/Signup'; }}
      />
      <section className="bg-sidebar pt-28 pb-12 sm:pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-semibold text-white tracking-tight leading-tight">{title}</h1>
          {subtitle && (
            <p className="text-base sm:text-lg text-white/70 mt-4 max-w-2xl leading-relaxed">{subtitle}</p>
          )}
        </div>
      </section>
      <main className="animate-fade-in">{children}</main>
      <SiteFooter />
    </div>
  );
}