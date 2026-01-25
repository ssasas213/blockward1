import React, { useEffect, useState } from 'react';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { 
  Shield, Award, CheckCircle2, Sparkles, ArrowRight, GraduationCap, Loader2 
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function Home() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    // Optional: Check auth silently without blocking render
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const isAuth = await base44.auth.isAuthenticated();
      if (isAuth) {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        const profiles = await base44.entities.UserProfile.filter({ user_email: currentUser.email });
        if (profiles.length > 0) {
          setProfile(profiles[0]);
        }
      }
    } catch (error) {
      // Silently fail - user not authenticated
    }
  };

  const handleSignIn = () => {
    base44.auth.redirectToLogin(createPageUrl('Onboarding'));
  };

  const handleGoToDashboard = () => {
    if (profile) {
      const dashboardMap = {
        admin: 'AdminDashboard',
        teacher: 'TeacherDashboard',
        student: 'StudentDashboard'
      };
      const dashboard = dashboardMap[profile.user_type] || 'StudentDashboard';
      window.location.href = createPageUrl(dashboard);
    }
  };

  const features = [
    {
      icon: Shield,
      title: 'Tamper-Proof Credentials',
      description: 'Digital credentials stored permanently on-chain, ensuring they cannot be altered or forged.'
    },
    {
      icon: CheckCircle2,
      title: 'Easy Verification',
      description: 'Schools, employers, and institutions can instantly verify credentials without intermediaries.'
    },
    {
      icon: Award,
      title: 'Secure Permissions',
      description: 'Only authorized issuers can mint BlockWards, with built-in revocation capabilities.'
    },
    {
      icon: Sparkles,
      title: 'Smart Contract Powered',
      description: 'Powered by Ethereum smart contracts on Sepolia testnet for secure, transparent operations.'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-xl text-slate-900">BlockWard</span>
          </div>
          {user && profile ? (
            <Button onClick={handleGoToDashboard} className="bg-gradient-to-r from-violet-600 to-indigo-600">
              Go to Dashboard
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSignIn} className="bg-gradient-to-r from-violet-600 to-indigo-600">
              Sign In
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-100 text-violet-700 text-sm font-medium mb-6">
              <Sparkles className="h-4 w-4" />
              Powered by Ethereum Smart Contracts
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 mb-6">
              BlockWard – Verifiable Digital
              <span className="block mt-2 bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                Credentials Powered by Smart Contracts
              </span>
            </h1>
            <p className="text-xl text-slate-600 mb-8 max-w-3xl mx-auto">
              Issue, manage, and verify educational achievements securely using BlockWards on the blockchain.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                onClick={handleSignIn}
                className="bg-gradient-to-r from-violet-600 to-indigo-600 text-lg px-8 py-6"
              >
                Sign in with Google
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                className="text-lg px-8 py-6 border-2"
              >
                Learn More
              </Button>
            </div>
          </motion.div>

          {/* Visual Preview */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="mt-20"
          >
            <div className="bg-white rounded-2xl shadow-2xl p-8 border border-slate-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Sample BlockWard */}
                <div className="bg-gradient-to-br from-violet-500 to-indigo-600 rounded-2xl p-8 text-white">
                  <div className="flex items-center justify-between mb-6">
                    <Shield className="h-10 w-10" />
                    <span className="text-xs bg-white/20 px-3 py-1 rounded-full font-medium">Verified</span>
                  </div>
                  <h3 className="text-2xl font-bold mb-2">Outstanding Achievement</h3>
                  <p className="text-white/80 mb-6">Term 1 Excellence Award</p>
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                      <GraduationCap className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-xs text-white/60">Issued to</p>
                      <p className="font-medium">Student Name</p>
                    </div>
                  </div>
                </div>

                {/* Info Card */}
                <div className="flex flex-col justify-center space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
                      <Shield className="h-5 w-5 text-violet-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900 mb-1">Blockchain Verified</h4>
                      <p className="text-sm text-slate-600">Every credential is recorded on Ethereum</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900 mb-1">Instant Verification</h4>
                      <p className="text-sm text-slate-600">Anyone can verify authenticity on-chain</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
                      <Award className="h-5 w-5 text-violet-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900 mb-1">Permanent Record</h4>
                      <p className="text-sm text-slate-600">Credentials can never be lost or altered</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              Why Choose BlockWard?
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Secure, verifiable, and permanent digital credentials for the modern educational institution
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="text-center"
              >
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center mx-auto mb-4">
                  <feature.icon className="h-8 w-8 text-violet-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{feature.title}</h3>
                <p className="text-slate-600 text-sm">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-violet-600 to-indigo-600">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Ready to Issue Verifiable Credentials?
            </h2>
            <p className="text-lg text-white/90 mb-8 max-w-2xl mx-auto">
              Join institutions using BlockWard to create permanent, verifiable records of achievement
            </p>
            <Button 
              onClick={handleSignIn}
              size="lg"
              className="bg-white text-violet-600 hover:bg-slate-50 text-lg px-8 py-6 shadow-xl"
            >
              Get Started Now
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-violet-600" />
            <span className="font-semibold text-slate-900">BlockWard</span>
          </div>
          <p className="text-sm text-slate-500">
            © 2026 BlockWard. Powered by Ethereum smart contracts.
          </p>
        </div>
      </footer>
    </div>
  );
}