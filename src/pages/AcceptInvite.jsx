import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Shield, Loader2, CheckCircle2, AlertCircle, LogIn,
  GraduationCap, Users, ArrowRight, Building2,
} from 'lucide-react';

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

export default function AcceptInvite() {
  const { token } = useParams();
  const [phase, setPhase] = useState('checking'); // checking | needs_login | accepting | success | error
  const [result, setResult] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const authed = await base44.auth.isAuthenticated();
        if (!authed) {
          setPhase('needs_login');
          return;
        }
        await accept();
      } catch {
        setPhase('needs_login');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const accept = async () => {
    setPhase('accepting');
    try {
      const res = await base44.functions.invoke('acceptInvitation', { token });
      setResult(res.data);
      setPhase('success');
    } catch (err) {
      const data = err?.response?.data || {};
      setResult({ error: data.error || err.message || 'Failed to accept invitation', code: data.code });
      setPhase('error');
    }
  };

  const handleLogin = () => {
    const returnUrl = `${window.location.origin}/invite/${token}`;
    base44.auth.loginWithProvider('google', returnUrl);
  };

  const roleIcon = result?.role === 'teacher' ? Users : result?.role === 'student' ? GraduationCap : Shield;

  if (phase === 'checking' || phase === 'accepting') {
    return (
      <Shell>
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <h2 className="text-lg font-semibold text-foreground">
          {phase === 'checking' ? 'Checking your invitation…' : 'Joining school…'}
        </h2>
      </Shell>
    );
  }

  if (phase === 'needs_login') {
    return (
      <Shell>
        <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
          <Shield className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold text-foreground mb-2">You're invited to BlockWard</h1>
        <p className="text-sm text-muted-foreground mb-6 max-w-sm">
          Continue with Google to accept your invitation and join your school.
        </p>
        <Button onClick={handleLogin} variant="outline" className="w-full font-medium py-2.5">
          <GoogleIcon className="mr-2.5" /> Continue with Google
        </Button>
      </Shell>
    );
  }

  if (phase === 'error') {
    const iconMap = {
      email_mismatch: AlertCircle,
      expired: AlertCircle,
      revoked: AlertCircle,
      already_used: CheckCircle2,
      not_found: AlertCircle,
      school_unavailable: AlertCircle,
    };
    const Icon = iconMap[result?.code] || AlertCircle;
    return (
      <Shell>
        <div className="h-14 w-14 rounded-2xl bg-destructive/10 flex items-center justify-center mb-5">
          <Icon className="h-7 w-7 text-destructive" />
        </div>
        <h1 className="text-xl font-semibold text-foreground mb-2">
          {result?.code === 'already_used' ? 'Already Joined' : 'Invitation Problem'}
        </h1>
        <p className="text-sm text-muted-foreground mb-6 max-w-sm">{result?.error}</p>
        {result?.code === 'email_mismatch' && (
          <Button onClick={() => base44.auth.logout(window.location.origin + '/Login')} className="w-full">
            <LogIn className="h-4 w-4 mr-2" /> Sign in with a different account
          </Button>
        )}
      </Shell>
    );
  }

  // success
  return (
    <Shell>
      <div className="h-16 w-16 rounded-2xl bg-success/10 flex items-center justify-center mb-5">
        <CheckCircle2 className="h-9 w-9 text-success" />
      </div>
      <h1 className="text-2xl font-bold text-foreground mb-1">You're in 🎉</h1>
      <p className="text-sm text-muted-foreground mb-6">You have successfully joined</p>

      <Card className="border-border bg-card/60 backdrop-blur-md w-full max-w-sm mb-6">
        <CardContent className="p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-foreground">{result?.school_name}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1 capitalize">
              {React.createElement(roleIcon, { className: 'h-3.5 w-3.5' })} as {result?.role}
            </p>
          </div>
        </CardContent>
      </Card>

      <Button onClick={() => { window.location.href = result?.redirect || '/StudentDashboard'; }} className="w-full max-w-sm">
        Go to Dashboard <ArrowRight className="h-4 w-4 ml-2" />
      </Button>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background accent-glow">
      <div className="w-full max-w-md flex flex-col items-center text-center">{children}</div>
    </div>
  );
}