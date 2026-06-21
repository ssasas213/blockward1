import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Shield, Mail, Lock, Eye, EyeOff, User, Loader2, AlertCircle, CheckCircle2, GraduationCap, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const ROLES = [
  { key: 'student', label: 'Student', icon: GraduationCap, color: 'from-blue-500 to-cyan-500', active: 'border-blue-500 ring-2 ring-blue-200 bg-blue-50', text: 'text-blue-700' },
  { key: 'teacher', label: 'Teacher', icon: BookOpen, color: 'from-violet-500 to-purple-500', active: 'border-violet-500 ring-2 ring-violet-200 bg-violet-50', text: 'text-violet-700' },
  { key: 'admin', label: 'Admin', icon: Shield, color: 'from-rose-500 to-orange-500', active: 'border-rose-500 ring-2 ring-rose-200 bg-rose-50', text: 'text-rose-700' },
];

export default function Signup() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('student');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

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
      // Register the user via Base44 email/password auth
      await base44.auth.register({ email: email.trim(), password });

      // After registration, log them in to get the session
      await base44.auth.login({ email: email.trim(), password });
      const user = await base44.auth.me();

      // Determine initial status — students are active, teachers/admins need approval
      const status = role === 'student' ? 'active' : 'inactive';

      const [firstName, ...lastParts] = fullName.trim().split(' ');
      const lastName = lastParts.join(' ') || '';

      // Create a pending UserProfile — no admin/teacher permissions granted automatically
      await base44.entities.UserProfile.create({
        user_email: user.email,
        user_type: role,
        first_name: firstName,
        last_name: lastName,
        status,
        can_issue_blockwards: false, // explicitly off until admin approves
      });

      setSuccess(true);

      if (role === 'student') {
        // Students go straight to onboarding to fill in school code etc.
        setTimeout(() => { window.location.href = '/Onboarding'; }, 1500);
      }
      // Teachers/admins see the pending message and wait for admin action

    } catch (err) {
      const msg = err?.message || '';
      if (msg.toLowerCase().includes('exists') || msg.toLowerCase().includes('taken') || msg.toLowerCase().includes('already')) {
        setError('An account with this email already exists. Try signing in instead.');
      } else {
        setError(msg || 'Sign up failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const selectedRole = ROLES.find(r => r.key === role);

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-950 to-indigo-950 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md text-center">
          <div className="bg-white rounded-2xl shadow-2xl p-10">
            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-3">
              {role === 'student' ? 'Account Created!' : 'Request Submitted!'}
            </h2>
            {role === 'student' ? (
              <p className="text-slate-600 text-sm mb-6">Your student account is ready. Redirecting to setup...</p>
            ) : (
              <>
                <p className="text-slate-600 text-sm mb-4">
                  Your <strong>{selectedRole?.label}</strong> account request has been received.
                </p>
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 mb-6">
                  Your account is pending school approval. An administrator will review your request and activate your account. You'll be able to sign in once approved.
                </div>
              </>
            )}
            <Link to="/Login">
              <Button variant="outline" className="w-full">Back to Sign In</Button>
            </Link>
          </div>
        </div>
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
          <p className="text-slate-400 text-sm mt-2">Create your school achievement account</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-bold text-slate-900 mb-1">Create your account</h2>
          <p className="text-sm text-slate-500 mb-6">Join BlockWard — your school's achievement platform.</p>

          {/* Role selector */}
          <div className="mb-5">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-2">I am a...</label>
            <div className="grid grid-cols-3 gap-2">
              {ROLES.map((r) => {
                const Icon = r.icon;
                const isActive = role === r.key;
                return (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => setRole(r.key)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all duration-200 cursor-pointer ${isActive ? r.active : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                  >
                    <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${r.color} flex items-center justify-center`}>
                      <Icon className="h-4 w-4 text-white" />
                    </div>
                    <span className={`text-xs font-semibold ${isActive ? r.text : 'text-slate-600'}`}>{r.label}</span>
                  </button>
                );
              })}
            </div>
            {(role === 'teacher' || role === 'admin') && (
              <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {role === 'teacher' ? 'Teacher' : 'Admin'} accounts require school administrator approval before access.
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Jane Smith"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="pl-9"
                  autoComplete="name"
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
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="pl-9 pr-10"
                  autoComplete="new-password"
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
                  placeholder="Repeat password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="pl-9"
                  autoComplete="new-password"
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
              className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-semibold py-2.5 shadow-lg shadow-violet-500/25"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create Account
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-500">
              Already have an account?{' '}
              <Link to="/Login" className="text-violet-600 hover:text-violet-800 font-semibold">
                Sign In
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