import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Shield, CheckCircle2, Users, Loader2, Copy, Trophy, XCircle, ArrowRight, Sparkles, UserPlus,
} from 'lucide-react';

/**
 * TeamJoin — a teammate's private accept/decline page (/team-join/:token),
 * reached from their email link. No account needed. Accepting publishes their
 * personal credential with their role; declining removes them entirely.
 */
export default function TeamJoin() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(null);
  const [acting, setActing] = useState(false);
  const [result, setResult] = useState(null); // { status: 'accepted'|'declined', ... }
  const [copied, setCopied] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('teamParticipantAction', { action: 'get', token });
      if (!res.data?.ok) throw new Error(res.data?.error || 'invalid');
      setData(res.data);
    } catch (e) {
      setInvalid(e?.response?.data?.error || e.message || 'This link is invalid');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [token]);

  const act = async (action) => {
    setActing(true);
    try {
      const res = await base44.functions.invoke('teamParticipantAction', { action, token });
      if (!res.data?.ok) throw new Error(res.data?.error || 'Something went wrong');
      setResult(res.data);
      if (action === 'accept') toast.success('Your credential is live');
      else toast.success("You've been removed from the team record");
    } catch (e) {
      toast.error(e?.response?.data?.error || e.message);
    } finally {
      setActing(false);
    }
  };

  const copyTeamLink = () => {
    const url = `${window.location.origin}/team/${result?.team_slug || data?.team?.team_slug}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );

  if (invalid && !data) return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full text-center surface-card">
        <CardContent className="py-16">
          <div className="h-16 w-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <Shield className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">Invitation not available</h1>
          <p className="text-muted-foreground text-sm">{invalid}</p>
        </CardContent>
      </Card>
    </div>
  );

  const team = data?.team;
  const you = data?.you;

  // ── Declined view ──
  if (result?.status === 'declined' || (you?.status === 'declined' && !result)) return (
    <Shell>
      <Card className="surface-card">
        <CardContent className="p-8 text-center">
          <div className="h-14 w-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
            <XCircle className="h-7 w-7 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">You've been removed</h1>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            You are no longer listed on the team record for <strong>{team?.title}</strong>. Your name, role and
            credential will not appear anywhere public.
          </p>
        </CardContent>
      </Card>
    </Shell>
  );

  // ── Accepted view: credential live + share prompt ──
  const acceptedResult = result?.status === 'accepted' ? result : (you?.status === 'accepted' && you?.verification_id ? you : null);
  if (acceptedResult) return (
    <Shell>
      <Card className="surface-card verified-glow">
        <CardContent className="p-8">
          <div className="text-center mb-6">
            <div className="h-14 w-14 rounded-2xl bg-success/15 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-7 w-7 text-success" />
            </div>
            <h1 className="text-xl font-bold text-foreground mb-1.5">Your credential is live</h1>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              You're on the verified team record for <strong>{team?.title}</strong> as <strong>{you?.role}</strong>.
            </p>
          </div>

          <div className="space-y-2.5">
            <Button asChild className="w-full">
              <Link to={`/team/${acceptedResult.team_slug || team?.team_slug}`}>
                <Users className="h-4 w-4 mr-2" /> View the team record
              </Link>
            </Button>
            {acceptedResult.verification_id && (
              <Button asChild variant="outline" className="w-full">
                <Link to={`/verify/${acceptedResult.verification_id}`}>
                  <Sparkles className="h-4 w-4 mr-2" /> View your credential
                </Link>
              </Button>
            )}
            <Button variant="outline" className="w-full" onClick={copyTeamLink}>
              {copied ? <CheckCircle2 className="h-4 w-4 mr-2 text-success" /> : <Copy className="h-4 w-4 mr-2" />}
              {copied ? 'Link copied' : 'Share the team record'}
            </Button>
          </div>

          {!acceptedResult.on_blockward && (
            <div className="mt-5 rounded-xl border border-primary/25 bg-primary/5 p-4">
              <p className="text-sm font-medium text-foreground flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-primary" /> Get it on your profile
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Your credential is saved to this email. Create your free BlockWard account with the email that received
                this link and it will appear on your public profile automatically.
              </p>
              <Button asChild size="sm" className="mt-3">
                <Link to="/Signup">Create my account</Link>
              </Button>
            </div>
          )}

          <p className="text-xs text-tertiary text-center mt-5">
            Share this with your teammates — the more who accept, the stronger the record.
          </p>
        </CardContent>
      </Card>
    </Shell>
  );

  // ── Invitation view: accept or decline ──
  return (
    <Shell>
      <Card className="surface-card">
        <CardContent className="p-8">
          <div className="text-center mb-6">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Users className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-xl font-bold text-foreground mb-1.5">You're part of a verified team achievement</h1>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              {team?.added_by || 'A teammate'} listed you on
              <strong>{team?.title ? ` ${team.title}` : ' this achievement'}</strong>
              {team?.organisation_name ? ` at ${team.organisation_name}` : ''}.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-secondary/40 p-4 mb-6">
            <p className="text-xs font-semibold text-tertiary uppercase tracking-wide">Your role</p>
            <p className="text-lg font-bold text-foreground mt-1">{you?.role}</p>
            {team?.date_achieved && (
              <p className="text-xs text-muted-foreground mt-2">
                Achieved {new Date(team.date_achieved).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )}
          </div>

          <p className="text-xs text-muted-foreground mb-6 text-center">
            The team achievement has been verified. Accept to publish your own credential — with your role — and appear
            on the team record. Declining removes you entirely. You only appear publicly if you accept.
          </p>

          <div className="space-y-2.5">
            <Button className="w-full" size="lg" onClick={() => act('accept')} disabled={acting}>
              {acting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Accept my credential
            </Button>
            <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => act('decline')} disabled={acting}>
              Decline — remove me from this achievement
            </Button>
          </div>
        </CardContent>
      </Card>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-secondary/40 backdrop-blur-sm">
        <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-foreground tracking-tight">BlockWard</span>
          </div>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
            Learn more <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>
      <div className="max-w-md mx-auto px-4 py-8 md:py-14 animate-fade-in relative verify-ambient">
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary border border-border">
            <Trophy className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-medium text-muted-foreground">Verified team credential</span>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}