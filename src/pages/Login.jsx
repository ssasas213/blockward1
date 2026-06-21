import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { handlePostLoginRedirect } from '@/lib/authHelpers';
import { Shield, Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, Clock, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  const [accountStatus, setAccountStatus] = useState(null); // 'suspended' | 'pending' | 'no_profile'

  useEffect(() => {
    // If already logged in, redirect immediately
    (async () => {
      try {
        const user = await base44.auth.me();
        if (user) {
          await handlePostLoginRedirect();
        }
      } catch (_) {
        // not logged in — show form
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setAccountStatus(null);
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      await base44.auth.login({ email: email.trim(), password });
      const result = await handlePostLoginRedirect();
      if (result === 'suspended') {
        setAccountStatus('suspended');
      }
    } catch (err) {
      const msg = err?.message || '';
      if (msg.toLowerCase().includes('pending') || msg.toLowerCase().includes('approval')) {
        setAccountStatus('pending');
      } else if (msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('password') || msg.toLowerCase().includes('credentials')) {
        setError('Invalid email or password. Please try again.');
      } else {
        setError(msg || 'Sign in failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-indigo-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-950 to-indigo-950 flex items-center justify-center px-4 py-12">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Branding */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex flex-col items-center gap-2">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-2xl shadow-violet-500/30">
              <Shield className="h-8 w-8 text-white" />
            </div>
            <span className="text-2xl font-extrabold text-white tracking-tight">BlockWard</span>
          </Link>
          <p className="text-slate-400 text-sm mt-2">Sign in to your school achievement vault</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-bold text-slate-900 mb-1">Welcome back</h2>
          <p className="text-sm text-slate-500 mb-6">Sign in to your BlockWard account.</p>

          {/* Account status messages */}
          {accountStatus === 'pending' && (
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl mb-5 text-sm text-amber-800">
              <Clock className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p>Your account is pending school approval. Please contact your school administrator.</p>
            </div>
          )}
          {accountStatus === 'suspended' && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl mb-5 text-sm text-red-800">
              <Ban className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p>Your account has been suspended. Contact your school administrator.</p>
            </div>
          )}
          {accountStatus === 'no_profile' && (
            <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl mb-5 text-sm text-blue-800">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p>Your account exists but your BlockWard profile has not been set up yet. Contact your school administrator.</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
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
                  disabled={loading}
                />
              </div>
              <p className="text-xs text-slate-400">Use your school email or personal email.</p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Password</label>
                <Link to="/ForgotPassword" className="text-xs text-violet-600 hover:text-violet-800 font-medium">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="pl-9 pr-10"
                  autoComplete="current-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(v => !v)}
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
              className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-semibold py-2.5 shadow-lg shadow-violet-500/25"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Sign In
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-500">
              Don't have an account?{' '}
              <Link to="/Signup" className="text-violet-600 hover:text-violet-800 font-semibold">
                Create Account
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          © 2026 BlockWard · Blockchain-Secured Student Achievements
        </p>
      </div>
    </div>
  );
}