import React, { useEffect, useState } from 'react';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { ArrowRight } from 'lucide-react';
import DemoModal from '@/components/home/DemoModal';
import SiteHeader from '@/components/home/SiteHeader';
import HeroSection from '@/components/home/HeroSection';
import TrustSection from '@/components/home/TrustSection';
import HowItWorks from '@/components/home/HowItWorks';
import IndustriesSection from '@/components/home/IndustriesSection';
import FeaturesSection from '@/components/home/FeaturesSection';
import InteractiveDemo from '@/components/home/InteractiveDemo';
import SiteFooter from '@/components/home/SiteFooter';

export default function Home() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [demoOpen, setDemoOpen] = useState(false);

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

  const handleGetStarted = () => {
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
      <DemoModal open={demoOpen} onClose={() => setDemoOpen(false)} />
      <SiteHeader user={user} profile={profile} onSignIn={handleSignIn} onGetStarted={handleGetStarted} onDashboard={handleGoToDashboard} />
      <HeroSection onSignIn={handleSignIn} onWatchDemo={() => setDemoOpen(true)} />
      <TrustSection />
      <HowItWorks />
      <IndustriesSection />
      <FeaturesSection />
      <InteractiveDemo />

      {/* Final CTA */}
      <section className="relative py-24 px-4 sm:px-6 lg:px-8 border-t border-border">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-semibold text-foreground tracking-tight">
            Give achievements that last a lifetime.
          </h2>
          <p className="text-base text-muted-foreground mt-4 max-w-xl mx-auto">
            Join schools, clubs, and organisations using BlockWard to verify, preserve, and showcase achievements permanently.
          </p>
          <div className="mt-8">
            <Button
              size="lg"
              onClick={() => window.location.href = createPageUrl('Signup')}
            >
              Get Started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}