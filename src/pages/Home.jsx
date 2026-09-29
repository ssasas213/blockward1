import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toLogin } from '@/lib/authRedirectGuard';
import { Button } from '@/components/ui/button';
import { ArrowRight, Search } from 'lucide-react';
import SiteHeader from '@/components/home/SiteHeader';
import UniversalHero from '@/components/home/UniversalHero';
import UniversalSections from '@/components/home/UniversalSections';
import SiteFooter from '@/components/home/SiteFooter';

const NAV_LINKS = [
  { label: 'How it works', href: '#how-it-works' },
  { label: 'For organisations', href: '/ForOrganisations' },
  { label: 'Verify a credential', href: '/verify' },
];

export default function Home() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    // Public page — auth check fills in the header buttons in the background;
    // never block the landing page on login state.
    (async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        if (currentUser) {
          const profiles = await base44.entities.UserProfile.filter({ user_email: currentUser.email });
          if (profiles.length > 0) setProfile(profiles[0]);
        }
      } catch {
        // Not authenticated
      }
    })();
  }, []);

  const handleGoToDashboard = () => {
    if (profile) {
      const dashboardMap = { admin: 'AdminDashboard', teacher: 'TeacherDashboard', student: 'StudentDashboard' };
      window.location.href = `/${dashboardMap[profile.user_type] || 'StudentDashboard'}`;
    }
  };

  return (
    <div className="min-h-screen font-sans antialiased">
      <SiteHeader
        user={user}
        profile={profile}
        navLinks={NAV_LINKS}
        onSignIn={toLogin}
        onGetStarted={() => (window.location.href = '/Signup')}
        onDashboard={handleGoToDashboard}
        ctaLabel="Create Your Profile"
      />
      <UniversalHero />
      <UniversalSections />

      {/* Final CTA */}
      <section className="relative py-24 sm:py-32 px-4 sm:px-6 lg:px-8 border-t border-border">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-5xl font-bold text-foreground tracking-tight leading-tight">
            Prove it once.
            <br />
            Prove it everywhere.
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground mt-5 max-w-xl mx-auto">
            Turn your achievements into Blockward Verified credentials — issuer-signed, cryptographically
            secured and independently checkable from one link.
          </p>
          <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" className="text-base px-8 h-12" onClick={() => (window.location.href = '/Signup')}>
              Create Your Profile
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" className="text-base px-8 h-12" onClick={() => (window.location.href = '/verify')}>
              <Search className="mr-1 h-5 w-5" />
              Verify a Credential
            </Button>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}