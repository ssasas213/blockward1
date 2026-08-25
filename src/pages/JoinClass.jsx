import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, QrCode, GraduationCap, LogIn, UserPlus, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function JoinClass() {
  const [code, setCode] = useState('');
  const [status, setStatus] = useState('loading');
  const [className, setClassName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const c = (params.get('code') || '').trim().toUpperCase();
    setCode(c);
    if (!c) { setStatus('error'); setErrorMsg('No class code provided in the link.'); return; }
    init();
  }, []);

  const init = async () => {
    try {
      const authed = await base44.auth.isAuthenticated();
      if (!authed) { setStatus('unauth'); return; }
      const user = await base44.auth.me();
      if (!user) { setStatus('unauth'); return; }
      const profiles = await base44.entities.UserProfile.filter({ user_email: user.email });
      const profile = profiles[0];
      if (!profile) { setStatus('nostudent'); return; }
      if (profile.user_type !== 'student') {
        setStatus('error');
        setErrorMsg('Class joining is for students. Teachers and admins sign in to the dashboard.');
        return;
      }
      setStatus('ready');
    } catch (e) {
      setStatus('error');
      setErrorMsg(e.message || 'Something went wrong.');
    }
  };

  const join = async () => {
    setStatus('joining');
    try {
      const res = await base44.functions.invoke('joinClassByCode', { code });
      if (res.data?.ok === false || res.data?.error) throw new Error(res.data?.error || 'Failed to join');
      setClassName(res.data?.class?.name || '');
      setStatus('done');
      toast.success(`Joined ${res.data?.class?.name || 'class'}`);
    } catch (e) {
      setStatus('ready');
      toast.error(e.message || 'Failed to join class');
    }
  };

  const nextUrl = `/JoinClass?code=${code}`;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 space-y-5 text-center">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <QrCode className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Join a class</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Class code: <span className="font-mono font-semibold text-foreground">{code || '—'}</span>
            </p>
          </div>

          {status === 'loading' && (
            <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          )}

          {status === 'error' && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm text-left">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {status === 'unauth' && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Sign in or create an account to join this class.</p>
              <Button className="w-full" onClick={() => base44.auth.redirectToLogin(nextUrl)}>
                <LogIn className="h-4 w-4 mr-2" /> Sign in
              </Button>
              <Button variant="outline" className="w-full" asChild>
                <Link to={`/Signup?next=${encodeURIComponent(nextUrl)}`}>
                  <UserPlus className="h-4 w-4 mr-2" /> Create account
                </Link>
              </Button>
            </div>
          )}

          {status === 'nostudent' && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">You need a student profile first. Complete your setup, then come back to this link.</p>
              <Button className="w-full" asChild>
                <Link to={createPageUrl('Onboarding')}>
                  <GraduationCap className="h-4 w-4 mr-2" /> Complete setup
                </Link>
              </Button>
            </div>
          )}

          {(status === 'ready' || status === 'joining') && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">You'll be added to this class and linked to its school.</p>
              <Button className="w-full" onClick={join} disabled={status === 'joining'}>
                {status === 'joining' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Join class
              </Button>
            </div>
          )}

          {status === 'done' && (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2 text-success">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">You're in{className ? ` — ${className}` : ''}!</span>
              </div>
              <Button className="w-full" asChild>
                <Link to={createPageUrl('StudentDashboard')}>Go to dashboard</Link>
              </Button>
            </div>
          )}

          <div className="pt-2">
            <Link to={createPageUrl('Home')} className="text-xs text-muted-foreground hover:text-foreground">Back to BlockWard</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}