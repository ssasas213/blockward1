import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { getPlatformConfig } from '@/lib/platformConfig';
import { handlePostLoginRedirect } from '@/lib/authHelpers';
import { Shield, Mail, Lock, Eye, EyeOff, User, Loader2, AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';

export default function PlatformSignupPage({ platformId }) {
  const navigate = useNavigate();
  const platform = getPlatformConfig(platformId);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState(platform.signupRoles[0].key);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!fullName.trim() || !email.trim() || !password || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await base44.auth.register({ email: email.trim(), password });
      await base44.auth.loginViaEmailPassword(email.trim(), password);
      const user = await base44.auth.me();

      // Students/members are active; coaches/admins need approval
      const status = role === 'student' ? 'active' : 'inactive';

      const [firstName, ...lastParts] = fullName.trim().split(' ');
      const lastName = lastParts.join(' ') || '';

      await base44.entities.UserProfile.create({
        user_email: user.email,
        user_type: role,
        first_name: firstName,
        last_name: lastName,
        status,
      });

      // Redirect to the correct platform dashboard
      await handlePostLoginRedirect(platformId);
    } catch (err) {
      const msg = err?.message || '';
      if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('exists')) {
        setError('An account with this email already exists. Try signing in instead.');
      } else {
        setError(msg || 'Sign up failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4 py-12">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute -top-40 -right-40 h-96 w-96 rounded-full bg-gradient-to-br ${platform.gradient} opacity-10 blur-3xl`} />
        <div className={`absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-gradient-to-br ${platform.gradient} opacity-10 blur-3xl`} />
      </div>

      <div className="relative w-full max-w-md">
        <button
          onClick={() => navigate('/Signup')}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="text-sm">Choose a different platform</span>
        </button>

        {/* Branding */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex flex-col items-center gap-3">
            <div className={`h-16 w-16 rounded-2xl bg-gradient-to-br ${platform.gradient} flex items-center justify-center shadow-2xl`}>
              <Shield className="h-8 w-8 text-white" />
            </div>
            <span className="text-2xl font-extrabold text-white tracking-tight">{platform.name}</span>
          </Link>
          <p className="text-slate-400 text-sm mt-2">{platform.signupSubtitle}</p>
        </div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-white rounded-2xl shadow-2xl p-8"
        >
          <h2 className="text-xl font-bold text-slate-900 mb-1">Create your account</h2>
          <p className="text-sm text-slate-500 mb-6">Join {platform.name}.</p>

          {/* Role selection */}
          <div className="mb-5">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3 block">I am a...</label>
            <div className="grid grid-cols-1 gap-2">
              {platform.signupRoles.map((r) => {
                const isSelected = role === r.key;
                return (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => setRole(r.key)}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                      isSelected ? r.active : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${r.color} flex items-center justify-center flex-shrink-0`}>
                      <Shield className="h-5 w-5 text-white" />
                    </div>
                    <span className={`text-sm font-semibold ${isSelected ? r.text : 'text-slate-700'}`}>{r.label}</span>
                    {isSelected && <CheckCircle2 className={`h-4 w-4 ml-auto ${r.text}`} />}
                  </button>
                );
              })}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="pl-9"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="pl-9"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="pl-9 pr-10"
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

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="pl-9"
                  disabled={loading}
                />
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
              className={`w-full bg-gradient-to-r ${platform.buttonGradient} hover:opacity-90 text-white font-semibold py-2.5 shadow-lg border-0`}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create Account
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-500">
              Already have an account?{' '}
              <Link to={platform.loginPath} className={`${platform.accent} hover:opacity-80 font-semibold`}>
                Sign In
              </Link>
            </p>
          </div>
        </motion.div>

        <p className="text-center text-xs text-slate-500 mt-6">
          © 2026 {platform.name} · Blockchain-Secured {platform.credentialLabel}s
        </p>
      </div>
    </div>
  );
}