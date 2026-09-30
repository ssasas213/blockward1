import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toLogin } from '@/lib/authRedirectGuard';
import SiteHeader from '@/components/home/SiteHeader';
import UniversalHero from '@/components/home/UniversalHero';
import ProblemSection from '@/components/home/ProblemSection';
import WhyBlockward from '@/components/home/WhyBlockward';
import StatementSection from '@/components/home/StatementSection';
import HowItWorksTimeline from '@/components/home/HowItWorksTimeline';
import VerifiedMeaning from '@/components/home/VerifiedMeaning';
import ProfileShowcase from '@/components/home/ProfileShowcase';
import UseCases from '@/components/home/UseCases';
import AudienceProof from '@/components/home/AudienceProof';
import VerifyWidget from '@/components/home/VerifyWidget';
import OrgCta from '@/components/home/OrgCta';
import FinalCta from '@/components/home/FinalCta';
import SiteFooter from '@/components/home/SiteFooter';

const NAV_LINKS = [
  { label: 'How it works', href: '#how-it-works' },
  { label: 'For individuals', href: '#why-blockward' },
  { label: 'For organisations', href: '/ForOrganisations' },
  { label: 'Verify a credential', href: '#verify' },
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
        ctaLabel="Create Profile"
      />
      <UniversalHero />
      <ProblemSection />
      <WhyBlockward />
      <StatementSection />
      <HowItWorksTimeline />
      <VerifiedMeaning />
      <ProfileShowcase />
      <UseCases />
      <AudienceProof />
      <VerifyWidget />
      <OrgCta />
      <FinalCta />
      <SiteFooter />
    </div>
  );
}