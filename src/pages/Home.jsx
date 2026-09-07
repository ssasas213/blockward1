import React, { useEffect, useState } from 'react';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { ArrowRight } from 'lucide-react';
import SiteHeader from '@/components/home/SiteHeader';
import StudentHero from '@/components/home/StudentHero';
import BenefitsSection from '@/components/home/BenefitsSection';
import SiteFooter from '@/components/home/SiteFooter';

const NAV_LINKS = [
  { label: 'Benefits', href: '#benefits' },
  { label: 'For organisations', href: createPageUrl('ForOrganisations') },
  { label: 'Example profile', href: createPageUrl('DemoProfile') },
  { label: 'Verify a credential', href: '/verify' },
];

export default function Home() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      if (currentUser) {
        const profiles = await base44.entities.UserProfile.filter({ user_email: currentUser.email });
        if (profiles.length > 0) setProfile(profiles[0]);
      }
    } catch (error) {
      // Not authenticated
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = () => {
    window.location.href = '/Login';
  };

  const handleClaimProfile = () => {
    window.location.href = '/Signup';
  };

  const handleGoToDashboard = () => {
    if (profile) {
      const dashboardMap = { admin: 'AdminDashboard', teacher: 'TeacherDashboard', student: 'StudentDashboard' };
      window.location.href = createPageUrl(dashboardMap[profile.user_type] || 'StudentDashboard');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans antialiased">
      <SiteHeader
        user={user}
        profile={profile}
        navLinks={NAV_LINKS}
        onSignIn={handleSignIn}
        onGetStarted={handleClaimProfile}
        onDashboard={handleGoToDashboard}
        ctaLabel="Claim your profile"
      />
      <StudentHero />
      <BenefitsSection />

      {/* Final CTA */}
      <section className="relative py-24 sm:py-32 px-4 sm:px-6 lg:px-8 border-t border-border">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-5xl font-bold text-foreground tracking-tight leading-tight">
            Stop letting your achievements
            <br />
            gather dust in a drawer.
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground mt-5 max-w-xl mx-auto">
            Claim your profile, get your school or club connected, and turn everything you've earned into proof that lasts forever.
          </p>
          <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" className="text-base px-8 h-12" onClick={handleClaimProfile}>
              Claim your profile
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}