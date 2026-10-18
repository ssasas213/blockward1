import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toLogin } from '@/lib/authRedirectGuard';
import SiteHeader from '@/components/home/SiteHeader';
import Hero from '@/components/home2/Hero';
import Film from '@/components/home2/Film';
import IssueOwnVerify from '@/components/home2/IssueOwnVerify';
import VaultSection from '@/components/home2/VaultSection';
import TrustSection from '@/components/home2/TrustSection';
import VerifyWidget from '@/components/home/VerifyWidget';
import FinalCta from '@/components/home2/FinalCta';
import SiteFooter from '@/components/home/SiteFooter';

// Direction B — "One Continuous Proof". The homepage is a single directed
// narrative: hero artifact → scroll-choreographed journey → Issue/Own/Verify
// → Vault → trust → verify → close. Fixed dark cinematic treatment; all
// example content is fictional and clearly marked.
const NAV_LINKS = [
  { label: 'How it works', href: '#journey' },
  { label: 'For individuals', href: '#own' },
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
    <div className="min-h-screen font-sans antialiased bg-[#0A0F1A]">
      <SiteHeader
        user={user}
        profile={profile}
        navLinks={NAV_LINKS}
        onSignIn={toLogin}
        onGetStarted={() => (window.location.href = '/Signup')}
        onDashboard={handleGoToDashboard}
        ctaLabel="Get Started"
      />
      <Hero />
      <Film />
      <IssueOwnVerify />
      <VaultSection />
      <TrustSection />
      <VerifyWidget />
      <FinalCta />
      <SiteFooter />
    </div>
  );
}