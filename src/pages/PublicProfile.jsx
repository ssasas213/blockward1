import React, { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Shield, Share2, BadgeCheck, Loader2, Lock, ArrowRight, ShieldAlert, Quote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import InitialsAvatar from '@/components/ui/InitialsAvatar';
import AchievementTile from '@/components/publicProfile/AchievementTile';
import AchievementDetailModal from '@/components/publicProfile/AchievementDetailModal';
import ProfileShareDialog from '@/components/profile/ProfileShareDialog';
import EndorseDialog from '@/components/endorsements/EndorseDialog';
import EndorsementList from '@/components/endorsements/EndorsementList';
import { createPageUrl } from '@/utils';

const DEFAULT_OG = 'https://media.base44.com/images/public/6936b840baa53bb465f68d09/3c961351d_generated_image.png';

function setMeta(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export default function PublicProfile() {
  const { handle } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [selected, setSelected] = useState(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [viewer, setViewer] = useState(null);
  const [endorseOpen, setEndorseOpen] = useState(false);
  const [reload, setReload] = useState(0);

  // Who is looking at this profile (endorsement is signed-in only).
  useEffect(() => {
    let active = true;
    base44.auth.isAuthenticated().then(async (authed) => {
      if (authed && active) {
        try { setViewer(await base44.auth.me()); } catch (e) { /* stay anonymous */ }
      }
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setNotFound(false);
    setData(null);
    base44.functions.invoke('publicProfileData', { handle })
      .then((res) => {
        if (!active) return;
        if (res.data?.ok) setData(res.data);
        else setNotFound(true);
      })
      .catch(() => { if (active) setNotFound(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [handle, reload]);

  // Social preview meta tags — injected client-side (best effort for
  // JS-executing crawlers; static fallback lives in index.html).
  useEffect(() => {
    if (!data?.ok || data.private) return;
    const s = data.student;
    document.title = `${s.name} (@${s.handle}) — verified achievements · BlockWard`;
    setMeta('property', 'og:title', `${s.name} (@${s.handle}) — verified achievements`);
    setMeta('property', 'og:description', s.bio || `${data.count} verified achievement${data.count === 1 ? '' : 's'} on BlockWard`);
    setMeta('property', 'og:image', s.og_image_url || s.avatar_url || DEFAULT_OG);
    setMeta('property', 'og:url', window.location.href);
    setMeta('property', 'og:type', 'profile');
    setMeta('name', 'twitter:card', 'summary_large_image');

    let robots = document.head.querySelector('meta[name="robots"]');
    if (s.link_only) {
      if (!robots) { robots = document.createElement('meta'); robots.setAttribute('name', 'robots'); document.head.appendChild(robots); }
      robots.setAttribute('content', 'noindex');
    } else if (robots) {
      robots.setAttribute('content', 'index,follow');
    }

    return () => {
      document.title = 'BlockWard — Verified Achievements';
      if (robots) robots.remove();
    };
  }, [data]);

  // Old handles redirect to the current one.
  if (data?.redirect_to && data.redirect_to !== handle) {
    return <Navigate to={`/@${data.redirect_to}`} replace />;
  }

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
          <h1 className="text-xl font-bold text-foreground">No profile at /@{handle}</h1>
          <p className="text-sm text-muted-foreground mt-2">This handle isn't claimed yet — or doesn't exist.</p>
          <Button className="mt-6" onClick={() => window.location.href = createPageUrl('Signup')}>
            Claim your profile <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  if (data.private) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-warning/10 flex items-center justify-center mb-4">
            <Lock className="h-7 w-7 text-warning" />
          </div>
          <h1 className="text-xl font-bold text-foreground">@{data.student.handle} keeps this profile private</h1>
          <p className="text-sm text-muted-foreground mt-2">You'll need to ask them to share it with you.</p>
        </div>
      </div>
    );
  }

  const { student, school, achievements, count } = data;

  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      {/* Slim header */}
      <header className="fixed top-0 left-0 right-0 z-40 glass border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <a href={createPageUrl('Home')} className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-semibold text-foreground">BlockWard</span>
          </a>
          <Button size="sm" variant="outline" onClick={() => setShareOpen(true)}>
            <Share2 className="h-4 w-4 mr-1.5" /> Share
          </Button>
        </div>
      </header>

      <main className="pt-14 max-w-5xl mx-auto px-4 sm:px-6 pb-24">
        {/* Profile header */}
        <div className="mt-8 sm:mt-12 rounded-2xl border border-border bg-card/60 backdrop-blur-md p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-end gap-5">
            <InitialsAvatar name={student.name} src={student.avatar_url} size="xl" ring />
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl sm:text-4xl font-bold text-foreground leading-tight">{student.name}</h1>
              <p className="text-base text-primary font-semibold mt-0.5">@{student.handle}</p>
              {student.bio && <p className="text-sm sm:text-base text-muted-foreground mt-2 leading-relaxed">{student.bio}</p>}
            </div>
            <div className="flex-shrink-0 rounded-xl bg-background/60 border border-border px-5 py-3 text-center">
              <p className="text-2xl sm:text-3xl font-bold text-foreground leading-none">{count}</p>
              <p className="text-[11px] text-muted-foreground mt-1">verified{count === 1 ? ' achievement' : ' achievements'}</p>
            </div>
          </div>

          {school && (
            <div className="mt-5 flex items-center gap-2.5">
              {school.logo_url ? (
                <img src={school.logo_url} alt="" className="h-6 w-6 rounded object-cover" />
              ) : (
                <InitialsAvatar name={school.name} size="xs" />
              )}
              <span className="text-sm text-foreground font-medium">{school.name}</span>
              {(school.city || school.country) && (
                <span className="text-xs text-muted-foreground">
                  · {[school.city, school.country].filter(Boolean).join(', ')}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Achievements grid */}
        {achievements.length > 0 ? (
          <>
            <div className="flex items-center gap-2 mt-10 mb-4">
              <h2 className="text-lg font-semibold text-foreground">Verified achievements</h2>
              <BadgeCheck className="h-4 w-4 text-success" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {achievements.map((a) => (
                <AchievementTile key={a.registry_id} achievement={a} onClick={() => setSelected(a)} />
              ))}
            </div>
          </>
        ) : (
          <div className="mt-10 rounded-xl border border-border bg-card/40 p-8 text-center">
            <p className="text-sm text-muted-foreground">No achievements published on this profile yet.</p>
          </div>
        )}

        {/* Endorsements waiting for a published achievement (invite-claimed) */}
        {data.endorsements_unattached?.length > 0 && (
          <div className="mt-10">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-semibold text-foreground">What peers say</h2>
              <Quote className="h-4 w-4 text-primary" />
              <span className="text-xs text-tertiary">signed · scarce · never anonymous</span>
            </div>
            <EndorsementList endorsements={data.endorsements_unattached} showAchievementTitle />
          </div>
        )}

        {/* Recruiter CTA */}
        <div className="mt-16 rounded-2xl border border-primary/20 bg-primary/5 p-8 text-center">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">Your achievements deserve receipts too.</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
            Turn every award, belt, grade and win into a verified credential that lasts forever.
          </p>
          <Button className="mt-5" onClick={() => window.location.href = createPageUrl('Signup')}>
            Claim your profile <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </main>

      <AchievementDetailModal
        achievement={selected}
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
        endorsements={selected?.endorsements}
        canEndorse={!!viewer}
        onEndorse={() => setEndorseOpen(true)}
      />
      <EndorseDialog
        open={endorseOpen}
        onOpenChange={setEndorseOpen}
        achievement={selected}
        mode="achievement"
        onDone={() => setReload(Date.now())}
      />
      <ProfileShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        profile={{
          name: student.name,
          handle: student.handle,
          bio: student.bio,
          avatar_url: student.avatar_url,
          schoolName: school?.name,
          count,
        }}
      />
    </div>
  );
}