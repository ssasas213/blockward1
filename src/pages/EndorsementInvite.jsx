import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Shield, Quote, ArrowRight, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import InitialsAvatar from '@/components/ui/InitialsAvatar';

/**
 * EndorsementInvite — public landing page for /endorsement-invite/:token.
 * Someone without a BlockWard account was endorsed by a member; this page
 * shows "[Name] vouched for your work on [achievement]" and lands them on a
 * pre-populated signup with the endorsement waiting (auto-claimed on their
 * first dashboard load once they sign up with the invited email).
 */
export default function EndorsementInvite() {
  const { token } = useParams();
  const [state, setState] = useState('loading'); // loading | ready | error
  const [invite, setInvite] = useState(null);

  useEffect(() => {
    let active = true;
    base44.functions.invoke('endorsementData', { mode: 'invite_lookup', token })
      .then((res) => {
        if (!active) return;
        if (res.data?.ok) {
          setInvite(res.data.invite);
          setState('ready');
        } else {
          setState(res.data?.error || 'not_found');
        }
      })
      .catch(() => { if (active) setState('not_found'); });
    return () => { active = false; };
  }, [token]);

  const signupUrl = invite?.invitee_email
    ? `/Signup?email=${encodeURIComponent(invite.invitee_email)}&invite=endorsement`
    : '/Signup?invite=endorsement';

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        {/* Brand */}
        <div className="flex items-center justify-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Shield className="h-4.5 w-4.5 text-white" />
          </div>
          <span className="font-bold text-foreground tracking-tight text-lg">BlockWard</span>
        </div>

        {state === 'loading' && (
          <div className="flex justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
        )}

        {state !== 'loading' && state !== 'ready' && (
          <Card className="surface-card text-center">
            <CardContent className="py-12">
              <div className="mx-auto h-14 w-14 rounded-2xl bg-warning/10 flex items-center justify-center mb-4">
                <AlertCircle className="h-7 w-7 text-warning" />
              </div>
              <h1 className="text-lg font-bold text-foreground">
                {state === 'expired' && 'This endorsement expired'}
                {state === 'claimed' && 'This endorsement was already claimed'}
                {state === 'revoked' && 'This endorsement was withdrawn'}
                {(state === 'not_found' || state === 'error') && 'This endorsement link is invalid'}
              </h1>
              <p className="text-sm text-muted-foreground mt-2">
                {state === 'claimed'
                  ? 'The account it belongs to is already holding it.'
                  : 'Ask the person who sent it to vouch for you again.'}
              </p>
            </CardContent>
          </Card>
        )}

        {state === 'ready' && invite && (
          <Card className="surface-card verified-glow">
            <CardContent className="p-6 sm:p-8 space-y-5">
              <div className="flex items-center gap-3">
                <InitialsAvatar name={invite.endorser_name} size="md" />
                <div className="min-w-0">
                  <p className="font-semibold text-foreground truncate">{invite.endorser_name}</p>
                  <p className="text-xs text-tertiary truncate">
                    {invite.endorser_affiliation}{invite.endorser_handle ? ` · @${invite.endorser_handle}` : ''}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xl sm:text-2xl font-bold text-foreground leading-snug">
                  {invite.endorser_name} vouched for your work on
                  <span className="text-primary"> {invite.achievement_title}</span>.
                </p>
              </div>

              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <p className="text-sm text-muted-foreground leading-relaxed flex gap-2">
                  <Quote className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-1" />
                  {invite.text}
                </p>
              </div>

              <p className="text-xs text-tertiary flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                {invite.invitee_email
                  ? `Sign up with ${invite.invitee_email} and it's already on your profile.`
                  : 'The endorsement is waiting — claim it by creating your profile.'}
              </p>

              <Button asChild size="lg" className="w-full">
                <Link to={signupUrl}>
                  Claim it <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-tertiary">
          Endorsements on BlockWard are scarce, signed and never anonymous.
        </p>
      </div>
    </div>
  );
}