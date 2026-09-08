import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Shield, Loader2, CheckCircle2, XCircle, ShieldCheck } from 'lucide-react';

// Public guardian consent page (/guardian-consent/:token). Opened from the
// email sent to a parent/guardian of an under-13 student. No sign-in required —
// the token is the one-time secret; consent is recorded with a timestamp.
export default function GuardianConsent() {
  const { token } = useParams();
  const [state, setState] = useState('loading'); // loading | pending | confirming | done | granted | invalid
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await base44.functions.invoke('guardianConsentAction', { action: 'status', token });
        if (res.data?.found && res.data.status === 'granted') {
          setInfo(res.data);
          setState('granted');
        } else if (res.data?.found) {
          setInfo(res.data);
          setState('pending');
        } else {
          setState('invalid');
        }
      } catch {
        setState('invalid');
      }
    })();
  }, [token]);

  const handleConsent = async () => {
    setState('confirming');
    setError('');
    try {
      const res = await base44.functions.invoke('guardianConsentAction', { action: 'redeem', token });
      if (!res.data?.ok) throw new Error(res.data?.error || 'Could not record consent.');
      setInfo(res.data);
      setState('done');
    } catch (err) {
      setError(err?.message || 'Something went wrong. Please try again.');
      setState('pending');
    }
  };

  const firstName = info?.student_first_name || 'your child';

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12 accent-glow">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex flex-col items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
              <Shield className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-semibold text-foreground tracking-tight">BlockWard</span>
          </Link>
        </div>

        <div className="glass rounded-xl shadow-sm p-8 text-center">
          {state === 'loading' && (
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
          )}

          {state === 'invalid' && (
            <>
              <div className="mx-auto h-12 w-12 rounded-xl bg-destructive/10 flex items-center justify-center mb-4">
                <XCircle className="h-6 w-6 text-destructive" />
              </div>
              <h1 className="text-lg font-semibold text-foreground mb-2">This link isn't valid</h1>
              <p className="text-sm text-muted-foreground mb-6">
                The consent link may have expired or already been used. Ask the student to sign in and resend the link.
              </p>
            </>
          )}

          {state === 'granted' && (
            <>
              <div className="mx-auto h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center mb-4">
                <CheckCircle2 className="h-6 w-6 text-success" />
              </div>
              <h1 className="text-lg font-semibold text-foreground mb-2">Consent already recorded</h1>
              <p className="text-sm text-muted-foreground mb-6">
                {firstName}'s account has been activated. No further action is needed.
              </p>
            </>
          )}

          {state === 'pending' && (
            <>
              <div className="mx-auto h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <ShieldCheck className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-lg font-semibold text-foreground mb-2">Confirm {firstName}'s account</h1>
              <p className="text-sm text-muted-foreground mb-2">
                {firstName} signed up for BlockWard — a platform where students collect verified school achievements that are permanently recorded.
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                Because they are under 13, the account stays inactive until a parent or guardian consents.
              </p>

              {error && (
                <div role="alert" className="mb-4 p-3 bg-destructive/5 border border-destructive/20 rounded-lg text-sm text-destructive text-left">
                  {error}
                </div>
              )}

              <Button onClick={handleConsent} className="w-full font-medium py-2.5">
                I am {firstName}'s parent or guardian — I consent
              </Button>
              <p className="text-xs text-muted-foreground mt-3">
                Your consent is recorded with the date and time you confirm. If you did not expect this, ignore this page.
              </p>
            </>
          )}

          {state === 'confirming' && (
            <div className="py-6">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
              <p className="text-sm text-muted-foreground mt-3">Recording your consent…</p>
            </div>
          )}

          {state === 'done' && (
            <>
              <div className="mx-auto h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center mb-4">
                <CheckCircle2 className="h-6 w-6 text-success" />
              </div>
              <h1 className="text-lg font-semibold text-foreground mb-2">Thank you — consent recorded</h1>
              <p className="text-sm text-muted-foreground mb-2">
                {firstName}'s account is now active. They can sign in and start using BlockWard.
              </p>
              <p className="text-xs text-muted-foreground">
                Recorded on {new Date().toLocaleString()}.
              </p>
            </>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Questions? <Link to="/" className="text-primary hover:underline">Learn more about BlockWard</Link>
        </p>
      </div>
    </div>
  );
}