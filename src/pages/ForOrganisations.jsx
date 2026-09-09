import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';
import SiteHeader from '@/components/home/SiteHeader';
import HeroSection from '@/components/home/HeroSection';
import TrustSection from '@/components/home/TrustSection';
import HowItWorks from '@/components/home/HowItWorks';
import IndustriesSection from '@/components/home/IndustriesSection';
import FeaturesSection from '@/components/home/FeaturesSection';
import InteractiveDemo from '@/components/home/InteractiveDemo';
import BlockchainGuaranteesSection from '@/components/home/BlockchainGuaranteesSection';
import SiteFooter from '@/components/home/SiteFooter';

const ORG_NAV = [
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Industries', href: '#industries' },
  { label: 'Features', href: '#features' },
  { label: 'Security', href: '#security' },
  { label: 'Demo', href: '#demo' },
];

export default function ForOrganisations() {
  return (
    <div className="min-h-screen font-sans antialiased">
      <SiteHeader
        navLinks={ORG_NAV}
        onSignIn={() => window.location.href = createPageUrl('Login')}
        onGetStarted={() => window.location.href = createPageUrl('Signup')}
      />
      <HeroSection
        onSignIn={() => window.location.href = createPageUrl('Login')}
        onWatchDemo={() => document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })}
      />
      <TrustSection />
      <HowItWorks />
      <IndustriesSection />
      <FeaturesSection />
      <InteractiveDemo />
      <BlockchainGuaranteesSection />

      {/* Final CTA */}
      <section className="relative py-24 px-4 sm:px-6 lg:px-8 border-t border-border">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-semibold text-foreground tracking-tight">
            Give achievements that last a lifetime.
          </h2>
          <p className="text-base text-muted-foreground mt-4 max-w-xl mx-auto">
            Join schools, clubs, and organisations using BlockWard to verify, preserve, and showcase achievements permanently.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4">
            <Button size="lg" onClick={() => window.location.href = createPageUrl('Signup')}>
              Get Started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <p className="text-sm text-muted-foreground">
              Setting up BlockWard for a school, club or academy?{' '}
              <a href={createPageUrl('SchoolSetup')} className="text-primary font-medium hover:underline">Create an organisation</a>
            </p>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}