import React, { useState, useEffect, useRef } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Shield, ArrowRight, ArrowLeft, Loader2, AlertCircle, Mail, CheckCircle2,
  XCircle, KeyRound, Building2, Clock, GraduationCap, Users,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

function GoogleIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4334" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

const STASH_KEY = 'blockward_signup_ctx';

const NEXT_URL = {
  awaiting_approval: 'awaiting', // holding screen
  student_setup: '/StudentDashboard',
  teacher_dashboard: '/TeacherDashboard',
  admin_dashboard: '/AdminDashboard',
  join_school: '/JoinSchool',
  login: '/Login',
};

const ROLE_LABELS = {
  student: 'student',
  teacher: 'teacher',
  admin: 'administrator',
};

function readStash() {
  try {
    const raw = sessionStorage.getItem(STASH_KEY);
    if (!raw) return null;
    const ctx = JSON.parse(raw);
    if (!ctx || Date.now() - (ctx.ts || 0) > 10 * 60 * 1000) return null; // 10 min
    return ctx;
  } catch { return null; }
}
function clearStash() { try { sessionStorage.removeItem(STASH_KEY); } catch { /* ignore */ } }

function parseInviteToken(raw) {
  const m = String(raw || '').match(/invite\/([A-Za-z0-9._-]+)/);
  return m ? m[1] : String(raw || '').trim();
}

/**
 * Signup — the rebuilt join flow. Two screens for the common case:
 *   Screen 1 "Got a join code?" — one large code input, validated live.
 *   Screen 2 — name + sign-in (Google or email + the existing OTP verification).
 * The user is NEVER asked what role they are: role and school come from the
 * join code or the invitation token, resolved server-side (provisionProfile /
 * acceptInvitation). Deep links: /join/CODE (code pre-filled and validated) and
 * /invite/TOKEN (school, role and invited email resolved, straight to Screen 2).
 */
