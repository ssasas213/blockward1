import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import InitialsAvatar from '@/components/ui/InitialsAvatar';
import {
  Shield, CheckCircle2, Trophy, Users, Clock, ArrowRight, AtSign, ShieldCheck,
} from 'lucide-react';
import { format } from 'date-fns';

const CATEGORY_LABELS = {
  academic: 'Academic', sports: 'Sports', arts: 'Arts', leadership: 'Leadership',
  community: 'Community', behaviour: 'Behaviour', special: 'Special',
};

/**
 * TeamPage — the public shared team credential page (/team/:slug).
 * Lists every participant with their role, avatar and handle; pending
 * participants show as pending; declined participants never appear.
 */
export default function TeamPage() {
  const { slug } = useParams();
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await base44.functions.invoke('publicTeamData', { team_slug: slug });
        if (!active) return;
        if (!res.data?.ok) throw new Error('not_found');
        setTeam(res.data.team);
      } catch {
        if (active) setNotFound(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [slug]);

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );

  if (notFound) return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full text-center surface-card">
        <CardContent className="py-16">
          <div className="h-16 w-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <Shield className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">Team record not found</h1>
          <p className="text-muted-foreground text-sm">This link is invalid or the team record has been removed.</p>
        </CardContent>
      </Card>
    </div>
  );

  const achievedDate = team.date_achieved ? format(new Date(team.date_achieved), 'MMMM d, yyyy') : null;
  const accepted = team.participants.filter((p) => p.status === 'accepted');
  const pending = team.participants.filter((p) => p.status === 'pending');

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-secondary">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-foreground tracking-tight">BlockWard</span>
          </div>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
            Learn about BlockWard <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8 md:py-12 space-y-6 animate-fade-in">
        {/* Verified banner */}
        <div className="rounded-2xl border border-success/25 bg-success/10 p-6 flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-success/15 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="h-8 w-8 text-success" />
          </div>
          <div>
            <p className="font-bold text-2xl tracking-tight text-foreground">Verified team achievement</p>
            <p className="text-sm text-muted-foreground">
              One credential, verified once — shared by everyone who accepts their place below
            </p>
          </div>
        </div>

        {/* Team credential card */}
        <Card className="surface-card verified-glow overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-primary via-brand-pink to-accent" />
          <CardContent className="p-6 md:p-8">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-secondary border border-border text-xs font-medium text-muted-foreground">
                <Users className="h-3 w-3" /> Team achievement
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-secondary border border-border text-xs font-medium text-muted-foreground capitalize">
                {CATEGORY_LABELS[team.category] || team.category}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight mb-2">{team.title}</h1>
            {team.description && <p className="text-muted-foreground text-sm leading-relaxed">{team.description}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><Trophy className="h-4 w-4 text-tertiary" />{team.organisation_name}</span>
              {achievedDate && <span className="text-xs text-tertiary">Achieved {achievedDate}</span>}
              {team.verifier_name && <span className="text-xs text-tertiary">Verified by {team.verifier_name}</span>}
            </div>
            {team.verification_id && (
              <div className="mt-4">
                <Button asChild variant="outline" size="sm">
                  <Link to={`/verify/${team.verification_id}`}>
                    <ShieldCheck className="h-4 w-4 mr-1.5" /> View the group credential
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Participants */}
        <Card className="surface-card">
          <CardContent className="p-6">
            <h2 className="text-sm font-semibold text-tertiary uppercase tracking-wider mb-4 flex items-center gap-2">
              <Users className="h-4 w-4" /> The team · {accepted.length} accepted
              {pending.length > 0 && `, ${pending.length} pending`}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {team.participants.map((p, i) => (
                p.status === 'accepted' ? (
                  <div key={i} className="card-hover flex items-center gap-3 rounded-xl border border-border bg-secondary/40 p-3.5">
                    {p.profile_url ? (
                      <Link to={p.profile_url} className="flex items-center gap-3 flex-1 min-w-0 group">
                        <InitialsAvatar name={p.name} src={p.avatar_url} size="md" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">{p.name}</p>
                          {p.handle
                            ? <span className="text-xs text-tertiary flex items-center gap-0.5"><AtSign className="h-3 w-3" />{p.handle}</span>
                            : <span className="text-xs text-tertiary">On BlockWard</span>}
                        </div>
                      </Link>
                    ) : (
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <InitialsAvatar name={p.name} src={p.avatar_url} size="md" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
                          <span className="text-xs text-tertiary">Accepted</span>
                        </div>
                      </div>
                    )}
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <Badge className="bg-primary/10 border border-primary/20 text-primary hover:bg-primary/10">{p.role}</Badge>
                      {p.verification_id && (
                        <Link to={`/verify/${p.verification_id}`} className="text-[11px] text-muted-foreground hover:text-primary hover:underline">
                          Credential →
                        </Link>
                      )}
                    </div>
                  </div>
                ) : (
                  <div key={i} className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-secondary/20 p-3.5 opacity-75">
                    <div className="h-10 w-10 rounded-full border border-dashed border-border flex items-center justify-center flex-shrink-0">
                      <Clock className="h-4 w-4 text-tertiary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-muted-foreground truncate">{p.name}</p>
                      <span className="text-xs text-tertiary">Pending — awaiting their acceptance</span>
                    </div>
                    <Badge variant="secondary" className="flex-shrink-0">{p.role}</Badge>
                  </div>
                )
              ))}
            </div>
            <p className="text-xs text-tertiary mt-5">
              Nobody appears on this record without accepting their invitation. Teammates who declined are removed entirely.
            </p>
          </CardContent>
        </Card>

        <div className="text-center pb-8">
          <p className="text-xs text-tertiary">
            Verified through <span className="font-semibold text-primary">BlockWard</span>
          </p>
        </div>
      </div>
    </div>
  );
}