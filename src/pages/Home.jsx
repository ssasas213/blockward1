import React, { useEffect, useState } from 'react';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { ArrowRight, Layers, Sparkles } from 'lucide-react';
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

  const handleGoToDashboard = () => {
    if (profile) {
      const dashboardMap = { admin: 'AdminDashboard', teacher: 'TeacherDashboard', student: 'StudentDashboard' };
      window.location.href = createPageUrl(dashboardMap[profile.user_type] || 'StudentDashboard');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center shadow-2xl shadow-violet-500/30 animate-pulse">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
          <div className="h-1 w-32 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full w-1/2 bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 font-sans antialiased">
      <DemoModal open={demoOpen} onClose={() => setDemoOpen(false)} />
      <SiteHeader user={user} profile={profile} onSignIn={handleSignIn} onDashboard={handleGoToDashboard} />

      <HeroSection onSignIn={handleSignIn} onWatchDemo={() => setDemoOpen(true)} />

      <TrustSection />

      <HowItWorks />

      <IndustriesSection />

      <FeaturesSection />

      <InteractiveDemo />

      {/* Final CTA */}
      <section className="relative py-28 px-4 sm:px-6 lg:px-8 bg-slate-950 border-t border-white/5 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(124,58,237,0.18),transparent_60%)]" />
        <div className="relative max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/15 backdrop-blur-md text-violet-200 text-sm font-medium mb-8">
              <Sparkles className="h-4 w-4" />
              Ready to preserve what matters?
            </div>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white mb-6 tracking-tight leading-tight">
              Give achievements that
              <span className="block mt-2 bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent">
                last a lifetime.
              </span>
            </h2>
            <p className="text-lg text-slate-400 mb-10 max-w-2xl mx-auto">
              Join schools, clubs, and organisations using BlockWard to verify, authorise, archive,
              and preserve achievements permanently.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                onClick={() => window.location.href = createPageUrl('Login')}
                className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-base px-8 py-6 shadow-2xl shadow-violet-600/30 border-0"
              >
                <Layers className="mr-2 h-5 w-5" />
                Get Started
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={handleSignIn}
                className="text-base px-8 py-6 border-white/15 text-white bg-white/5 hover:bg-white/10 backdrop-blur-md"
              >
                Get Started Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}