import React, { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Shield, Share2, BadgeCheck, Loader2, Lock, ArrowRight, ShieldAlert, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import InitialsAvatar from '@/components/ui/InitialsAvatar';
import AchievementTile from '@/components/publicProfile/AchievementTile';
import AchievementListRow from '@/components/publicProfile/AchievementListRow';
import SocialLinks from '@/components/publicProfile/SocialLinks';
import FeaturedLink from '@/components/publicProfile/FeaturedLink';
import AchievementDetailModal from '@/components/publicProfile/AchievementDetailModal';
import ProfileShareDialog from '@/components/profile/ProfileShareDialog';
import EndorseDialog from '@/components/endorsements/EndorseDialog';
import EndorsementList from '@/components/endorsements/EndorsementList';
import ProfileControls from '@/components/publicProfile/ProfileControls';
import ProfileTimeline from '@/components/publicProfile/ProfileTimeline';
import SelfReportedSection from '@/components/publicProfile/SelfReportedSection';
import HighlightsRow from '@/components/publicProfile/HighlightsRow';
import { exportPortfolioPdf } from '@/lib/portfolioPdf';
import { DOMAIN_ORDER, DOMAIN_LABELS } from '@/lib/achievementDomains';
import { themeVars, bannerStyle } from '@/lib/profileThemes';
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
  // Splat route ("/@*") — React Router v6 can't bind a literal "@" prefix and
  // a dynamic segment in the same path segment, so the handle arrives as the
  // '*' param. Normalise before lookup: strip any trailing slash, trim,
  // lowercase.
  const params = useParams();
  const handle = (params['*'] || '').replace(/\/+$/, '').trim().toLowerCase();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [selected, setSelected] = useState(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [viewerEmail, setViewerEmail] = useState(null);
  const [anonId, setAnonId] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [endorseOpen, setEndorseOpen] = useState(false);
  const [followState, setFollowState] = useState({ known: false, following: false });
  const [followBusy, setFollowBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [chip, setChip] = useState('all');
  const [sort, setSort] = useState('endorsements');
  const [view, setView] = useState('grid');

  // Who is looking at this profile (endorsement is signed-in only; pinning is owner-only).
  useEffect(() => {
    let active = true;
    // Anonymous visitors get a stable local id so views can be deduplicated
    // per person without ever identifying them.
    try {
      let anon = localStorage.getItem('bw_anon_id');
      if (!anon) {
        anon = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
        localStorage.setItem('bw_anon_id', anon);
      }
      setAnonId(anon);
    } catch { /* private mode — stay fully anonymous */ }
    base44.auth.isAuthenticated().then(async (authed) => {
      if (authed && active) {
        try { setViewerEmail((await base44.auth.me()).email); } catch (e) { /* stay anonymous */ }
      }
    }).finally(() => { if (active) setAuthChecked(true); });
    return () => { active = false; };
  }, []);

  // Follow state for signed-in viewers (one-directional, public — no approval).
  useEffect(() => {
    let active = true;
    if (!viewerEmail || !data?.ok || data.private || !data.student?.handle || data.is_owner) return;
    base44.functions.invoke('socialAction', { action: 'follow_state', handle: data.student.handle })
      .then((res) => {
        if (active && res.data?.ok) setFollowState({ known: true, following: !!res.data.following });
      })
      .catch(() => {});
    return () => { active = false; };
  }, [viewerEmail, data]);

  const toggleFollow = async () => {
    if (!data?.student?.handle) return;
    setFollowBusy(true);
    try {
      const res = await base44.functions.invoke('socialAction', {
        action: followState.following ? 'unfollow' : 'follow',
        handle: data.student.handle,
      });
      if (res.data?.ok) setFollowState({ known: true, following: !!res.data.following });
      else throw new Error(res.data?.error);
    } catch (e) {
      toast.error('Could not update — try again');
    } finally {
      setFollowBusy(false);
    }
  };

  useEffect(() => {
    let active = true;
    if (!authChecked) return;
    setLoading(true);
    setNotFound(false);
    setData(null);
    base44.functions.invoke('publicProfileData', { handle, viewer_email: viewerEmail, anon_id: anonId })
      .then((res) => {
        if (!active) return;
        if (res.data?.ok) setData(res.data);
        else setNotFound(true);
      })
      .catch(() => { if (active) setNotFound(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [handle, reload, authChecked]);

  // Social preview meta tags — injected client-side (best effort for
  // JS-executing crawlers; static fallback lives in index.html).
  useEffect(() => {
    if (!data?.ok || data.private) return;
    const s = data.student;
    document.title = `${s.name} (@${s.handle}) — verified achievements · BlockWard`;
    setMeta('property', 'og:title', `${s.name} (@${s.handle}) — verified achievements`);
    setMeta('property', 'og:description', s.bio || `${data.count} verified achievement${data.count === 1 ? '' : 's'} on BlockWard`);
    setMeta('property', 'og:image', s.og_image_url || s.avatar_url || DEFAULT_OG);
    // No saved share card yet — request the server-rendered OG card (cached
    // server-side) and upgrade the preview once it's ready.
    if (!s.og_image_url && s.handle) {
      base44.functions.invoke('generateProfileCard', { variant: 'og', handle: s.handle })
        .then((res) => { if (res.data?.ok) setMeta('property', 'og:image', res.data.url); })
        .catch(() => {});
    }
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

  const { student, school, orgs = [], achievements, self_reported = [], pinned = [], is_owner } = data;
  const count = data.count;

  // Student-chosen visual customisation (presets only).
  const vars = themeVars(student.theme_id, student.accent_colour, student.display_font);
  const bannerCss = bannerStyle(student.banner_url);
  const layout = student.profile_layout || 'grid';

  // Category counts for the filter chips.
  const counts = { all: achievements.length };
  for (const a of achievements) {
    const d = a.domain || 'other';
    counts[d] = (counts[d] || 0) + 1;
  }

  const byDate = (a, b) =>
    new Date(b.date_achieved || b.date_delivered || b.date_approved || 0) -
    new Date(a.date_achieved || a.date_delivered || a.date_approved || 0);

  const filtered = chip === 'all' ? achievements : achievements.filter((a) => (a.domain || 'other') === chip);

  const sorted = (() => {
    const arr = [...filtered];
    if (sort === 'endorsements') arr.sort((a, b) => (b.endorsement_count - a.endorsement_count) || byDate(a, b));
    else if (sort === 'date') arr.sort(byDate);
    else arr.sort((a, b) => DOMAIN_ORDER.indexOf(a.domain || 'other') - DOMAIN_ORDER.indexOf(b.domain || 'other') || byDate(a, b));
    return arr;
  })();

  const grouped = (() => {
    const groups = {};
    for (const a of sorted) {
      const d = a.domain || 'other';
      (groups[d] = groups[d] || []).push(a);
    }
    return DOMAIN_ORDER.filter((d) => groups[d]).map((d) => ({ domain: d, items: groups[d] }));
  })();

  const pinnedItems = pinned.map((id) => achievements.find((a) => a.registry_id === id)).filter(Boolean);

  const togglePin = async (id) => {
    const next = pinned.includes(id) ? pinned.filter((x) => x !== id) : [...pinned, id].slice(-6);
    try {
      const res = await base44.functions.invoke('updatePublicProfile', { pinned_achievement_ids: next });
      if (!res.data?.ok) throw new Error(res.data?.error || 'Could not update highlights');
      setReload(Date.now());
    } catch (e) {
      toast.error(e?.response?.data?.error || e.message);
    }
  };

  const exportPdf = async () => {
    setExporting(true);
    try {
      await exportPortfolioPdf(data, window.location.href);
    } catch (e) {
      toast.error('Export failed — try again');
    } finally {
      setExporting(false);
    }
  };

  const openAchievement = (a) => setSelected(a);
  const canEndorse = !!viewerEmail && !is_owner;
  const endorseTile = (a) => { setSelected(a); setEndorseOpen(true); };

  return (
    <div className="min-h-screen bg-background font-sans antialiased" style={vars}>
      {/* Slim header */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <a href={createPageUrl('Home')} className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-semibold text-foreground">BlockWard</span>
          </a>
          <div className="flex items-center gap-2">
            {viewerEmail && !is_owner && (
              <Button
                size="sm"
                variant={followState.following ? 'secondary' : 'default'}
                onClick={toggleFollow}
                disabled={followBusy}
              >
                {followState.following ? 'Following' : 'Follow'}
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={exportPdf} disabled={exporting}>
              {exporting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Download className="h-4 w-4 mr-1.5" />}
              Export PDF
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShareOpen(true)}>
              <Share2 className="h-4 w-4 mr-1.5" /> Share
            </Button>
          </div>
        </div>
      </header>

      <main className="pb-24">
        {/* HERO — full-bleed banner edge to edge, identity block overlapping
            its lower edge. Everything above the grid fits one mobile screen. */}
        <section className="relative">
          <div className="absolute inset-x-0 top-0 h-36 sm:h-52 lg:h-64 overflow-hidden">
            <div className="absolute inset-0" style={bannerCss || { background: 'var(--pf-banner)' }} role="img" aria-label="Profile banner" />
            {/* Subtle accent glow — a profile with no banner still looks designed */}
            <div className="absolute inset-0" style={{ background: 'radial-gradient(80% 90% at 78% 0%, hsl(var(--primary) / 0.18), transparent 70%)' }} aria-hidden="true" />
            {/* Fade into the page so the overlapping content stays legible */}
            <div className="absolute inset-x-0 bottom-0 h-24 sm:h-28 bg-gradient-to-b from-transparent to-background" aria-hidden="true" />
          </div>

          <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-20 sm:pt-28">
            <div className="pf-rise">
              <div className="flex items-end gap-4 sm:gap-5">
                {/* Avatar — overlaps the banner boundary, ring in the accent colour */}
                <div className="rounded-full flex-shrink-0" style={{ boxShadow: '0 0 0 4px hsl(var(--primary)), 0 10px 30px rgba(0,0,0,0.25)' }}>
                  <InitialsAvatar name={student.name} src={student.avatar_url} size="xl" />
                </div>
                <div className="min-w-0 pb-1">
                  <h1 className="font-heading text-3xl sm:text-5xl font-bold text-foreground leading-tight break-words">{student.name}</h1>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="text-sm sm:text-base font-medium text-muted-foreground">@{student.handle}</p>
                    {count > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
                        <BadgeCheck className="h-3.5 w-3.5" /> Verified
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Single stats row — numbers large, labels small */}
              <div className="mt-6 flex divide-x divide-border rounded-xl border border-border bg-card/70 backdrop-blur-md">
                {[
                  { label: 'Verified', value: count },
                  { label: 'Organisations', value: orgs.length },
                  { label: 'Endorsements', value: data.endorsement_count || 0 },
                  { label: 'Views', value: student.profile_views || 0 },
                ].map((s) => (
                  <div key={s.label} className="flex-1 px-2 py-3 sm:px-4 sm:py-4 text-center">
                    <p className="text-xl sm:text-3xl font-bold text-foreground leading-none">{s.value}</p>
                    <p className="text-[10px] sm:text-[11px] uppercase tracking-wide text-muted-foreground mt-1.5">{s.label}</p>
                  </div>
                ))}
              </div>

              {orgs.length > 0 && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {orgs.map((o) => (
                    <span key={o.id || o.name} className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/40 px-3 py-1">
                      {o.logo_url ? (
                        <img src={o.logo_url} alt="" className="h-4 w-4 rounded object-cover" />
                      ) : (
                        <InitialsAvatar name={o.name} size="xs" />
                      )}
                      <span className="text-xs font-medium text-foreground">{o.name}</span>
                    </span>
                  ))}
                </div>
              )}

              {student.bio && <p className="text-sm sm:text-base text-muted-foreground mt-4 leading-relaxed whitespace-pre-line max-w-2xl">{student.bio}</p>}

              {student.social_links?.length > 0 && (
                <div className="mt-3">
                  <SocialLinks links={student.social_links} />
                </div>
              )}

              <div className="mt-4">
                <FeaturedLink link={student.featured_link} />
              </div>
            </div>
          </div>
        </section>

        <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <HighlightsRow items={pinnedItems} onOpen={openAchievement} />

        {achievements.length > 0 ? (
          <>
            <ProfileControls
              counts={counts}
              chip={chip}
              setChip={setChip}
              sort={sort}
              setSort={setSort}
              view={view}
              setView={setView}
            />

            {view === 'timeline' ? (
              <ProfileTimeline achievements={sorted} onOpen={openAchievement} />
            ) : layout === 'list' ? (
              <div className="space-y-2">
                {sort === 'category' ? (
                  grouped.map(({ domain, items }) => (
                    <section key={domain}>
                      <div className="flex items-center gap-2 mb-2 mt-4">
                        <h2 className="text-base font-semibold text-foreground">{DOMAIN_LABELS[domain] || domain}</h2>
                        <BadgeCheck className="h-4 w-4 text-success" />
                        <span className="text-xs text-tertiary">{items.length}</span>
                      </div>
                      <div className="space-y-2">
                        {items.map((a) => (
                          <AchievementListRow key={a.registry_id} achievement={a} onClick={() => openAchievement(a)} />
                        ))}
                      </div>
                    </section>
                  ))
                ) : (
                  sorted.map((a) => (
                    <AchievementListRow key={a.registry_id} achievement={a} onClick={() => openAchievement(a)} />
                  ))
                )}
              </div>
            ) : sort === 'category' ? (
              <div className="space-y-10">
                {grouped.map(({ domain, items }) => (
                  <section key={domain}>
                    <div className="flex items-center gap-2 mb-4">
                      <h2 className="text-base font-semibold text-foreground">{DOMAIN_LABELS[domain] || domain}</h2>
                      <BadgeCheck className="h-4 w-4 text-success" />
                      <span className="text-xs text-tertiary">{items.length}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 pf-rise" style={{ '--pf-delay': '120ms' }}>
                      {items.map((a) => (
                        <AchievementTile key={a.registry_id} achievement={a} onClick={() => openAchievement(a)} canEndorse={canEndorse} onEndorse={endorseTile} />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 pf-rise" style={{ '--pf-delay': '120ms' }}>
                {sorted.map((a) => (
                  <AchievementTile key={a.registry_id} achievement={a} onClick={() => openAchievement(a)} canEndorse={canEndorse} onEndorse={endorseTile} />
                ))}
              </div>
            )}
          </>
        ) : self_reported.length === 0 ? (
          <div className="mt-16 mb-8 text-center pf-rise" style={{ '--pf-delay': '60ms' }}>
            <p className="text-sm text-muted-foreground">
              Nothing published here yet — check back soon to see {student.name.split(' ')[0]}'s verified achievements.
            </p>
          </div>
        ) : null}

        {/* Self-reported — visually distinct, clearly unverified */}
        <SelfReportedSection items={self_reported} />

        {/* Endorsements waiting for a published achievement (invite-claimed) */}
        {data.endorsements_unattached?.length > 0 && (
          <div className="mt-10">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-semibold text-foreground">What peers say</h2>
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
        </div>
      </main>

      <AchievementDetailModal
        achievement={selected}
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
        endorsements={selected?.endorsements}
        canEndorse={!!viewerEmail}
        onEndorse={() => setEndorseOpen(true)}
        isOwner={is_owner}
        isPinned={!!selected && pinned.includes(selected.registry_id)}
        canPin={pinned.length < 6}
        onTogglePin={() => togglePin(selected.registry_id)}
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