import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { handlePostLoginRedirect } from '@/lib/authHelpers';
import { Shield, Loader2, Clock, Ban, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [accountStatus, setAccountStatus] = useState(null);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const user = await base44.auth.me();
        if (user) {
          const result = await handlePostLoginRedirect();
          if (result === 'suspended') setAccountStatus('suspended');
          else if (result === 'pending') setAccountStatus('pending');
        }
      } catch {
        /* not authenticated */
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  const handleGoogleLogin = () => {
    setLoading(true);
    setError('');
    try {
      base44.auth.loginWithProvider('google', window.location.origin + '/Login');
    } catch (err) {
      setError(err?.message || 'Google sign-in failed. Please try again.');
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await base44.auth.loginViaEmailPassword(email.trim(), password);
      const result = await handlePostLoginRedirect();
      if (result === 'suspended') setAccountStatus('suspended');
      else if (result === 'pending') setAccountStatus('pending');
    } catch (err) {
      setError(err?.message || 'Invalid email or password.');
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    base44.auth.logout(window.location.origin + '/Login');
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12 accent-glow relative overflow-hidden">
      <div className="w-full max-w-sm">
        {/* Branding */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex flex-col items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
              <Shield className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-semibold text-foreground tracking-tight">BlockWard</span>
          </Link>
        </div>

        {/* Card */}
        <div className="glass rounded-xl shadow-sm p-8">
          {accountStatus === 'pending' ? (
            <div className="text-center">
              <div className="mx-auto h-12 w-12 rounded-xl bg-warning/10 flex items-center justify-center mb-4">
                <Clock className="h-6 w-6 text-warning" />
              </div>
              <h2 className="text-lg font-semibold text-foreground mb-2">Awaiting Approval</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Your account is pending administrator approval. You'll be able to access BlockWard once an administrator approves your account.
              </p>
              <Button onClick={handleSignOut} variant="outline" className="w-full">
                Sign Out
              </Button>
            </div>
          ) : accountStatus === 'suspended' ? (
            <div className="text-center">
              <div className="mx-auto h-12 w-12 rounded-xl bg-destructive/10 flex items-center justify-center mb-4">
                <Ban className="h-6 w-6 text-destructive" />
              </div>
              <h2 className="text-lg font-semibold text-foreground mb-2">Account Suspended</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Your account has been suspended. Please contact your administrator.
              </p>
              <Button onClick={handleSignOut} variant="outline" className="w-full">
                Sign Out
              </Button>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-semibold text-foreground mb-1 text-center">Sign in to BlockWard</h1>
              <p className="text-sm text-muted-foreground mb-6 text-center">
                Use your Google account or email to continue.
              </p>

              {error && (
                <div role="alert" className="flex items-start gap-2 p-3 bg-destructive/5 border border-destructive/20 rounded-lg text-sm text-destructive mb-4">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  {error}
                </div>
              )}

              <Button
                onClick={handleGoogleLogin}
                disabled={loading}
                variant="outline"
                className="w-full font-medium py-2.5"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                ) : (
                  <GoogleIcon className="mr-2.5" />
                )}
                Continue with Google
              </Button>

              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-card px-2 text-muted-foreground">or</span>
                </div>
              </div>

              <form onSubmit={handleEmailLogin} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="login-email" className="text-xs font-semibold uppercase tracking-wide">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@school.ac.uk"
                    autoComplete="email"
                    disabled={loading}
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="login-password" className="text-xs font-semibold uppercase tracking-wide">Password</Label>
                    <Link to="/ForgotPassword" className="text-xs text-primary hover:underline">Forgot password?</Link>
                  </div>
                  <Input
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    disabled={loading}
                  />
                </div>
                <Button type="submit" disabled={loading} className="w-full font-medium py-2.5">
                  {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
                  Sign In
                </Button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          New here? <Link to="/Signup" className="text-primary font-medium hover:underline">Create an account</Link>
        </p>
        <p className="text-center text-xs text-muted-foreground mt-4">
          © 2026 BlockWard · Blockchain-Secured Achievements
        </p>
      </div>
    </div>
  );
}