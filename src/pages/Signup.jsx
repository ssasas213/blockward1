import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Building2, ArrowRight, Loader2, AlertCircle, Mail, KeyRound, AtSign, UserRound } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { consumePostAuthRedirect, guardedRedirect, setPostAuthRedirect } from '@/lib/authRedirectGuard';
import { handlePostLoginRedirect } from '@/lib/authHelpers';
import { SIGNUP_STORAGE_KEYS } from '@/lib/signupSession';

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

// Signup details are stashed via src/lib/signupSession.js so they survive the
// Google OAuth redirect and feed provisioning on return.

// Client-side mirror of the server's age derivation — used ONLY to reveal the
// guardian email field at the right moment. The server re-derives the age from
// the date of birth and never trusts the client.
function ageFromDob(dob) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob || '')) return null;
  const d = new Date(dob + 'T00:00:00');
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  if (today.getMonth() < d.getMonth() || (today.getMonth() === d.getMonth() && today.getDate() < d.getDate())) age--;
  return age;
}

// Where to go after the server provisions the profile. Every personal account
// is complete on its own — the personal dashboard ("My Blockward") is the
// destination. Organisation roles are granted through membership, never here.
const NEXT_URL = {
  awaiting_approval: '/Login', // Login shows the "Awaiting Approval" holding screen
  personal_dashboard: '/StudentDashboard',
  teacher_dashboard: '/TeacherDashboard',
  admin_dashboard: '/AdminDashboard',
  login: '/Login',
};

// Server-side validation failures come back as { error } with a 400 status —
// the SDK then throws a transport error whose .message is the useless
// "Request failed with status code 400". Pull the real server message out of
// the response and translate it; users must never see the raw transport text.
function friendlyProvisionError(e) {
  const serverMsg = e?.response?.data?.error || e?.data?.error || '';
  return serverMsg || 'We could not set up your account. Please try again.';
}

async function provisionAccount(payload) {
  let data;
  try {
    const res = await base44.functions.invoke('provisionProfile', payload);
    data = res.data;
  } catch (e) {
    throw new Error(friendlyProvisionError(e));
  }
  if (!data?.ok) throw new Error(friendlyProvisionError({ response: { data } }));
  // Under-13: the account exists but stays inactive until the guardian
  // consents. The sign-in screen shows the waiting card with the guardian email.
  if (data.next === 'guardian_consent') {
    guardedRedirect('/Login');
    return;
  }
  // A pre-auth intent (e.g. "Register an organisation") overrides the default
  // landing page — except for blocked states (approval/consent waiting).
  const postAuthIntent = consumePostAuthRedirect();
  if (postAuthIntent && data.next !== 'awaiting_approval') {
    guardedRedirect(postAuthIntent);
    return;
  }
  // Unrecognised `next` values default to the personal dashboard — an unknown
  // response must never land anyone on a join screen.
  guardedRedirect(NEXT_URL[data.next] || '/StudentDashboard');
}

