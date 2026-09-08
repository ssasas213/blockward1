import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import InitialsAvatar from '@/components/ui/InitialsAvatar';
import {
  Shield, Loader2, ShieldAlert, BadgeCheck, ArrowRight, AtSign, Globe, MapPin, ExternalLink,
} from 'lucide-react';

const ORG_TYPE_LABELS = {
  school: 'School', sports_club: 'Sports club', martial_arts_academy: 'Martial arts academy',
  chess_club: 'Chess club', competition_organizer: 'Competition organiser', training_provider: 'Training provider',
  music_academy: 'Music academy', debate_organization: 'Debate organisation', stem_competition: 'STEM competition',
  corporate_training: 'Corporate training', other: 'Organisation',
};

const CATEGORY_TINTS = {
  academic: 'bg-violet-500', sports: 'bg-emerald-500', arts: 'bg-pink-500',
  leadership: 'bg-fuchsia-500', community: 'bg-amber-500', behaviour: 'bg-slate-500',
  special: 'bg-indigo-500',
};

/**
 * OrgPage — public organisation profile (/org/:slug). Shows a school, club or
 * academy's public verified members and issued credentials. Only members with
 * fully public profiles appear.
 */
export default function OrgPage() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setNotFound(false);
    setData(null);
    base44.functions.invoke('publicOrgData', { slug })
      .then((res) => {
        if (!active) return;
        if (res.data?.ok) setData(res.data);
        else setNotFound(true);
      })
      .catch(() => { if (active) setNotFound(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug]);

  useEffect(() => {
    if (data?.ok) {
      document.title = `${data.org.name} — verified achievements · BlockWard`;
    }
    return () => { document.title = 'BlockWard — Verified Achievements'; };
  }, [data]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <ShieldAlert className="h-7 w-7 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Organisation not found</h1>
          <p className="text-sm text-muted-foreground mt-2">No organisation exists at this link.</p>
          <Button className="mt-6" onClick={() => window.location.href = '/'}>
            Back to BlockWard <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  const { org, members, credentials, member_count, credential_count } = data;

  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      {/* Slim header */}
      <header className="fixed top-0 left-0 right-0 z-40 glass border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-semibold text-foreground">BlockWard</span>
          </Link>
          <Button size="sm" onClick={() => window.location.href = '/Signup'}>
            Join BlockWard
          </Button>
        </div>
      </header>

      <main className="pt-14 max-w-5xl mx-auto px-4 sm:px-6 pb-24">
        {/* Org header */}
        <div className="mt-8 sm:mt-12 rounded-2xl border border-border bg-card/60 backdrop-blur-md p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            {org.logo_url ? (
              <img src={org.logo_url} alt={org.name} className="h-16 w-16 rounded-2xl object-cover border border-border" />
            ) : (
              <InitialsAvatar name={org.name} size="lg" />
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl sm:text-4xl font-bold text-foreground leading-tight">{org.name}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="capitalize">{ORG_TYPE_LABELS[org.org_type] || 'Organisation'} on BlockWard</span>
                {(org.city || org.country) && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />{[org.city, org.country].filter(Boolean).join(', ')}
                  </span>
                )}
                {org.website && (
                  <a
                    href={org.website.startsWith('http') ? org.website : `https://${org.website}`}
                    target="_blank"
                    rel="noopener nofollow"
                    className="inline-flex items-center gap-1 hover:text-primary transition-colors"
                  >
                    <Globe className="h-3.5 w-3.5" />Website
                  </a>
                )}
              </div>
            </div>
            <div className="flex-shrink-0 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-background/60 border border-border px-5 py-3 text-center">
                <p className="text-2xl font-bold text-foreground leading-none">{credential_count}</p>
                <p className="text-[11px] text-muted-foreground mt-1">verified credential{credential_count === 1 ? '' : 's'}</p>
              </div>
              <div className="rounded-xl bg-background/60 border border-border px-5 py-3 text-center">
                <p className="text-2xl font-bold text-foreground leading-none">{member_count}</p>
                <p className="text-[11px] text-muted-foreground mt-1">public member{member_count === 1 ? '' : 's'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Members */}
        {members.length > 0 && (
          <section className="mt-10">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-semibold text-foreground">Members</h2>
              <BadgeCheck className="h-4 w-4 text-success" />
              <span className="text-xs text-tertiary">public profiles only</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {members.map((m) => (
                <Link
                  key={m.handle}
                  to={`/@${m.handle}`}
                  className="card-hover flex items-center gap-3 rounded-xl border border-border bg-card/60 p-3.5"
                >
                  <InitialsAvatar name={m.name} src={m.avatar_url} size="md" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{m.name}</p>
                    <p className="text-xs text-tertiary flex items-center gap-0.5 truncate">
                      <AtSign className="h-3 w-3" />{m.handle}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Recent credentials */}
        {credentials.length > 0 && (
          <section className="mt-10">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-semibold text-foreground">Verified credentials issued</h2>
              <span className="text-xs text-tertiary">latest first</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {credentials.map((c, i) => (
                <Link
                  key={c.verification_id || i}
                  to={`/verify/${c.verification_id}`}
                  className="card-hover group text-left rounded-xl overflow-hidden border border-border bg-card/60"
                >
                  <div className={`relative aspect-video w-full flex items-center justify-center ${CATEGORY_TINTS[c.category] || CATEGORY_TINTS.special}`}>
                    {c.image_url ? (
                      <img src={c.image_url} alt={c.title} className="h-full w-full object-cover" />
                    ) : (
                      <Shield className="h-10 w-10 text-white/80" />
                    )}
                    <span className="absolute top-2 right-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-background/80 backdrop-blur-sm border border-success/40">
                      <BadgeCheck className="h-3.5 w-3.5 text-success" />
                    </span>
                  </div>
                  <div className="p-3">
                    <h3 className="text-sm font-semibold text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">{c.title}</h3>
                    {c.student_name && <p className="text-xs text-muted-foreground mt-1 truncate">{c.student_name}</p>}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {members.length === 0 && credentials.length === 0 && (
          <div className="mt-10 rounded-xl border border-border bg-card/40 p-8 text-center">
            <p className="text-sm text-muted-foreground">Nothing published by this organisation yet.</p>
          </div>
        )}

        {/* CTA */}
        <div className="mt-16 rounded-2xl border border-primary/20 bg-primary/5 p-8 text-center">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">Verify your achievements with {org.name}.</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
            Members of this organisation collect verified credentials that last forever.
          </p>
          <Button className="mt-5" onClick={() => window.location.href = '/Signup'}>
            Claim your profile <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </main>
    </div>
  );
}