export default function Signup() {
  const params = useParams();
  const navigate = useNavigate();
  const deepCode = params.code || null;
  const inviteToken = params.token || null;

  const [booting, setBooting] = useState(true);
  const [screen, setScreen] = useState('code'); // code | details | otp | awaiting | working | invite-error
  const [mode, setMode] = useState('code');     // code | invite | no-code
  const [authedUser, setAuthedUser] = useState(null);

  // Screen 1 — live code validation
  const [codeInput, setCodeInput] = useState('');
  const [codeState, setCodeState] = useState('idle'); // idle | checking | valid | invalid
  const [codeInfo, setCodeInfo] = useState(null);
  const [codeError, setCodeError] = useState('');

  // Invite context
  const [inviteInfo, setInviteInfo] = useState(null);
  const [inviteError, setInviteError] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [showInviteInput, setShowInviteInput] = useState(false);

  // Screen 2 — details / OTP
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const codeInputRef = useRef(null);

  useEffect(() => { codeInputRef.current?.focus(); }, [screen]);

  // ── Backend helpers ──
  const checkCode = async (raw) => {
    try {
      const res = await base44.functions.invoke('joinFlowData', { code: raw });
      return res.data;
    } catch { return { valid: false, reason: 'Could not check that code. Try again.' }; }
  };

  const checkInvite = async (token) => {
    try {
      const res = await base44.functions.invoke('joinFlowData', { invitation_token: token });
      return res.data;
    } catch { return { valid: false, reason: 'Could not check this invitation.' }; }
  };

  const finishCode = async (first, last, code) => {
    const res = await base44.functions.invoke('provisionProfile', {
      first_name: first, last_name: last, join_code: code,
    });
    const data = res.data;
    clearStash();
    if (!data?.ok) throw new Error(data?.error || 'Failed to create your account');
    if (data.next === 'awaiting_approval') { setScreen('awaiting'); setBooting(false); return; }
    window.location.href = NEXT_URL[data.next] || '/StudentDashboard';
  };

  const finishInvite = async (first, last) => {
    const res = await base44.functions.invoke('acceptInvitation', {
      token: inviteToken, first_name: first, last_name: last,
    });
    clearStash();
    const data = res.data;
    if (data?.success || data?.already_member) {
      window.location.href = data.redirect || '/StudentDashboard';
      return;
    }
    throw new Error(data?.error || 'Failed to accept invitation');
  };

  const finishNoCode = async (first, last) => {
    const res = await base44.functions.invoke('provisionProfile', {
      first_name: first, last_name: last,
    });
    const data = res.data;
    clearStash();
    if (!data?.ok) throw new Error(data?.error || 'Failed to create your account');
    window.location.href = NEXT_URL[data.next] || '/JoinSchool';
  };

  const runFinish = async (m, first, last, code) => {
    setLoading(true);
    setError('');
    try {
      if (m === 'code') await finishCode(first, last, code);
      else if (m === 'invite') await finishInvite(first, last);
      else await finishNoCode(first, last);
    } catch (e) {
      setError(e?.response?.data?.error || e.message || 'Something went wrong');
      setScreen('details');
      setBooting(false);
    } finally {
      setLoading(false);
    }
  };

  // ── Boot: resolve deep links, resume Google returns ──
  useEffect(() => {
    (async () => {
      try {
        const me = await base44.auth.me();
        if (me) {
          const profiles = await base44.entities.UserProfile.filter({ user_email: me.email });
          if (profiles.length > 0) {
            // Already has a BlockWard profile. An invitation can still add a
            // school to an existing account; anything else routes away.
            if (inviteToken) {
              setScreen('working');
              setBooting(false);
              try {
                const res = await base44.functions.invoke('acceptInvitation', { token: inviteToken });
                const data = res.data;
                if (data?.success || data?.already_member) {
                  window.location.href = data.redirect || '/StudentDashboard';
                  return;
                }
                setInviteError(data?.error || 'Failed to accept invitation');
              } catch (err) {
                setInviteError(err?.response?.data?.error || err.message || 'Failed to accept invitation');
              }
              setScreen('invite-error');
              return;
            }
            window.location.href = '/Login';
            return;
          }
          setAuthedUser(me);

          // Resume a stashed Google signup
          const stash = readStash();
          if (stash) {
            setFirstName(stash.first || '');
            setLastName(stash.last || '');
            setScreen('working');
            await runFinish(stash.mode, stash.first, stash.last, stash.code);
            return;
          }
        }

        // Deep link: /join/CODE — validate, then straight to Screen 2
        if (deepCode) {
          setCodeInput(deepCode);
          const data = await checkCode(deepCode);
          if (data?.valid) {
            setCodeInfo(data);
            setCodeState('valid');
            setMode('code');
            setScreen('details');
          } else {
            setCodeState('invalid');
            setCodeError(data?.reason || 'This code could not be validated.');
            setMode('code');
            setScreen('code');
          }
          return;
        }

        // Deep link: /invite/TOKEN — resolve school/role/email, straight to Screen 2
        if (inviteToken) {
          const data = await checkInvite(inviteToken);
          if (data?.valid) {
            setInviteInfo(data);
            setMode('invite');
            setScreen('details');
          } else {
            setInviteError(data?.reason || 'This invitation could not be validated.');
            setScreen('invite-error');
          }
          return;
        }

        setScreen('code');
      } catch {
        setScreen('code');
      } finally {
        setBooting(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepCode, inviteToken]);

  // ── Screen 1: live validation as they type ──
  useEffect(() => {
    if (screen !== 'code') return;
    const raw = codeInput.trim();
    if (!raw) { setCodeState('idle'); setCodeInfo(null); setCodeError(''); return; }
    setCodeState('checking');
    const t = setTimeout(async () => {
      const data = await checkCode(raw);
      if (data?.valid) { setCodeState('valid'); setCodeInfo(data); setCodeError(''); }
      else { setCodeState('invalid'); setCodeInfo(null); setCodeError(data?.reason || 'Code not recognised'); }
    }, 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeInput, screen]);

  const stashContext = () => {
    try {
      sessionStorage.setItem(STASH_KEY, JSON.stringify({
        mode, code: codeInput.trim(), token: inviteToken,
        first: firstName.trim(), last: lastName.trim(), ts: Date.now(),
      }));
    } catch { /* ignore */ }
  };

  const googleReturnPath = deepCode ? `/join/${deepCode}` : inviteToken ? `/invite/${inviteToken}` : '/Signup';

  const handleGoogle = () => {
    if (!firstName.trim() || !lastName.trim()) {
      setError('Please enter your first and last name.');
      return;
    }
    stashContext();
    setLoading(true);
    setError('');
    try {
      base44.auth.loginWithProvider('google', window.location.origin + googleReturnPath);
    } catch (err) {
      setError(err?.message || 'Google sign-in failed. Please try again.');
      setLoading(false);
    }
  };

  const handleDetailsContinue = () => {
    if (!firstName.trim() || !lastName.trim()) {
      setError('Please enter your first and last name.');
      return;
    }
    if (!authedUser) {
      setError('Choose Continue with Google or sign up with email below.');
      return;
    }
    if (mode === 'code' && codeState !== 'valid') {
      setError('Enter a valid join code first.');
      setScreen('code');
      return;
    }
    runFinish(mode, firstName.trim(), lastName.trim(), codeInput.trim());
  };

  const handleEmailRegister = async (e) => {
    e?.preventDefault();
    if (!firstName.trim() || !lastName.trim()) { setError('Please enter your first and last name.'); return; }
    if (!email.trim() || !password) { setError('Please enter your email and password.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    setError('');
    try {
      await base44.auth.register({ email: email.trim(), password });
      setScreen('otp');
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
    if (!otpCode.trim()) { setError('Please enter the verification code sent to your email.'); return; }
    setLoading(true);
    setError('');
    try {
      await base44.auth.verifyOtp({ email: email.trim(), otpCode: otpCode.trim() });
      await base44.auth.loginViaEmailPassword(email.trim(), password);
      await runFinish(mode, firstName.trim(), lastName.trim(), codeInput.trim());
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

  const handleInviteLink = () => {
    const token = parseInviteToken(inviteLink);
    if (!token || token.length < 6) { toast.error('Paste your invitation link or token.'); return; }
    navigate(`/invite/${token}`);
  };

  const proceedWithCode = () => {
    if (codeState !== 'valid') return;
    setMode('code');
    setScreen('details');
  };

  if (booting) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ── Holding screen: teacher awaiting approval ──
  if (screen === 'awaiting') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background accent-glow">
        <div className="w-full max-w-md">
          <Card className="border-border bg-card/60 backdrop-blur-md">
            <CardContent className="pt-8 pb-8 text-center">
              <div className="mx-auto h-16 w-16 rounded-full bg-warning/10 flex items-center justify-center mb-5">
                <Clock className="h-8 w-8 text-warning" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">Request sent — awaiting approval</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Your request to join {codeInfo?.school?.name || 'your school'} has been sent to the administrator.
                You can sign in, but you won't be able to sign off achievements, view student data or issue points until an admin approves you.
              </p>
              <Button onClick={() => base44.auth.logout(window.location.origin + '/Login')} variant="outline" className="w-full">
                Sign Out
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ── Working (redirecting / provisioning) ──
  if (screen === 'working') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Setting up your account…</p>
      </div>
    );
  }

  // ── Invitation error ──
  if (screen === 'invite-error') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background accent-glow">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-destructive/10 flex items-center justify-center mb-5">
            <AlertCircle className="h-7 w-7 text-destructive" />
          </div>
          <h1 className="text-xl font-semibold text-foreground mb-2">Invitation problem</h1>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">{inviteError}</p>
          <Button onClick={() => navigate('/Signup')} variant="outline" className="mx-auto">
            <ArrowLeft className="h-4 w-4 mr-2" /> Start over with a join code
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background accent-glow">
      <Card className="w-full max-w-lg border-border bg-card/60 backdrop-blur-md">
        <CardHeader className="text-center pb-2">
          <Link to="/" className="inline-flex flex-col items-center gap-2">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-primary flex items-center justify-center mb-2">
              <Shield className="h-7 w-7 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl">
              {screen === 'code' ? 'Got a join code?' : 'Create your BlockWard account'}
            </CardTitle>
            <CardDescription>
              {screen === 'code'
                ? "Enter the code from your school — we'll set everything up from there."
                : mode === 'invite'
                  ? 'Almost there — just tell us your name.'
                  : mode === 'code'
                    ? 'Last step — your name and how you sign in.'
                    : 'Set up your account, then join a school.'}
            </CardDescription>
          </Link>
        </CardHeader>
        <CardContent>
          <AnimatePresence mode="wait">

            {/* ───────────────────────── SCREEN 1 — code entry ───────────────────────── */}
            {screen === 'code' && (
              <motion.div key="code" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
                <div className="space-y-2">
                  <Label className="sr-only">Join code</Label>
                  <Input
                    ref={codeInputRef}
                    value={codeInput}
                    onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && codeState === 'valid' && proceedWithCode()}
                    placeholder="e.g. SCH-STUD-7K4P92"
                    disabled={loading}
                    className="h-14 text-xl font-mono font-semibold tracking-[0.2em] text-center uppercase border-2 focus:border-primary"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                </div>

                {/* Live validation feedback */}
                <div className="min-h-[3.5rem]">
                  {codeState === 'checking' && (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Checking your code…
                    </p>
                  )}
                  {codeState === 'valid' && codeInfo?.school && (
                    <div className="flex items-center gap-3 p-3 rounded-xl border border-success/30 bg-success/5">
                      {codeInfo.school.logo_url ? (
                        <img src={codeInfo.school.logo_url} alt="" className="h-10 w-10 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center flex-shrink-0">
                          <CheckCircle2 className="h-5 w-5 text-success" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-success">
                          Joining {codeInfo.school.name} as a {ROLE_LABELS[codeInfo.role] || codeInfo.role}
                          {codeInfo.role === 'teacher' ? ' (subject to approval)' : ''}
                        </p>
                        {(codeInfo.school.city || codeInfo.school.country) && (
                          <p className="text-xs text-muted-foreground">
                            {[codeInfo.school.city, codeInfo.school.country].filter(Boolean).join(', ')}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                  {codeState === 'invalid' && (
                    <p className="flex items-start gap-2 text-sm text-destructive">
                      <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" /> {codeError}
                    </p>
                  )}
                </div>

                <Button onClick={proceedWithCode} disabled={codeState !== 'valid'} className="w-full">
                  Continue <ArrowRight className="h-4 w-4 ml-2" />
                </Button>

                {/* Secondary paths */}
                <div className="pt-2 border-t border-border space-y-2">
                  {showInviteInput ? (
                    <div className="flex gap-2">
                      <Input
                        value={inviteLink}
                        onChange={(e) => setInviteLink(e.target.value)}
                        placeholder="Paste your invitation link"
                        className="text-sm"
                        onKeyDown={(e) => e.key === 'Enter' && handleInviteLink()}
                      />
                      <Button variant="outline" size="sm" onClick={handleInviteLink} className="flex-shrink-0">Go</Button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setShowInviteInput(true)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                      <Mail className="h-3.5 w-3.5" /> I have an invitation link
                    </button>
                  )}
                  <div className="flex items-center justify-between gap-4">
                    <button type="button" onClick={() => navigate('/SchoolSetup')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                      <Building2 className="h-3.5 w-3.5" /> I'm setting up a new school
                    </button>
                    <button type="button" onClick={() => { setMode('no-code'); setScreen('details'); }} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                      I don't have a code
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ───────────────────── SCREEN 2 — name + sign-in ───────────────────── */}
            {(screen === 'details' || screen === 'otp') && (
              <motion.div key={screen} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                {screen === 'details' && (
                  <button
                    type="button"
                    onClick={() => { setScreen('code'); setError(''); }}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" /> Back
                  </button>
                )}

                {/* Resolved context banner */}
                {mode === 'code' && codeInfo?.school && (
                  <div className="flex items-center gap-3 p-3 rounded-xl border border-success/30 bg-success/5">
                    {codeInfo.school.logo_url ? (
                      <img src={codeInfo.school.logo_url} alt="" className="h-9 w-9 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="h-9 w-9 rounded-lg bg-success/10 flex items-center justify-center flex-shrink-0">
                        {codeInfo.role === 'teacher' ? <Users className="h-4 w-4 text-success" /> : <GraduationCap className="h-4 w-4 text-success" />}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{codeInfo.school.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Joining as a {ROLE_LABELS[codeInfo.role] || codeInfo.role}{codeInfo.role === 'teacher' ? ' — pending approval' : ''}
                      </p>
                    </div>
                    <CheckCircle2 className="h-4 w-4 text-success ml-auto flex-shrink-0" />
                  </div>
                )}
                {mode === 'invite' && inviteInfo?.school && (
                  <div className="flex items-center gap-3 p-3 rounded-xl border border-primary/30 bg-primary/5">
                    {inviteInfo.school.logo_url ? (
                      <img src={inviteInfo.school.logo_url} alt="" className="h-9 w-9 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Shield className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {inviteInfo.school.name} — as a {ROLE_LABELS[inviteInfo.role] || inviteInfo.role}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        Invited to {inviteInfo.invited_email}
                        {inviteInfo.invited_by_name ? ` by ${inviteInfo.invited_by_name}` : ''}
                      </p>
                    </div>
                  </div>
                )}
                {mode === 'no-code' && (
                  <p className="text-sm text-muted-foreground">
                    You can search for your school, enter a code or create one once your account is ready.
                  </p>
                )}

                {screen === 'details' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>First Name</Label>
                        <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="John" disabled={loading} />
                      </div>
                      <div className="space-y-2">
                        <Label>Last Name</Label>
                        <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" disabled={loading} />
                      </div>
                    </div>

                    {authedUser ? (
                      <Button onClick={handleDetailsContinue} disabled={loading} className="w-full">
                        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Continue <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    ) : (
                      <>
                        <Button onClick={handleGoogle} disabled={loading} variant="outline" className="w-full font-medium py-2.5">
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
                      </>
                    )}
                  </>
                )}

                {screen === 'otp' && (
                  <div className="space-y-4">
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
                      <button type="button" onClick={() => setScreen('details')} className="text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="h-3.5 w-3.5 inline mr-1" /> Back
                      </button>
                      <button type="button" onClick={handleResendOtp} className="text-primary hover:underline">
                        Resend code
                      </button>
                    </div>
                  </div>
                )}
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