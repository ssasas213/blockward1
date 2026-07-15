import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Shield, GraduationCap, Users, ArrowRight, Loader2,
  Building2, Trophy, Clock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { createPageUrl } from '@/utils';

const ACCOUNT_TYPES = [
  {
    key: 'student',
    roleLabel: null,
    icon: GraduationCap,
    title: 'Student',
    description: 'Earn and track your achievements',
  },
  {
    key: 'teacher',
    roleLabel: null,
    icon: Users,
    title: 'Teacher',
    description: 'Verify and issue achievements',
  },
  {
    key: 'admin',
    roleLabel: null,
    icon: Shield,
    title: 'Admin',
    description: 'Manage school and approve records',
  },
  {
    key: 'student',
    roleLabel: 'Organisation Member',
    icon: Trophy,
    title: 'Organisation Member',
    description: 'Member of a club or organisation',
  },
  {
    key: 'admin',
    roleLabel: 'Organisation Admin',
    icon: Building2,
    title: 'Organisation Admin',
    description: 'Manage an organisation',
  },
];

export default function Onboarding() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [selectedType, setSelectedType] = useState(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  useEffect(() => {
    loadAuth();
  }, []);

  const loadAuth = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      if (currentUser) {
        const profiles = await base44.entities.UserProfile.filter({ user_email: currentUser.email });
        if (profiles.length > 0 && profiles[0].status !== 'pending_approval') {
          // Already has an active profile — redirect to login which will route to dashboard
          window.location.href = '/Login';
          return;
        }
        if (profiles.length > 0 && profiles[0].status === 'pending_approval') {
          // Already pending — show pending state
          setDone(true);
          return;
        }
      }
    } catch {
      setUser(null);
    } finally {
      setAuthLoading(false);
      setInitialized(true);
    }
  };

  useEffect(() => {
    if (!initialized || authLoading) return;

    if (!user) {
      window.location.href = '/Login';
      return;
    }

    setChecking(false);
  }, [user, initialized, authLoading]);

  const handleSubmit = async () => {
    if (!firstName.trim() || !lastName.trim() || !selectedType) {
      toast.error('Please fill in all fields.');
      return;
    }

    setSubmitting(true);
    try {
      const accountType = ACCOUNT_TYPES[selectedType];

      await base44.entities.UserProfile.create({
        user_email: user.email,
        user_type: accountType.key,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        role_label: accountType.roleLabel || undefined,
        status: 'active',
        total_achievement_points: 0,
        total_behaviour_points: 0,
      });

      // Redirect based on role
      if (accountType.key === 'admin') {
        window.location.href = createPageUrl('SchoolSetup');
      } else if (accountType.key === 'teacher') {
        window.location.href = createPageUrl('JoinSchool');
      } else {
        window.location.href = createPageUrl('StudentDashboard');
      }
    } catch (error) {
      console.error('Error creating profile:', error);
      toast.error(error.message || 'Failed to create account');
      setSubmitting(false);
    }
  };

  if (authLoading || checking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-violet-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-violet-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl border-0">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center mb-5">
              <Clock className="h-8 w-8 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Account Created — Pending Approval</h2>
            <p className="text-sm text-slate-500 mb-6">
              Your BlockWard account has been created. An administrator needs to approve your
              account before you can access the platform. This is a security measure to ensure
              only authorized users gain access.
            </p>
            <Button
              onClick={() => base44.auth.logout(window.location.origin + '/Login')}
              variant="outline"
              className="w-full"
            >
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-violet-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg shadow-xl border-0">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center mb-4 shadow-lg shadow-violet-500/25">
            <Shield className="h-7 w-7 text-white" />
          </div>
          <CardTitle className="text-2xl">Welcome to BlockWard</CardTitle>
          <CardDescription>Let's set up your account</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Account type selection */}
            <div>
              <Label className="text-base mb-4 block">I am a...</Label>
              <div className="space-y-2">
                {ACCOUNT_TYPES.map((type, idx) => {
                  const isSelected = selectedType === idx;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedType(idx)}
                      className={`flex items-center gap-4 w-full p-3 rounded-xl border-2 cursor-pointer transition-all text-left ${
                        isSelected
                          ? 'border-violet-600 bg-violet-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        isSelected ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        <type.icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm text-slate-900">{type.title}</p>
                        <p className="text-xs text-slate-500">{type.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Name fields */}
            <AnimatePresence>
              {selectedType !== null && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>First Name</Label>
                      <Input
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="John"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Last Name</Label>
                      <Input
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Doe"
                      />
                    </div>
                  </div>

                  <Button
                    onClick={handleSubmit}
                    disabled={!firstName.trim() || !lastName.trim() || submitting}
                    className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        Create Account
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}