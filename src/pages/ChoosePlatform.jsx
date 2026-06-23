import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import {
  Shield, ArrowRight, ArrowLeft, GraduationCap, Trophy, CheckCircle2,
  PlusCircle, PenLine, ShieldCheck, Archive, Link2, Sparkles, Users,
  Calendar, BookOpen, Award, Megaphone, Medal, Briefcase, Star, Zap,
} from 'lucide-react';
import { PLATFORM_LIST, VERIFICATION_FLOW, getPlatformConfig } from '@/lib/platformConfig';
import { usePlatform } from '@/lib/PlatformContext';

const ICONS = {
  GraduationCap, Trophy, Users, Calendar, BookOpen, Award, Megaphone,
  Medal, Briefcase, Star, Zap, PlusCircle, PenLine, ShieldCheck, Archive, Link2,
};

export default function ChoosePlatform() {
  const navigate = useNavigate();
  const { selectPlatform } = usePlatform();
  const [entering, setEntering] = useState(null);

  const handleEnter = async (platformId) => {
    setEntering(platformId);
    selectPlatform(platformId);

    // If the user is already authenticated, send them to their dashboard.
    // Otherwise route to login/signup to continue onboarding under the chosen platform.
    try {
      const user = await base44.auth.me();
      if (user) {
        const profiles = await base44.entities.UserProfile.filter({ user_email: user.email });
        if (profiles.length > 0) {
          const p = profiles[0];
          const dashboardMap = {
            admin: 'AdminDashboard',
            teacher: 'TeacherDashboard',
            student: 'StudentDashboard',
          };
          navigate(createPageUrl(dashboardMap[p.user_type] || 'StudentDashboard'));
          return;
        }
      }
    } catch {
      /* not authenticated */
    }

    navigate(createPageUrl('Login'));
  };

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <button
            onClick={() => navigate(createPageUrl('Home'))}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-xl text-slate-900">BlockWard</span>
          </button>
          <Button
            variant="ghost"
            onClick={() => navigate(createPageUrl('Home'))}
            className="text-slate-600"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-16 pb-12 overflow-hidden bg-gradient-to-br from-slate-900 via-violet-950 to-indigo-950">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-violet-500/10 blur-3xl" />
          <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl" />
        </div>
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-300 text-sm font-medium mb-6">
              <Sparkles className="h-4 w-4" />
              One Engine · Two Experiences
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white mb-5 leading-tight">
              Choose the platform built for
              <span className="block mt-2 bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
                your organisation.
              </span>
            </h1>
            <p className="text-lg text-slate-300 max-w-2xl mx-auto">
              BlockWard powers both schools and non-school organisations with the same
              blockchain verification engine — each with its own roles, terminology, and dashboards.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Platform Cards */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {PLATFORM_LIST.map((platform, idx) => {
              const PlatformIcon = ICONS[platform.icon] || Shield;
              const isEntering = entering === platform.id;
              return (
                <motion.div
                  key={platform.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: idx * 0.15 }}
                >
                  <div className="group relative h-full bg-white rounded-3xl border-2 border-slate-100 shadow-sm hover:shadow-2xl transition-all duration-300 overflow-hidden">
                    {/* Top gradient banner */}
                    <div className={`h-2 bg-gradient-to-r ${platform.gradient}`} />

                    <div className="p-8 sm:p-10 flex flex-col h-full">
                      {/* Icon + name */}
                      <div className="flex items-center gap-4 mb-6">
                        <div className={`h-16 w-16 rounded-2xl bg-gradient-to-br ${platform.gradient} flex items-center justify-center shadow-lg`}>
                          <PlatformIcon className="h-8 w-8 text-white" />
                        </div>
                        <div>
                          <h2 className="text-2xl font-bold text-slate-900">{platform.name}</h2>
                          <p className="text-sm text-slate-500 mt-0.5">{platform.tagline}</p>
                        </div>
                      </div>

                      {/* Roles */}
                      <div className="mb-6">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Roles</p>
                        <div className="flex flex-wrap gap-2">
                          {platform.roles.map((role) => (
                            <span
                              key={role}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${platform.chip}`}
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              {role}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Features */}
                      <div className="mb-8 flex-1">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Features</p>
                        <ul className="space-y-2.5">
                          {platform.features.map((feature) => (
                            <li key={feature} className="flex items-start gap-2.5">
                              <div className={`h-5 w-5 rounded-full bg-gradient-to-br ${platform.gradient} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                                <CheckCircle2 className="h-3 w-3 text-white" />
                              </div>
                              <span className="text-sm text-slate-700">{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* CTA */}
                      <Button
                        size="lg"
                        onClick={() => handleEnter(platform.id)}
                        disabled={isEntering}
                        className={`w-full bg-gradient-to-r ${platform.buttonGradient} hover:opacity-90 text-base py-6 shadow-lg border-0`}
                      >
                        {isEntering ? (
                          <>Loading…</>
                        ) : (
                          <>
                            {platform.cta}
                            <ArrowRight className="ml-2 h-5 w-5" />
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Shared Verification Engine */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-100 text-violet-700 text-sm font-medium mb-4">
              <Shield className="h-4 w-4" />
              Shared Verification Engine
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              The same trusted flow powers both platforms
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Whether you're a school or a sports club, every credential follows the same
              immutable, auditable verification chain.
            </p>
          </div>

          {/* Flow steps */}
          <div className="relative">
            {/* connecting line */}
            <div className="hidden lg:block absolute top-10 left-0 right-0 h-0.5 bg-gradient-to-r from-violet-200 via-indigo-200 to-cyan-200" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
              {VERIFICATION_FLOW.map((step, i) => {
                const StepIcon = ICONS[step.icon] || Shield;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: i * 0.1 }}
                    viewport={{ once: true }}
                    className="relative flex flex-col items-center text-center"
                  >
                    <div className="relative z-10 h-20 w-20 rounded-2xl bg-white border-2 border-violet-100 shadow-md flex items-center justify-center mb-4">
                      <StepIcon className="h-8 w-8 text-violet-600" />
                      <span className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 text-white text-xs font-bold flex items-center justify-center shadow">
                        {i + 1}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-slate-800 leading-snug">{step.step}</p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Platform-specific dashboards preview */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-50 to-violet-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              Dashboards tailored to your world
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Same engine, different vocabulary. Each platform surfaces the tools your organisation actually uses.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {PLATFORM_LIST.map((platform) => {
              const PlatformIcon = ICONS[platform.icon] || Shield;
              return (
                <div key={platform.id} className={`rounded-3xl bg-gradient-to-br ${platform.bgGradient} border-2 ${platform.ring} p-8`}>
                  <div className="flex items-center gap-3 mb-6">
                    <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${platform.gradient} flex items-center justify-center shadow-lg`}>
                      <PlatformIcon className="h-6 w-6 text-white" />
                    </div>
                    <h3 className={`text-xl font-bold ${platform.text}`}>{platform.name}</h3>
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    {platform.navItems.map((item) => (
                      <span
                        key={item}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/80 border border-white text-sm font-medium text-slate-700 shadow-sm"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-slate-400" />
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-4 bg-slate-950 border-t border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-white">BlockWard AI</span>
          </div>
          <p className="text-sm text-slate-500">
            © 2026 BlockWard AI · Universal Achievement Verification
          </p>
        </div>
      </footer>
    </div>
  );
}