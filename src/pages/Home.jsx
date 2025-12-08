import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { 
  Shield, Award, Users, BookOpen, Calendar, 
  ChevronRight, Check, Sparkles, Lock, Zap,
  GraduationCap, BarChart3
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const authenticated = await base44.auth.isAuthenticated();
      setIsAuthenticated(authenticated);
      if (authenticated) {
        // Redirect to appropriate dashboard
        const user = await base44.auth.me();
        const profiles = await base44.entities.UserProfile.filter({ user_email: user.email });
        if (profiles.length > 0) {
          const profile = profiles[0];
          if (profile.user_type === 'admin') {
            window.location.href = createPageUrl('AdminDashboard');
          } else if (profile.user_type === 'teacher') {
            window.location.href = createPageUrl('TeacherDashboard');
          } else {
            window.location.href = createPageUrl('StudentDashboard');
          }
        } else {
          window.location.href = createPageUrl('Onboarding');
        }
      }
    } catch (e) {
      console.log('Not authenticated');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = () => {
    base44.auth.redirectToLogin(createPageUrl('Onboarding'));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center animate-pulse">
            <Shield className="h-8 w-8 text-white" />
          </div>
        </div>
      </div>
    );
  }

  const features = [
    {
      icon: Shield,
      title: "Blockchain Verified",
      description: "Every achievement is permanently recorded on the Polygon blockchain as a soulbound NFT"
    },
    {
      icon: Award,
      title: "Achievement Tracking",
      description: "Comprehensive behaviour and achievement point system with detailed analytics"
    },
    {
      icon: Calendar,
      title: "Smart Timetables",
      description: "Dynamic scheduling for students and teachers with room management"
    },
    {
      icon: BookOpen,
      title: "Resource Library",
      description: "Centralized hub for PDFs, notes, and learning materials"
    },
    {
      icon: Users,
      title: "Class Management",
      description: "Easy class creation, student enrollment, and progress tracking"
    },
    {
      icon: BarChart3,
      title: "Detailed Reports",
      description: "Visual analytics on behaviour trends and achievement distributions"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold text-xl text-slate-900">BlockWard</span>
            </div>
            <Button 
              onClick={handleLogin}
              className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-lg shadow-violet-500/25"
            >
              Get Started
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-100 text-violet-700 text-sm font-medium mb-6">
                <Sparkles className="h-4 w-4" />
                Powered by Polygon Blockchain
              </div>
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-slate-900 leading-tight mb-6">
                School Management
                <span className="block bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                  Meets Blockchain
                </span>
              </h1>
              <p className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto">
                Issue verifiable, tamper-proof achievements to students as soulbound NFTs. 
                Track behaviour, manage classes, and create lasting records of excellence.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button 
                  onClick={handleLogin}
                  size="lg"
                  className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-xl shadow-violet-500/25 h-14 px-8 text-lg"
                >
                  Start Free
                  <ChevronRight className="h-5 w-5 ml-2" />
                </Button>
                <div className="flex items-center gap-2 text-slate-600">
                  <Lock className="h-4 w-4" />
                  <span className="text-sm">Secure & School-Safe</span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Hero Visual */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="mt-20 relative"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-violet-600/20 to-indigo-600/20 rounded-3xl blur-3xl" />
            <div className="relative bg-white rounded-2xl shadow-2xl shadow-slate-200/50 border border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-violet-600 to-indigo-600 h-2" />
              <div className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Sample BlockWard Card */}
                  <div className="bg-gradient-to-br from-violet-500 to-indigo-600 rounded-2xl p-6 text-white">
                    <div className="flex items-center justify-between mb-4">
                      <Shield className="h-8 w-8" />
                      <span className="text-xs bg-white/20 px-2 py-1 rounded-full">Verified</span>
                    </div>
                    <h3 className="text-xl font-bold mb-1">Top Mathematics</h3>
                    <p className="text-white/80 text-sm mb-4">Term 1 Achievement Award</p>
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
                        <GraduationCap className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs text-white/60">Issued to</p>
                        <p className="text-sm font-medium">Alex Johnson</p>
                      </div>
                    </div>
                  </div>

                  {/* Stats Preview */}
                  <div className="bg-slate-50 rounded-2xl p-6">
                    <h3 className="text-slate-900 font-semibold mb-4">Achievement Points</h3>
                    <div className="text-4xl font-bold text-violet-600 mb-2">1,247</div>
                    <p className="text-sm text-slate-500 mb-4">+156 this week</p>
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full w-3/4 bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full" />
                    </div>
                  </div>

                  {/* Class Preview */}
                  <div className="bg-slate-50 rounded-2xl p-6">
                    <h3 className="text-slate-900 font-semibold mb-4">My Classes</h3>
                    <div className="space-y-3">
                      {['Mathematics', 'Physics', 'English'].map((subject, i) => (
                        <div key={i} className="flex items-center gap-3 p-2 bg-white rounded-lg">
                          <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                            ['bg-violet-100 text-violet-600', 'bg-blue-100 text-blue-600', 'bg-emerald-100 text-emerald-600'][i]
                          }`}>
                            <BookOpen className="h-5 w-5" />
                          </div>
                          <span className="text-sm font-medium text-slate-700">{subject}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              Everything you need for modern school management
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              A complete platform that combines traditional school management with cutting-edge blockchain technology
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="bg-white rounded-2xl p-6 shadow-lg shadow-slate-200/50 border border-slate-100 hover:shadow-xl transition-shadow"
              >
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center mb-4 ${
                  ['bg-violet-100 text-violet-600', 'bg-amber-100 text-amber-600', 'bg-blue-100 text-blue-600',
                   'bg-emerald-100 text-emerald-600', 'bg-rose-100 text-rose-600', 'bg-indigo-100 text-indigo-600'][index]
                }`}>
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{feature.title}</h3>
                <p className="text-slate-600">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-gradient-to-br from-violet-600 to-indigo-600 rounded-3xl p-12 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
            <div className="relative">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Ready to transform your school?
              </h2>
              <p className="text-lg text-white/80 mb-8 max-w-xl mx-auto">
                Join schools worldwide using BlockWard to create verifiable, lasting records of student achievement
              </p>
              <Button 
                onClick={handleLogin}
                size="lg"
                className="bg-white text-violet-600 hover:bg-white/90 h-14 px-8 text-lg font-semibold"
              >
                Get Started Now
                <Zap className="h-5 w-5 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-slate-200">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-violet-600" />
            <span className="font-semibold text-slate-900">BlockWard</span>
          </div>
          <p className="text-sm text-slate-500">
            © 2024 BlockWard. Built on Polygon.
          </p>
        </div>
      </footer>
    </div>
  );
}