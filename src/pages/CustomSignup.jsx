import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Shield, ArrowRight, Loader2, AlertCircle, Users, GraduationCap, UserCog } from 'lucide-react';
import { motion } from 'framer-motion';

export default function CustomSignup() {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const authenticated = await base44.auth.isAuthenticated();
      if (authenticated) {
        window.location.href = createPageUrl('Onboarding');
      }
    } catch (e) {
      console.log('Not authenticated');
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.fullName || !formData.email || !formData.password || !formData.role) {
      setError('Please fill in all required fields');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      // Use Base44's signup redirect
      // Store role in localStorage temporarily so onboarding can use it
      localStorage.setItem('pendingUserRole', formData.role);
      localStorage.setItem('pendingUserName', formData.fullName);
      base44.auth.redirectToLogin(createPageUrl('Onboarding'));
    } catch (err) {
      setError('Signup failed. Please try again.');
      setLoading(false);
    }
  };

  const roles = [
    {
      value: 'student',
      icon: GraduationCap,
      title: 'Student',
      description: 'Join classes and earn achievements',
      color: 'from-blue-500 to-cyan-500'
    },
    {
      value: 'teacher',
      icon: Users,
      title: 'Teacher',
      description: 'Create classes and issue BlockWards',
      color: 'from-violet-500 to-purple-500'
    },
    {
      value: 'admin',
      icon: UserCog,
      title: 'Admin',
      description: 'Manage school and users',
      color: 'from-rose-500 to-orange-500'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50 to-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        {/* Left Side - Branding */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="hidden lg:block space-y-8"
        >
          <div>
            <div className="flex items-center gap-4 mb-6">
              <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-2xl shadow-violet-500/30">
                <Shield className="h-10 w-10 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-slate-900">BlockWard</h1>
                <p className="text-slate-600 text-lg">Verified school achievements on the blockchain</p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <h2 className="text-4xl font-bold text-slate-900 mb-4">
                Join BlockWard Today
              </h2>
              <p className="text-xl text-slate-600">
                Create your account and start experiencing the future of school management with blockchain technology.
              </p>
            </div>

            <div className="space-y-4">
              {[
                'Blockchain-verified achievements',
                'Real-time point tracking',
                'Secure & tamper-proof records',
                'Easy class management'
              ].map((feature, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-violet-100 flex items-center justify-center">
                    <Shield className="h-4 w-4 text-violet-600" />
                  </div>
                  <span className="text-slate-700">{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Right Side - Signup Form */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <Card className="border-0 shadow-2xl">
            <CardContent className="p-8 md:p-12">
              <div className="lg:hidden mb-8 text-center">
                <div className="inline-flex items-center gap-3 mb-4">
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg">
                    <Shield className="h-6 w-6 text-white" />
                  </div>
                  <span className="text-2xl font-bold text-slate-900">BlockWard</span>
                </div>
              </div>

              <div className="mb-8">
                <h2 className="text-3xl font-bold text-slate-900 mb-2">Create Account</h2>
                <p className="text-slate-600">Sign up to get started</p>
              </div>

              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <form onSubmit={handleSignup} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name *</Label>
                  <Input
                    id="fullName"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="John Doe"
                    className="h-12"
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="you@school.edu"
                    className="h-12"
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="At least 6 characters"
                    className="h-12"
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password *</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    placeholder="Re-enter password"
                    className="h-12"
                    disabled={loading}
                  />
                </div>

                <div className="space-y-3">
                  <Label>I am a *</Label>
                  <RadioGroup
                    value={formData.role}
                    onValueChange={(value) => setFormData({ ...formData, role: value })}
                    disabled={loading}
                  >
                    {roles.map((role) => (
                      <Label
                        key={role.value}
                        htmlFor={role.value}
                        className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          formData.role === role.value
                            ? 'border-violet-600 bg-violet-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <RadioGroupItem value={role.value} id={role.value} className="sr-only" />
                        <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${role.color} flex items-center justify-center ${
                          formData.role === role.value ? 'shadow-lg' : ''
                        }`}>
                          <role.icon className="h-6 w-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-slate-900">{role.title}</p>
                          <p className="text-sm text-slate-500">{role.description}</p>
                        </div>
                      </Label>
                    ))}
                  </RadioGroup>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-14 text-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-lg shadow-violet-500/25"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    <>
                      Create Account
                      <ArrowRight className="h-5 w-5 ml-2" />
                    </>
                  )}
                </Button>
              </form>

              <div className="mt-8 text-center">
                <p className="text-slate-600">
                  Already have an account?{' '}
                  <Link to={createPageUrl('CustomLogin')} className="font-semibold text-violet-600 hover:text-violet-700">
                    Log in
                  </Link>
                </p>
              </div>

              <div className="mt-8 pt-8 border-t border-slate-100 text-center text-sm text-slate-500">
                By signing up, you agree to our Terms of Service and Privacy Policy
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}