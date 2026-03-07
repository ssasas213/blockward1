import React, { useEffect, useState } from 'react';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { 
  Shield, Award, CheckCircle2, Sparkles, ArrowRight, GraduationCap, 
  Loader2, Brain, Users, Bell, BookOpen, BarChart3, Lock, Star,
  ChevronRight, Zap, Globe, TrendingUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import DemoModal from '@/components/home/DemoModal';

export default function Home() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDemo, setShowDemo] = useState(false);

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
    base44.auth.redirectToLogin(createPageUrl('Onboarding'));
  };

  const handleGoToDashboard = () => {
    if (profile) {
      const dashboardMap = { admin: 'AdminDashboard', teacher: 'TeacherDashboard', student: 'StudentDashboard' };
      window.location.href = createPageUrl(dashboardMap[profile.user_type] || 'StudentDashboard');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-indigo-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center shadow-2xl">
            <Shield className="h-8 w-8 text-white animate-pulse" />
          </div>
          <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
        </div>
      </div>
    );
  }

  const stats = [
    { value: "100%", label: "Tamper-Proof Records" },
    { value: "4", label: "User Roles Supported" },
    { value: "AI", label: "Powered Automation" },
    { value: "K–12", label: "Target Schools" },
  ];

  const roles = [
    {
      icon: Shield,
      role: "Administrators",
      color: "from-rose-500 to-orange-500",
      bg: "bg-rose-50 border-rose-200",
      textColor: "text-rose-700",
      description: "Manage school operations, analyze performance data, control user permissions, and configure system-wide settings — all from one dashboard."
    },
    {
      icon: BookOpen,
      role: "Teachers",
      color: "from-violet-500 to-purple-500",
      bg: "bg-violet-50 border-violet-200",
      textColor: "text-violet-700",
      description: "Organize classes, reward students instantly, distribute resources, automate scheduling, and communicate with parents — without the paperwork."
    },
    {
      icon: GraduationCap,
      role: "Students",
      color: "from-blue-500 to-cyan-500",
      bg: "bg-blue-50 border-blue-200",
      textColor: "text-blue-700",
      description: "Collect BlockWards, monitor progress, access assignments, check timetables, and receive school updates — all in one place."
    },
    {
      icon: Users,
      role: "Parents",
      color: "from-green-500 to-teal-500",
      bg: "bg-green-50 border-green-200",
      textColor: "text-green-700",
      description: "Track your child's achievements and receive important school communications — no more endless phone calls or missed emails."
    }
  ];

  const features = [
    {
      icon: Lock,
      title: "Blockchain-Secured Achievements",
      description: "Every BlockWard is permanently recorded on the blockchain — tamper-proof, transparent, and verifiable by universities and employers.",
      highlight: true
    },
    {
      icon: Brain,
      title: "AI-Powered Automation",
      description: "AI assistants handle scheduling, announcements, and routine communications — freeing teachers to focus on teaching."
    },
    {
      icon: Award,
      title: "Gamified Reward System",
      description: "Students earn BlockWards for academics, sports, leadership, and community — real motivation with real value."
    },
    {
      icon: Bell,
      title: "Smart Notifications",
      description: "Priority-based alert system ensures critical updates reach the right people at the right time."
    },
    {
      icon: BarChart3,
      title: "Data-Driven Insights",
      description: "Administrators get real-time analytics on student performance, behavior trends, and school-wide engagement."
    },
    {
      icon: Globe,
      title: "University-Ready Portfolio",
      description: "Students build a verifiable, on-chain achievement portfolio that can strengthen university applications."
    }
  ];

  return (
    <div className="min-h-screen bg-white font-sans">
      <AnimatePresence>
        {showDemo && <DemoModal onClose={() => setShowDemo(false)} />}
      </AnimatePresence>
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-b border-slate-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-xl text-slate-900">BlockWard</span>
              <span className="ml-2 text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">AI</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {user && profile ? (
              <Button onClick={handleGoToDashboard} className="bg-gradient-to-r from-violet-600 to-indigo-600 shadow-lg shadow-violet-500/25">
                Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleSignIn} className="bg-gradient-to-r from-violet-600 to-indigo-600 shadow-lg shadow-violet-500/25">
                Get Started <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-24 pb-20 overflow-hidden bg-gradient-to-br from-slate-900 via-violet-950 to-indigo-950">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-violet-500/10 blur-3xl" />
          <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-300 text-sm font-medium mb-8">
              <Sparkles className="h-4 w-4" />
              EdTech · Blockchain · AI
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-white mb-6 leading-tight">
              Where School Achievement
              <span className="block mt-2 bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
                Lives Forever on the Blockchain
              </span>
            </h1>

            <p className="text-xl text-slate-300 mb-10 max-w-3xl mx-auto leading-relaxed">
              BlockWard AI is the all-in-one school management platform that rewards students with blockchain-secured digital credentials — permanent, tamper-proof, and built for university applications.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
              <Button
                size="lg"
                onClick={handleSignIn}
                className="bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 text-lg px-10 py-6 shadow-2xl shadow-violet-500/30 border-0"
              >
                Start Free Today
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-lg px-10 py-6 border-2 border-white/20 text-white bg-white/5 hover:bg-white/10 backdrop-blur"
              onClick={() => setShowDemo(true)}
              >
                Watch Demo
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
              {stats.map((stat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 + i * 0.1 }}
                  className="text-center p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur"
                >
                  <p className="text-3xl font-bold text-white">{stat.value}</p>
                  <p className="text-sm text-slate-400 mt-1">{stat.label}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Problem / Solution */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-100 text-red-700 text-sm font-medium mb-6">
                The Problem
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-6">
                Student achievements are being lost, forged, or forgotten
              </h2>
              <div className="space-y-4">
                {[
                  "Paper certificates get lost and are easy to fake",
                  "Students have no portable, verified record of their accomplishments",
                  "Teachers waste hours on admin instead of teaching",
                  "Parents are out of the loop on their child's progress",
                  "Schools lack data-driven tools to recognize and motivate students"
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="h-5 w-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <div className="h-2 w-2 rounded-full bg-red-500" />
                    </div>
                    <p className="text-slate-600">{item}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-100 text-violet-700 text-sm font-medium mb-6">
                Our Solution
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-6">
                BlockWard AI — A complete school ecosystem
              </h2>
              <div className="space-y-4">
                {[
                  "Blockchain-secured BlockWards that can never be altered or erased",
                  "Students build a verified achievement portfolio for university applications",
                  "AI assistants automate scheduling, announcements, and admin tasks",
                  "Parents receive real-time updates on achievements and communications",
                  "Powerful analytics give schools insight into engagement and performance"
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="h-5 w-5 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle2 className="h-3 w-3 text-violet-600" />
                    </div>
                    <p className="text-slate-600">{item}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* USP — Blockchain Achievement Card */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-100 text-violet-700 text-sm font-medium mb-4">
              <Zap className="h-4 w-4" />
              Our Unique Selling Proposition
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              The first school platform where achievements are permanent
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Every BlockWard issued is recorded on-chain — creating an immutable, verifiable record that students own forever and can share with universities.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Animated BlockWard Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-violet-600/20 to-indigo-600/20 rounded-3xl blur-2xl" />
              <div className="relative bg-gradient-to-br from-violet-600 to-indigo-700 rounded-3xl p-10 text-white shadow-2xl shadow-violet-500/30">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-2xl bg-white/20 flex items-center justify-center">
                      <Shield className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-xs text-white/60 font-medium uppercase tracking-wider">BlockWard</p>
                      <p className="font-bold text-lg">Academic Excellence</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 bg-green-500/20 border border-green-400/30 px-3 py-1.5 rounded-full">
                    <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-xs text-green-300 font-medium">On-Chain</span>
                  </div>
                </div>

                <div className="mb-8">
                  <p className="text-white/70 text-sm mb-1">Awarded to</p>
                  <p className="text-2xl font-bold mb-1">Sarah Johnson</p>
                  <p className="text-white/60 text-sm">Year 11 · Mathematics Department</p>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-8">
                  {["Academic", "Leadership", "Term 1"].map((tag, i) => (
                    <div key={i} className="bg-white/10 rounded-xl px-3 py-2 text-center">
                      <p className="text-xs text-white/70">{tag}</p>
                    </div>
                  ))}
                </div>

                <div className="bg-white/10 rounded-2xl p-4">
                  <p className="text-xs text-white/50 mb-1">Blockchain Record</p>
                  <p className="text-xs font-mono text-white/80 truncate">0x7f3a...9c2b · Sepolia Network</p>
                  <p className="text-xs text-white/50 mt-1">Issued by: St. Mary's Academy · 2026</p>
                </div>
              </div>
            </motion.div>

            {/* USP Points */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="space-y-6"
            >
              {[
                {
                  icon: Lock,
                  color: "bg-violet-100 text-violet-600",
                  title: "Permanent & Tamper-Proof",
                  desc: "BlockWards live on the blockchain forever. No school can alter, remove, or question the authenticity of a student's achievements."
                },
                {
                  icon: GraduationCap,
                  color: "bg-indigo-100 text-indigo-600",
                  title: "University Application Ready",
                  desc: "Students graduate with a verified on-chain portfolio — a powerful edge in competitive university admissions."
                },
                {
                  icon: Brain,
                  color: "bg-cyan-100 text-cyan-600",
                  title: "AI Handles the Heavy Lifting",
                  desc: "Automated scheduling, smart announcements, and AI-drafted communications cut teacher admin time dramatically."
                },
                {
                  icon: TrendingUp,
                  color: "bg-green-100 text-green-600",
                  title: "Real Motivation, Real Results",
                  desc: "Gamified rewards with genuine long-term value drive student engagement in ways traditional certificates never could."
                }
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-4 p-5 rounded-2xl border border-slate-100 bg-slate-50 hover:shadow-md transition-all duration-200">
                  <div className={`h-12 w-12 rounded-xl ${item.color} flex items-center justify-center flex-shrink-0`}>
                    <item.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">{item.title}</h4>
                    <p className="text-sm text-slate-600 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Target Users */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-200 text-slate-700 text-sm font-medium mb-4">
              <Users className="h-4 w-4" />
              Who It's For
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              Built for every person in the school
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              BlockWard AI serves K–12 schools and educational institutions — designed around the needs of four key user groups.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {roles.map((role, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                viewport={{ once: true }}
                className={`p-8 rounded-2xl border-2 ${role.bg} transition-all duration-300 hover:shadow-lg`}
              >
                <div className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${role.color} flex items-center justify-center mb-5 shadow-lg`}>
                  <role.icon className="h-7 w-7 text-white" />
                </div>
                <h3 className={`text-xl font-bold mb-3 ${role.textColor}`}>{role.role}</h3>
                <p className="text-slate-600 leading-relaxed">{role.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              Everything a modern school needs
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              One platform. Zero compromise. From blockchain credentials to AI-powered administration.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                viewport={{ once: true }}
                className={`p-8 rounded-2xl border-2 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${feature.highlight ? 'border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50' : 'border-slate-100 bg-slate-50'}`}
              >
                <div className={`h-14 w-14 rounded-2xl flex items-center justify-center mb-5 ${feature.highlight ? 'bg-gradient-to-br from-violet-600 to-indigo-600 shadow-lg shadow-violet-500/25' : 'bg-gradient-to-br from-slate-200 to-slate-300'}`}>
                  <feature.icon className={`h-7 w-7 ${feature.highlight ? 'text-white' : 'text-slate-600'}`} />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-3">{feature.title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{feature.description}</p>
                {feature.highlight && (
                  <div className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-violet-700 bg-violet-100 px-3 py-1.5 rounded-full">
                    <Star className="h-3 w-3" />
                    Core USP
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Industry Badge */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-violet-600 to-indigo-700">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div className="text-white">
              <p className="text-sm text-white/60 font-medium uppercase tracking-wider mb-2">Industry</p>
              <p className="text-2xl font-bold">EdTech</p>
              <p className="text-white/70 text-sm mt-1">Digital Learning & School Management</p>
            </div>
            <div className="text-white border-x border-white/20">
              <p className="text-sm text-white/60 font-medium uppercase tracking-wider mb-2">Market</p>
              <p className="text-2xl font-bold">K–12 Schools</p>
              <p className="text-white/70 text-sm mt-1">Global Educational Institutions</p>
            </div>
            <div className="text-white">
              <p className="text-sm text-white/60 font-medium uppercase tracking-wider mb-2">Technology</p>
              <p className="text-2xl font-bold">Blockchain + AI</p>
              <p className="text-white/70 text-sm mt-1">Ethereum Smart Contracts</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-slate-900">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-300 text-sm font-medium mb-8">
              <Sparkles className="h-4 w-4" />
              Ready to transform your school?
            </div>
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">
              Give students achievements that
              <span className="block mt-2 bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
                last a lifetime.
              </span>
            </h2>
            <p className="text-lg text-slate-400 mb-10 max-w-2xl mx-auto">
              Join schools using BlockWard AI to motivate students, streamline operations, and build permanent, verifiable achievement records on the blockchain.
            </p>
            <Button
              onClick={handleSignIn}
              size="lg"
              className="bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 text-lg px-12 py-6 shadow-2xl shadow-violet-500/30 border-0"
            >
              Get Started Free
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </motion.div>
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
            © 2026 BlockWard AI · EdTech · Blockchain-Secured Student Achievements
          </p>
        </div>
      </footer>
    </div>
  );
}