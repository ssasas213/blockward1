import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Shield, Loader2, Mail, Lock, Eye, EyeOff, GraduationCap, BookOpen, ChevronRight, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const ROLE_OPTIONS = [
  {
    key: 'student',
    label: 'Student Login',
    icon: GraduationCap,
    color: 'from-blue-500 to-cyan-500',
    bg: 'bg-blue-50 border-blue-200',
    active: 'border-blue-500 bg-blue-50 ring-2 ring-blue-300',
    text: 'text-blue-700',
    dash: 'StudentDashboard',
  },
  {
    key: 'teacher',
    label: 'Teacher Login',
    icon: BookOpen,
    color: 'from-violet-500 to-purple-500',
    bg: 'bg-violet-50 border-violet-200',
    active: 'border-violet-500 bg-violet-50 ring-2 ring-violet-300',
    text: 'text-violet-700',
    dash: 'TeacherDashboard',
  },
  {
    key: 'admin',
    label: 'Admin Login',
    icon: Shield,
    color: 'from-rose-500 to-orange-500',
    bg: 'bg-rose-50 border-rose-200',
    active: 'border-rose-500 bg-rose-50 ring-2 ring-rose-300',
    text: 'text-rose-700',
    dash: 'AdminDashboard',
  },
];

export default function Login() {
  const [selectedRole, setSelectedRole] = useState('student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    // If already logged in, redirect to correct dashboard
    (async () => {
      try {
        const user = await base44.auth.me();
        if (user) {
          const profiles = await base44.entities.UserProfile.filter({ user_email: user.email });
          const role = profiles[0]?.user_type || 'student';
          const dashMap = { admin: 'AdminDashboard', teacher: 'TeacherDashboard', student: 'StudentDashboard' };
          window.location.href = `/${dashMap[role] || 'StudentDashboard'}`;
        }
      } catch (_) {
        // not logged in
      } finally {
        setCheckingAuth(false);
      }
    })();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      if (isSignUp) {
        await base44.auth.register({ email, password });
      } else {
        await base44.auth.login({ email, password });
      }
      // After login, check profile and route by role
      try {
        const user = await base44.auth.me();
        const profiles = await base44.entities.UserProfile.filter({ user_email: user.email });
        const role = profiles[0]?.user_type || selectedRole;
        const dashMap = { admin: 'AdminDashboard', teacher: 'TeacherDashboard', student: 'StudentDashboard' };
        window.location.href = `/${dashMap[role] || 'StudentDashboard'}`;
      } catch (_) {
        window.location.href = '/Onboarding';
      }
    } catch (err) {
      setError(err?.message || (isSignUp ? 'Sign up failed. Please try again.' : 'Invalid email or password. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const activeRole = ROLE_OPTIONS.find(r => r.key === selectedRole);

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-indigo-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-950 to-indigo-950 flex items-center justify-center px-4 py-12">
      {/* Background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-2xl shadow-violet-500/30 mb-4">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-white">BlockWard</h1>
          <p className="text-slate-400 text-sm mt-1">Blockchain-Secured School Achievements</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-bold text-slate-900 mb-1">
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </h2>
          <p className="text-sm text-slate-500 mb-6">
            {isSignUp ? 'Join BlockWard — your school\'s achievement platform.' : 'Sign in to your BlockWard account.'}
          </p>

          {/* Role selector */}
          <div className="grid grid-cols-3 gap-2 mb-6">
            {ROLE_OPTIONS.map((role) => {
              const Icon = role.icon;
              const isActive = selectedRole === role.key;
              return (
                <button
                  key={role.key}
                  onClick={() => setSelectedRole(role.key)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all duration-200 cursor-pointer ${isActive ? role.active : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                >
                  <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${role.color} flex items-center justify-center`}>
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                  <span className={`text-xs font-semibold ${isActive ? role.text : 'text-slate-600'}`}>
                    {role.label.replace(' Login', '')}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="email"
                  placeholder="you@school.ac.uk"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="pl-9"
                  autoComplete="email"
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">Use your school email or personal email.</p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="pl-9 pr-9"
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className={`w-full bg-gradient-to-r ${activeRole?.color || 'from-violet-500 to-indigo-500'} text-white font-semibold py-2.5 shadow-lg`}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <ChevronRight className="h-4 w-4 mr-2" />
              )}
              {isSignUp ? 'Create Account' : `Sign in as ${activeRole?.label.replace(' Login', '') || 'Student'}`}
            </Button>
          </form>

          {/* Toggle sign up / sign in */}
          <div className="mt-6 text-center">
            <button
              onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
              className="text-sm text-violet-600 hover:text-violet-800 font-medium"
            >
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </div>

          {/* Divider */}
          <div className="my-5 flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400">or</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* Google sign-in — uses platform redirect (optional) */}
          <div className="space-y-2">
            <button
              onClick={() => base44.auth.redirectToLogin(window.location.origin + '/Onboarding')}
              className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border-2 border-slate-200 rounded-xl bg-white hover:bg-slate-50 transition-colors duration-200 text-sm font-medium text-slate-700"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Sign in with Google
            </button>
            <p className="text-center text-xs text-slate-400">Google sign-in is optional.</p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-500 mt-6">
          © 2026 BlockWard · Blockchain-Secured Student Achievements
        </p>
      </div>
    </div>
  );
}