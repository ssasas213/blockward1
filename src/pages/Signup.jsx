import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, ArrowRight, ArrowLeft, Loader2, AlertCircle, Mail } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { createPageUrl } from '@/utils';
import RolePicker, { ROLES } from '@/components/auth/RolePicker';

function GoogleIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

const SIGNUP_STORAGE_KEYS = {
  role: 'blockward_signup_role',
  first: 'blockward_signup_first',
  last: 'blockward_signup_last',
};

function routeAfterProfile(role) {
  window.location.href = role === 'admin' ? createPageUrl('SchoolSetup') : createPageUrl('JoinSchool');
}

// Same UserProfile shape Onboarding.jsx creates — so no downstream code changes.
async function createProfile(user, role, firstName, lastName) {
  await base44.entities.UserProfile.create({
    user_email: user.email,
    user_type: role,
    first_name: firstName.trim(),
    last_name: lastName.trim(),
    status: 'active',
    total_achievement_points: 0,
    total_behaviour_points: 0,
  });
}

export default function Signup() {
  const [authChecking, setAuthChecking] = useState(true);
  const [step, setStep] = useState('role'); // 'role' | 'details' | 'otp'
  const [selectedRole, setSelectedRole] = useState(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const currentUser = await base44.auth.me();
        if (!currentUser) { setAuthChecking(false); return; }

        // Authenticated — check whether this is a Google return with a pending role.
        const profiles = await base44.entities.UserProfile.filter({ user_email: currentUser.email });
        if (profiles.length > 0) {
          // Already has an account — hand off to the normal post-login router.
          window.location.href = '/Login';
          return;
        }

        const pendingRole = sessionStorage.getItem(SIGNUP_STORAGE_KEYS.role);
        if (pendingRole) {
          const pf = sessionStorage.getItem(SIGNUP_STORAGE_KEYS.first) || '';
          const pl = sessionStorage.getItem(SIGNUP_STORAGE_KEYS.last) || '';
          sessionStorage.removeItem(SIGNUP_STORAGE_KEYS.role);
          sessionStorage.removeItem(SIGNUP_STORAGE_KEYS.first);
          sessionStorage.removeItem(SIGNUP_STORAGE_KEYS.last);
          try {
            await createProfile(currentUser, pendingRole, pf, pl);
            routeAfterProfile(pendingRole);
          } catch (e) {
            console.error('Profile creation failed:', e);
            setError(e.message || 'Failed to create account');
            setAuthChecking(false);
          }
          return;
        }

        // Authenticated but no profile and no pending role → Onboarding is the fallback.
        window.location.href = '/Onboarding';
      } catch {
        // Not authenticated — show the signup form.
        setAuthChecking(false);
      }
    })();
  }, []);

  const handleGoogleSignup = () => {
    if (!selectedRole || !firstName.trim() || !lastName.trim()) {
      toast.error('Please choose a role and enter your name.');
      return;
    }
    // Stash the chosen role + names so we can finish profile creation after the Google redirect.
    sessionStorage.setItem(SIGNUP_STORAGE_KEYS.role, selectedRole);
    sessionStorage.setItem(SIGNUP_STORAGE_KEYS.first, firstName.trim());
    sessionStorage.setItem(SIGNUP_STORAGE_KEYS.last, lastName.trim());
    setLoading(true);
    setError('');
    try {
      base44.auth.loginWithProvider('google', window.location.origin + '/Signup');
    } catch (err) {
      setError(err?.message || 'Google sign-in failed. Please try again.');
      setLoading(false);
    }
  };

  const handleEmailRegister = async (e) => {
    e?.preventDefault();
    if (!selectedRole || !firstName.trim() || !lastName.trim()) {
      setError('Please choose a role and enter your name.');
      return;
    }
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await base44.auth.register({ email: email.trim(), password });
      setStep('otp');
    } catch (err) {
      const msg = (err?.message || 'Registration failed.').toLowerCase();
      if (msg.includes('already') || msg.includes('exist')) {
        setError('An account with this email already exists. Sign in instead.');
      } else {
        setError(err?.message || 'Registration failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e?.preventDefault();
    if (!otpCode.trim()) {
      setError('Please enter the verification code sent to your email.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await base44.auth.verifyOtp({ email: email.trim(), otpCode: otpCode.trim() });
      await base44.auth.loginViaEmailPassword(email.trim(), password);
      const user = await base44.auth.me();
      await createProfile(user, selectedRole, firstName, lastName);
      routeAfterProfile(selectedRole);
    } catch (err) {
      setError(err?.message || 'Verification failed. Check the code and try again.');
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    try {
      await base44.auth.resendOtp(email.trim());
      toast.success('A new code has been sent to your email.');
    } catch {
      toast.error('Could not resend the code. Please wait a moment.');
    }
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const roleLabel = ROLES.find((r) => r.key === selectedRole)?.title;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background accent-glow">
      <Card className="w-full max-w-lg border-border bg-card/60 backdrop-blur-md">
        <CardHeader className="text-center pb-2">
          <Link to="/" className="inline-flex flex-col items-center gap-2">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-primary flex items-center justify-center mb-2">
              <Shield className="h-7 w-7 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl">Create your BlockWard account</CardTitle>
            <CardDescription>
              {step === 'role' ? 'How will you use BlockWard?' : `Signing up as a ${roleLabel}`}
            </CardDescription>
          </Link>
        </CardHeader>
        <CardContent>
          <AnimatePresence mode="wait">
            {step === 'role' && (
              <motion.div key="role" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                <RolePicker selectedRole={selectedRole} onSelect={setSelectedRole} />
                <Button onClick={() => setStep('details')} disabled={!selectedRole} className="w-full">
                  Continue <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </motion.div>
            )}

            {step === 'details' && (
              <motion.div key="details" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                <button
                  type="button"
                  onClick={() => setStep('role')}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to role selection
                </button>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>First Name</Label>
                    <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="John" />
                  </div>
                  <div className="space-y-2">
                    <Label>Last Name</Label>
                    <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" />
                  </div>
                </div>

                <Button onClick={handleGoogleSignup} disabled={loading} variant="outline" className="w-full font-medium py-2.5">
                  {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <GoogleIcon className="mr-2.5" />}
                  Continue with Google
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-card px-2 text-muted-foreground">or sign up with email</span>
                  </div>
                </div>

                <form onSubmit={handleEmailRegister} className="space-y-3">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@school.ac.uk"
                      autoComplete="email"
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Password</Label>
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      autoComplete="new-password"
                      disabled={loading}
                    />
                  </div>
                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Create Account <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </form>
              </motion.div>
            )}

            {step === 'otp' && (
              <motion.div key="otp" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                <div className="text-center space-y-1">
                  <div className="mx-auto h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
                    <Mail className="h-6 w-6 text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    We sent a 6-digit verification code to <strong className="text-foreground">{email}</strong>.
                  </p>
                </div>

                <form onSubmit={handleVerifyOtp} className="space-y-3">
                  <div className="space-y-2">
                    <Label>Verification Code</Label>
                    <Input
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="123456"
                      maxLength={6}
                      inputMode="numeric"
                      className="text-center text-2xl tracking-widest font-mono"
                      disabled={loading}
                    />
                  </div>
                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Verify & Continue <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </form>

                <div className="flex items-center justify-between text-sm">
                  <button type="button" onClick={() => setStep('details')} className="text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="h-3.5 w-3.5 inline mr-1" /> Back
                  </button>
                  <button type="button" onClick={handleResendOtp} className="text-primary hover:underline">
                    Resend code
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {error && (
            <div role="alert" className="mt-4 flex items-start gap-2 p-3 bg-destructive/5 border border-destructive/20 rounded-lg text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}

          <p className="text-center text-sm text-muted-foreground mt-6">
            Already have an account? <Link to="/Login" className="text-primary font-medium hover:underline">Sign in</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}