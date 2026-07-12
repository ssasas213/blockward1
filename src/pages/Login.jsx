import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { handlePostLoginRedirect } from '@/lib/authHelpers';
import { Shield, Loader2, Clock, Ban, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
  const [accountStatus, setAccountStatus] = useState(null); // 'pending' | 'suspended'
  const [error, setError] = useState('');

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
        /* not authenticated — show Google button */
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

  const handleSignOut = () => {
    base44.auth.logout(window.location.origin + '/Login');
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-950 to-indigo-950 flex items-center justify-center">
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
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {accountStatus === 'pending' ? (
            /* Pending approval state */
            <div className="text-center">
              <div className="mx-auto h-14 w-14 rounded-full bg-amber-100 flex items-center justify-center mb-5">
                <Clock className="h-7 w-7 text-amber-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Awaiting Approval</h2>
              <p className="text-sm text-slate-500 mb-6">
                Your account is pending administrator approval. You'll be able to access BlockWard
                once an administrator approves your account.
              </p>
              <Button
                onClick={handleSignOut}
                variant="outline"
                className="w-full"
              >
                Sign Out
              </Button>
            </div>
          ) : accountStatus === 'suspended' ? (
            /* Suspended state */
            <div className="text-center">
              <div className="mx-auto h-14 w-14 rounded-full bg-red-100 flex items-center justify-center mb-5">
                <Ban className="h-7 w-7 text-red-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Account Suspended</h2>
              <p className="text-sm text-slate-500 mb-6">
                Your account has been suspended. Please contact your administrator.
              </p>
              <Button
                onClick={handleSignOut}
                variant="outline"
                className="w-full"
              >
                Sign Out
              </Button>
            </div>
          ) : (
            /* Default login state */
            <>
              <h2 className="text-2xl font-bold text-slate-900 mb-2 text-center">Welcome to BlockWard</h2>
              <p className="text-sm text-slate-500 mb-8 text-center">
                Sign in with your Google account to continue.
              </p>

              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mb-4">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  {error}
                </div>
              )}

              <Button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full bg-white text-slate-700 border-2 border-slate-200 hover:bg-slate-50 hover:border-slate-300 font-semibold py-3 shadow-sm"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2 text-slate-400" />
                ) : (
                  <GoogleIcon className="mr-3" />
                )}
                Continue with Google
              </Button>
            </>
          )}
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          © 2026 BlockWard · Blockchain-Secured Achievements
        </p>
      </div>
    </div>
  );
}