export default function Signup() {
  // mode: 'landing' (two choices) → 'personal' (account creation) | 'org' (create or join)
  const [mode, setMode] = useState('landing');
  const [authChecking, setAuthChecking] = useState(true);
  const [step, setStep] = useState('details'); // 'details' | 'otp'
  // Set when the visitor is already authenticated (e.g. back from Google) but
  // has no BlockWard profile — the details form then finishes the account.
  const [authedUser, setAuthedUser] = useState(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  // Email carried over from the sign-in screen (a brand-new email is routed
  // here instead of hitting a dead-end error).
  const [email, setEmail] = useState(() => {
    try { return new URLSearchParams(window.location.search).get('email') || ''; } catch { return ''; }
  });
  // Handle claimed from a public profile (HandleClaimCta) — stashed in
  // sessionStorage so it survives provisioning and the Google redirect, then
  // pre-filled into the Profile page's claim card once the account exists.
  const [claimHandle] = useState(() => {
    try {
      const h = new URLSearchParams(window.location.search).get('claim_handle');
      if (h && /^[a-z0-9_]{3,20}$/.test(h)) {
        sessionStorage.setItem('blockward_claim_handle', h);
        return h;
      }
    } catch { /* ignore */ }
    return '';
  });
  const [password, setPassword] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [guardianEmail, setGuardianEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  // A pre-auth organisation intent (Create/Join Organisation chosen while
  // signed out). Stashed on the post-auth redirect so it survives account
  // creation; mirrored here to show a "what happens next" banner on the form.
  const [pendingIntent, setPendingIntent] = useState(() => {
    try { return sessionStorage.getItem('blockward_post_auth_intent') || ''; } catch { return ''; }
  });

  // DOB is always collected; a guardian email becomes required under 13.
  const validateAgeFields = () => {
    if (!dateOfBirth) return 'Please enter your date of birth.';
    const age = ageFromDob(dateOfBirth);
    if (age === null || age < 0) return 'Please enter a valid date of birth.';
    if (age < 13 && !guardianEmail.trim()) return "Please enter a parent or guardian's email to activate your account.";
    return null;
  };

  // Client-side resend cooldown — complements the server-side OTP rate limits.
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  useEffect(() => {
    (async () => {
      try {
        const currentUser = await base44.auth.me();
        if (!currentUser) { setAuthChecking(false); return; }

        // Authenticated — check whether this is a Google return with pending details.
        const profiles = await base44.entities.UserProfile.filter({ user_email: currentUser.email });
        if (profiles.length > 0) {
          // Already has a complete account — a signup URL must never create a
          // second profile. The canonical post-login router sends them to
          // their own dashboard (or the pending/consent holding screen) in
          // one hop instead of bouncing through Sign In.
          const result = await handlePostLoginRedirect().catch(() => null);
          if (result) guardedRedirect('/Login');
          return;
        }

        const pf = sessionStorage.getItem(SIGNUP_STORAGE_KEYS.first);
        const pl = sessionStorage.getItem(SIGNUP_STORAGE_KEYS.last);
        const pd = sessionStorage.getItem(SIGNUP_STORAGE_KEYS.dob);
        const pg = sessionStorage.getItem(SIGNUP_STORAGE_KEYS.guardian);
        if (pf) {
          sessionStorage.removeItem(SIGNUP_STORAGE_KEYS.first);
          sessionStorage.removeItem(SIGNUP_STORAGE_KEYS.last);
          sessionStorage.removeItem(SIGNUP_STORAGE_KEYS.dob);
          sessionStorage.removeItem(SIGNUP_STORAGE_KEYS.guardian);
          try {
            await provisionAccount({
              first_name: pf, last_name: pl,
              date_of_birth: pd || undefined,
              guardian_email: pg || undefined,
            });
          } catch (e) {
            console.error('Profile provisioning failed:', e);
            setError(e.message || 'Failed to create account');
            setAuthChecking(false);
          }
          return;
        }

        // Authenticated, no profile, no pending details. We are ALREADY on
        // /Signup — the details form exists to resolve exactly this state.
        // Render it (prefilled from the Google account) instead of redirecting.
        const nameParts = (currentUser.full_name || '').trim().split(/\s+/).filter(Boolean);
        if (nameParts.length) {
          setFirstName(nameParts[0]);
          setLastName(nameParts.slice(1).join(' '));
        }
        if (currentUser.email) setEmail(currentUser.email);
        setAuthedUser(currentUser);
        setMode('personal');
        setAuthChecking(false);
      } catch {
        // Not authenticated — show the signup landing.
        setAuthChecking(false);
      }
    })();
  }, []);

  // Already authenticated (e.g. via Google) with no profile — the details
  // form creates the profile directly; no password or email code needed.
  const handleCompleteProfile = async (e) => {
    e?.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      setError('Please enter your name.');
      return;
    }
    const ageError = validateAgeFields();
    if (ageError) {
      setError(ageError);
      return;
    }
    setLoading(true);
    setError('');
    try {
      await provisionAccount({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        date_of_birth: dateOfBirth,
        guardian_email: ageFromDob(dateOfBirth) < 13 ? guardianEmail.trim() : undefined,
      });
    } catch (err) {
      setError(err?.message || 'Failed to create account');
      setLoading(false);
    }
  };

  const handleGoogleSignup = () => {
    if (!firstName.trim() || !lastName.trim()) {
      toast.error('Please enter your name.');
      return;
    }
    const ageError = validateAgeFields();
    if (ageError) {
      toast.error(ageError);
      return;
    }
    // Stash the details so we can finish provisioning after the Google redirect.
    sessionStorage.setItem(SIGNUP_STORAGE_KEYS.first, firstName.trim());
    sessionStorage.setItem(SIGNUP_STORAGE_KEYS.last, lastName.trim());
    sessionStorage.setItem(SIGNUP_STORAGE_KEYS.dob, dateOfBirth);
    if (ageFromDob(dateOfBirth) < 13 && guardianEmail.trim()) {
      sessionStorage.setItem(SIGNUP_STORAGE_KEYS.guardian, guardianEmail.trim());
    }
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
    if (!firstName.trim() || !lastName.trim()) {
      setError('Please enter your name.');
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
    const ageError = validateAgeFields();
    if (ageError) {
      setError(ageError);
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
      try {
        await base44.auth.verifyOtp({ email: email.trim(), otpCode: otpCode.trim() });
      } catch (err) {
        // "User is already verified" (e.g. the page was retried after a
        // successful verification) is a SATISFIED state, not a failure —
        // continue with the sign-in + provisioning instead of blocking.
        if (!/already verified|already active/i.test(err?.message || '')) throw err;
      }
      await base44.auth.loginViaEmailPassword(email.trim(), password);
      await provisionAccount({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        date_of_birth: dateOfBirth,
        guardian_email: ageFromDob(dateOfBirth) < 13 ? guardianEmail.trim() : undefined,
      });
    } catch (err) {
      // If the account exists and is signed in but provisioning failed,
      // resume onboarding on the details form — never trap an authenticated
      // user on the code step.
      const me = await base44.auth.me().catch(() => null);
      if (me) {
        setAuthedUser(me);
        setStep('details');
      }
      setError(err?.message || 'Verification failed. Check the code and try again.');
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    try {
      await base44.auth.resendOtp(email.trim());
      toast.success('A new code has been sent to your email.');
      setResendCooldown(60);
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

  // ── LANDING — Join Blockward ──
  if (mode === 'landing') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background accent-glow">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-10">
            <Link to="/" className="inline-flex flex-col items-center gap-2">
              <div className="mx-auto h-14 w-14 rounded-2xl bg-primary flex items-center justify-center mb-2">
                <Shield className="h-7 w-7 text-primary-foreground" />
              </div>
              <CardTitle className="text-3xl tracking-tight">Join Blockward</CardTitle>
            </Link>
            <CardDescription className="mt-2 text-base">
              Build a verified record of your achievements — or represent an organisation that issues them.
            </CardDescription>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Option 1 — personal account */}
            <Card className="surface-card card-hover cursor-pointer" onClick={() => setMode('personal')}>
              <CardContent className="p-6">
                <div className="h-11 w-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                  <UserRound className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-base font-semibold text-foreground">Create a personal profile</h3>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                  Add achievements, request verification, build your Blockward profile and share
                  verified credentials.
                </p>
                <div className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                  Create Personal Account <ArrowRight className="h-4 w-4" />
                </div>
                <p className="text-xs text-tertiary mt-4">
                  For students, professionals, athletes, competitors and anyone with achievements to prove.
                </p>
              </CardContent>
            </Card>

            {/* Option 2 — organisation */}
            <Card className="surface-card card-hover cursor-pointer" onClick={() => setMode('org')}>
              <CardContent className="p-6">
                <div className="h-11 w-11 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-4">
                  <Building2 className="h-5 w-5 text-accent" />
                </div>
                <h3 className="text-base font-semibold text-foreground">Create or join an organisation</h3>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                  For organisations and the authorised people who verify achievements on their behalf.
                </p>
                <div className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent">
                  Create or Join an Organisation <ArrowRight className="h-4 w-4" />
                </div>
                <p className="text-xs text-tertiary mt-4">
                  For companies, schools, universities, certification providers, competitions, training
                  organisations and other issuers.
                </p>
              </CardContent>
            </Card>
          </div>

          <p className="text-center text-sm text-muted-foreground mt-8">
            Already invited to an organisation?{' '}
            <Link to="/organisation" className="text-primary font-medium hover:underline">Join with an invitation</Link>
          </p>
          <p className="text-center text-sm text-muted-foreground mt-2">
            Already have an account? <Link to="/Login" className="text-primary font-medium hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    );
  }

  // ── ORG CHOICE — create new or join by invitation ──
  if (mode === 'org') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background accent-glow">
        <div className="w-full max-w-lg">
          <div className="text-center mb-8">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-primary flex items-center justify-center mb-3">
              <Building2 className="h-7 w-7 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl">How are you joining Blockward?</CardTitle>
            <CardDescription className="mt-2">
              Organisation access is always tied to a normal Blockward account — there is no separate login.
            </CardDescription>
          </div>

          <div className="space-y-4">
            <Card className="surface-card card-hover cursor-pointer" onClick={() => { setPostAuthRedirect('/register-organisation'); setPendingIntent('/register-organisation'); setMode('personal'); }}>
              <CardContent className="p-6">
                <h3 className="text-base font-semibold text-foreground">Create a new organisation</h3>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                  Register your company, school, university, certification provider, competition or
                  training organisation. You become its Organisation Owner.
                </p>
                <div className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                  Create a New Organisation <ArrowRight className="h-4 w-4" />
                </div>
              </CardContent>
            </Card>

            <Card className="surface-card card-hover cursor-pointer" onClick={() => { setPostAuthRedirect('/organisation'); setPendingIntent('/organisation'); setMode('personal'); }}>
              <CardContent className="p-6">
                <h3 className="text-base font-semibold text-foreground">Join an existing organisation</h3>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                  Organisation access is granted by invitation. Open the invitation link from your
                  email, or paste your invitation code.
                </p>
                <div className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                  Join with an Invitation <ArrowRight className="h-4 w-4" />
                </div>
              </CardContent>
            </Card>
          </div>

          <button
            onClick={() => setMode('landing')}
            className="mt-8 mx-auto block text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowRight className="h-3.5 w-3.5 inline mr-1 rotate-180" /> Back
          </button>
        </div>
      </div>
    );
  }

  // ── PERSONAL ACCOUNT CREATION ──
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background accent-glow">
      <Card className="w-full max-w-lg border-border bg-card">
        <CardHeader className="text-center pb-2">
          <Link to="/" className="inline-flex flex-col items-center gap-2">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-primary flex items-center justify-center mb-2">
              <Shield className="h-7 w-7 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl">Create your personal account</CardTitle>
            <CardDescription>
              {step === 'details'
                ? 'Build a verified record of your achievements — no organisation needed'
                : 'Verify your email to finish'}
            </CardDescription>
          </Link>
        </CardHeader>
        <CardContent>
          <AnimatePresence mode="wait">
            {step === 'details' && (
              <motion.div key="details" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                {pendingIntent && (
                  <div className="flex items-center gap-2 rounded-lg border border-accent/25 bg-accent/5 px-3 py-2 text-sm text-muted-foreground">
                    <Building2 className="h-4 w-4 flex-shrink-0 text-accent" />
                    <span>After your account is created, we'll continue to <strong className="text-foreground">{pendingIntent === '/register-organisation' ? 'register your organisation' : 'join your organisation'}</strong>.</span>
                  </div>
                )}
                {claimHandle && (
                  <div className="flex items-center gap-2 rounded-lg border border-success/25 bg-success/5 px-3 py-2 text-sm text-success">
                    <AtSign className="h-4 w-4 flex-shrink-0" />
                    <span>blockward.me/@{claimHandle} will be yours — finish creating your account to claim it.</span>
                  </div>
                )}
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

                <div className="space-y-2">
                  <Label>Date of birth</Label>
                  <Input
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    max={new Date().toISOString().slice(0, 10)}
                    disabled={loading}
                  />
                  <p className="text-xs text-muted-foreground">
                    We use your date of birth only to apply the right privacy and safety settings for your age — it's never shown on your profile.
                  </p>
                </div>

                {ageFromDob(dateOfBirth) !== null && ageFromDob(dateOfBirth) < 13 && (
                  <div className="space-y-2 rounded-xl border border-warning/30 bg-warning/5 p-3">
                    <Label className="text-foreground">Parent or guardian's email</Label>
                    <Input
                      type="email"
                      value={guardianEmail}
                      onChange={(e) => setGuardianEmail(e.target.value)}
                      placeholder="parent@example.com"
                      disabled={loading}
                    />
                    <p className="text-xs text-muted-foreground">
                      Because you're under 13, your account activates once a parent or guardian confirms the email we send them.
                    </p>
                  </div>
                )}

                {authedUser ? (
                  <>
                    {/* Google return with no profile — just finish the details */}
                    <div className="flex items-center gap-2 rounded-lg border border-info/25 bg-info/5 px-3 py-2 text-sm text-muted-foreground">
                      <AtSign className="h-4 w-4 flex-shrink-0 text-info" />
                      <span className="truncate">
                        Signed in as <strong className="text-foreground">{authedUser.email}</strong> — add your details to finish your account.
                      </span>
                    </div>
                    <Button onClick={handleCompleteProfile} disabled={loading} className="w-full">
                      {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Create My Account <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </>
                ) : (
                  <>
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
                          placeholder="you@example.com"
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
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setMode('landing')}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowRight className="h-3.5 w-3.5 inline mr-1 rotate-180" /> Back
                </button>
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
                    <ArrowRight className="h-3.5 w-3.5 inline mr-1 rotate-180" /> Back
                  </button>
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={resendCooldown > 0}
                    className={resendCooldown > 0 ? 'text-muted-foreground cursor-not-allowed' : 'text-primary hover:underline'}
                  >
                    {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
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

          <div className="mt-4 pt-4 border-t border-border text-center">
            <p className="text-sm text-muted-foreground">
              Represent an organisation?{' '}
              <button
                type="button"
                onClick={() => setMode('org')}
                className="text-primary font-medium hover:underline"
              >
                Create or join an organisation
              </button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}