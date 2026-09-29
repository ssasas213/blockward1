import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import RouteSeo from '@/components/RouteSeo';
import { Shield, Loader2, CheckCircle2, XCircle } from 'lucide-react';

/**
 * OrgInviteAccept — landing page for the emailed verifier invitation
 * (/organisation?invite=<token>). The invitee must be signed in with the
 * invited email address; joining activates their OrganisationMember record.
 */
export default function OrgInviteAccept() {
  const navigate = useNavigate();
  const token = new URLSearchParams(window.location.search).get('invite') || '';
  const [authed, setAuthed] = useState(null); // null = checking
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    base44.auth.isAuthenticated().then(setAuthed).catch(() => setAuthed(false));
  }, []);

  const accept = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await base44.functions.invoke('orgAction', { action: 'join', token });
      if (!res?.data?.ok) throw new Error(res?.data?.error || 'This invitation is no longer valid');
      setDone(true);
      setTimeout(() => navigate('/organisations/dashboard'), 1200);
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'This invitation is no longer valid');
    } finally {
      setBusy(false);
    }
  };

  if (authed === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <RouteSeo title="Verifier invitation · Blockward" description="Accept your verifier invitation" index={false} />
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center space-y-4">
          <div className="h-14 w-14 mx-auto rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
            <Shield className="h-7 w-7 text-white" />
          </div>

          {done ? (
            <>
              <h1 className="text-xl font-bold text-foreground">You're in</h1>
              <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" /> Taking you to the organisation dashboard…
              </p>
            </>
          ) : !authed ? (
            <>
              <h1 className="text-xl font-bold text-foreground">Verifier invitation</h1>
              <p className="text-sm text-muted-foreground">
                Sign in with the email address the invitation was sent to, then accept it.
              </p>
              <Button
                className="w-full"
                onClick={() => base44.auth.redirectToLogin('/organisation?invite=' + encodeURIComponent(token))}
              >
                Sign in to accept
              </Button>
            </>
          ) : (
            <>
              <h1 className="text-xl font-bold text-foreground">Verifier invitation</h1>
              <p className="text-sm text-muted-foreground">
                You've been invited to join an organisation on Blockward as a verifier — confirming achievements
                and signing verifiable credentials.
              </p>
              <Button className="w-full" onClick={accept} disabled={busy || !token}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Accept invitation
              </Button>
              {error && (
                <p className="text-xs text-destructive flex items-center justify-center gap-1">
                  <XCircle className="h-3.5 w-3.5" /> {error}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}