import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Home as HomeIcon, Compass, Layers, UserRound, MessagesSquare, Loader2,
  PartyPopper, BadgeCheck, Building2, Globe, Inbox,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { loadEarnedAchievements } from '@/lib/achievementLifecycle';
import { loadMeta } from '@/lib/achievementMeta';
import PostCard from '@/components/blocktalks/PostCard';
import PostComposer from '@/components/blocktalks/PostComposer';
import InitialsAvatar from '@/components/ui/InitialsAvatar';
import { Button } from '@/components/ui/button';
import GlowActionButton from '@/components/ui/GlowActionButton';
import EmptyState from '@/components/ui/empty-state';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// BlockTalksApp — the authenticated BlockTalks experience: Home (feed),
// Explore (organisations + latest verified posts), My Posts, Profile.
// All reads run through RLS; every mutation with a trust consequence runs
// through the server-side blocktalkAction function.

const TABS = [
  { id: 'home', label: 'Home', icon: HomeIcon },
  { id: 'explore', label: 'Explore', icon: Compass },
  { id: 'myposts', label: 'My Posts', icon: Layers },
  { id: 'profile', label: 'Profile', icon: UserRound },
];

// Build the composer's shareable list — ONLY verified, public-facing items.
function toShareable(items, metaByRef) {
  const out = [];
  for (const it of items) {
    if (it.kind === 'vault') {
      if (it.card.status === 'revoked' || it.card.status === 'superseded') continue;
      out.push({
        ref: it.ref, kind: 'vault', title: it.card.title, category: it.card.category,
        org: it.card.org || null, banner: metaByRef.get(it.ref)?.banner_url || it.card.cover || null,
        verification_id: it.card.verification_id || null,
      });
    } else if (it.kind === 'achievement') {
      const c = it.raw.credential;
      if (it.raw.status !== 'verified' || !c?.bw_id || c.anchor_status !== 'confirmed') continue;
      if (c.status !== 'active' || c.revocation) continue;
      if (c.is_public === false) continue;
      out.push({
        ref: it.ref, kind: 'achievement', title: it.card.title, category: it.card.category,
        org: it.card.org || null, banner: metaByRef.get(it.ref)?.banner_url || null,
        verification_id: c.bw_id,
      });
    }
  }
  return out.filter((s) => s.verification_id);
}

export default function BlockTalksApp({ user }) {
  const email = (user?.email || '').toLowerCase();
  const [tab, setTab] = useState('home');
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);       // feed (active)
  const [myPosts, setMyPosts] = useState([]);   // mine, any status
  const [consents, setConsents] = useState([]); // org posts awaiting my approval
  const [blocks, setBlocks] = useState([]);     // people I blocked
  const [orgs, setOrgs] = useState([]);         // verified orgs (explore)
  const [myOrgs, setMyOrgs] = useState([]);     // my org memberships w/ credentials
  const [shareable, setShareable] = useState([]);
  const [composerOpen, setComposerOpen] = useState(false);
  const [preselectedRef, setPreselectedRef] = useState(null);
  const [busyPostId, setBusyPostId] = useState(null);
  const [savedOnly, setSavedOnly] = useState(false);

  const load = useCallback(async () => {
    try {
      const [profiles, feed, mine, consentRows, blockRows, orgRows, vault, metas] = await Promise.all([
        base44.entities.UserProfile.filter({ user_email: email }).catch(() => []),
        base44.entities.BlockTalksPost.filter({ status: 'active' }).catch(() => []),
        base44.entities.BlockTalksPost.filter({ author_email: email }).catch(() => []),
        base44.entities.BlockTalksPost.filter({ holder_email: email, status: 'pending_holder_consent' }).catch(() => []),
        base44.entities.BlockTalksBlock.filter({ blocker_email: email }).catch(() => []),
        base44.entities.IssuerOrganisation.filter({ status: 'verified' }).catch(() => []),
        loadEarnedAchievements({ force: true }).catch(() => ({ achievements: [] })),
        loadMeta().catch(() => []),
      ]);
      const memberships = await base44.entities.OrganisationMember.filter({ user_email: email, status: 'active' }).catch(() => []);

      setProfile(profiles[0] || null);
      setBlocks(blockRows || []);
      setConsents(consentRows || []);
      setMyPosts(mine || []);
      setOrgs(orgRows || []);

      // New-pipeline achievements joined with credentials (holder-scoped by RLS).
      const [achs, creds] = await Promise.all([
        base44.entities.Achievement.filter({}).catch(() => ({ items: [] })),
        base44.entities.Credential.filter({}).catch(() => ({ items: [] })),
      ]);
      const credByAch = new Map(((creds.items || creds) || []).map((c) => [c.achievement_id, c]));
      const metaMap = new Map((metas || []).map((m) => [m.achievement_ref, m]));
      const achItems = ((achs.items || achs) || [])
        .filter((a) => a.status === 'verified')
        .map((a) => ({
          kind: 'achievement', ref: `ach:${a.id}`,
          raw: { status: a.status, credential: credByAch.get(a.id) || null },
          card: {
            status: 'verified', title: a.title, category: a.category || 'other',
            org: a.issuer_org || null, cover: null,
            verification_id: (credByAch.get(a.id) || {}).bw_id || null,
          },
        }));
      const vaultItems = (vault?.achievements || []).filter((v) => !['revoked', 'superseded'].includes(v.status)).map((v) => ({
        kind: 'vault', ref: `vault:${v.record_id || v.id}`, raw: v,
        card: {
          status: 'verified', title: v.title, category: v.category || 'special',
          org: v.organisation_name || null, cover: v.image_url || null,
          verification_id: v.verify_id || null,
        },
      }));
      setShareable(toShareable([...achItems, ...vaultItems], metaMap));

      // Feed — active posts, minus people I blocked, newest first.
      const blocked = new Set((blockRows || []).map((b) => (b.blocked_email || '').toLowerCase()));
      setPosts(((feed || []) || [])
        .filter((p) => !blocked.has((p.author_email || '').toLowerCase()))
        .sort((a, b) => new Date(b.published_at || 0) - new Date(a.published_at || 0)));

      // My organisation context for the composer's org mode.
      if (memberships.length) {
        const res = await base44.functions.invoke('orgDashboardData', {}).catch(() => null);
        if (res?.data?.ok && res.data.org && res.data.credentials) {
          setMyOrgs([{
            org_id: res.data.org.id,
            org_name: res.data.org.name,
            credentials: (res.data.credentials || []),
          }]);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [email]);

  useEffect(() => { load(); }, [load]);

  const act = async (postId, payload, message) => {
    setBusyPostId(postId);
    try {
      await base44.functions.invoke('blocktalkAction', payload);
      if (message) toast.success(message);
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.error || e?.message || 'Action failed');
    } finally {
      setBusyPostId(null);
    }
  };

  const onReact = (post, type) => act(post.id,
    { action: 'react', post_id: post.id, type },
    type === 'save' ? ((post.saved_by || []).includes(email) ? 'Removed from saved' : 'Saved') : null);
  const onDelete = (post) => act(post.id, { action: 'delete_post', post_id: post.id }, 'Post removed — the achievement itself is untouched');
  const onBlock = (post) => act(post.id, { action: 'block', blocked_email: post.author_email }, 'Blocked — their posts no longer appear in your feed');
  const onReport = (post, reason, details) => act(post.id, { action: 'report', post_id: post.id, reason, details }, 'Report sent to the moderation team');

  const consent = async (post, approve) => {
    setBusyPostId(post.id);
    try {
      await base44.functions.invoke('blocktalkAction', { action: 'consent', post_id: post.id, approve });
      toast.success(approve ? 'Published — the recognition post is live' : 'Declined — the post was removed');
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.error || e?.message || 'Action failed');
    } finally {
      setBusyPostId(null);
    }
  };

  const openComposer = (ref = null) => { setPreselectedRef(ref); setComposerOpen(true); };

  const mySavedPosts = useMemo(
    () => posts.filter((p) => (p.saved_by || []).includes(email)),
    [posts, email],
  );

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* BlockTalks top bar + tabs */}
      <div className="glass sticky top-0 z-40 border-b border-border">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <MessagesSquare className="h-5 w-5 text-primary" />
            <span className="font-display text-lg font-bold tracking-tight text-foreground">BlockTalks</span>
          </Link>
          <InitialsAvatar
            name={profile ? `${profile.first_name || ''} ${profile.last_name || ''}` : user?.email}
            src={profile?.avatar_url}
            size="sm"
          />
        </div>
        <nav className="mx-auto flex max-w-4xl gap-1 overflow-x-auto px-2 sm:px-4" aria-label="BlockTalks sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex flex-shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </nav>
      </div>

      <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
        {/* Holder consent requests — org recognition posts awaiting approval */}
        {tab === 'home' && consents.length > 0 && (
          <section className="mb-6 space-y-3">
            <h2 className="section-heading">Recognition requests</h2>
            <p className="page-subtitle">
              {consents.length === 1 ? 'An organisation wants to recognise your achievement.' : `${consents.length} organisations want to recognise your achievements.`}
              {' '}Nothing publishes until you approve.
            </p>
            {consents.map((post) => (
              <div key={post.id} className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
                <div className="flex items-center gap-2 text-[12px] font-medium text-primary">
                  <BadgeCheck className="h-3.5 w-3.5" /> {post.org_name || 'Your organisation'}
                </div>
                <p className="mt-1.5 text-sm text-foreground">
                  Wants to publish a recognition post for <span className="font-semibold">{post.achievement_title}</span>
                  {post.caption ? <> with the caption: <em className="text-muted-foreground">"{post.caption}"</em></> : null}.
                </p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" disabled={busyPostId === post.id} onClick={() => consent(post, true)}>
                    <PartyPopper className="h-4 w-4" /> Approve & publish
                  </Button>
                  <Button size="sm" variant="outline" disabled={busyPostId === post.id} onClick={() => consent(post, false)}>
                    Decline
                  </Button>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* ── HOME — feed ── */}
        {tab === 'home' && (
          <>
            <div className="mb-6 rounded-2xl border border-border surface-card p-4">
              <GlowActionButton
                icon={MessagesSquare}
                label="Share an achievement"
                subtitle="Post a verified achievement to the feed"
                size="sm"
                onClick={() => openComposer(null)}
              />
            </div>
            {posts.length === 0 ? (
              <EmptyState
                icon={MessagesSquare}
                title="No posts yet"
                description="Be the first — share a verified achievement and start a conversation."
              />
            ) : (
              <div className="space-y-4">
                {posts.map((p) => (
                  <PostCard key={p.id} post={p} meEmail={email} busy={busyPostId === p.id}
                    onReact={onReact} onDelete={onDelete} onBlock={onBlock} onReport={onReport} />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── EXPLORE — verified organisations + latest posts ── */}
        {tab === 'explore' && (
          <>
            <section className="mb-8">
              <h2 className="section-heading mb-1">Verified organisations</h2>
              <p className="page-subtitle mb-4">
                Issuers holding full Blockward verification — the "Official issuer" badge on posts
                belongs to them.
              </p>
              {orgs.length === 0 ? (
                <EmptyState
                  icon={Building2}
                  title="No verified organisations yet"
                  description="Verified issuers appear here with their public profiles."
                />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {orgs.map((o) => (
                    <div key={o.id} className="rounded-2xl border border-border surface-card p-4">
                      <div className="flex items-center gap-2">
                        {o.logo_url
                          ? <img src={o.logo_url} alt="" className="h-8 w-8 rounded-lg object-contain" />
                          : <Building2 className="h-5 w-5 text-primary" />}
                        <span className="text-sm font-semibold text-foreground truncate">{o.name}</span>
                      </div>
                      {o.description && <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground line-clamp-3">{o.description}</p>}
                      {o.website && (
                        <a href={o.website} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-[12px] text-primary hover:underline">
                          <Globe className="h-3 w-3" /> Website
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
            <section>
              <h2 className="section-heading mb-4">Latest verified achievements</h2>
              <div className="space-y-4">
                {posts.slice(0, 10).map((p) => (
                  <PostCard key={p.id} post={p} meEmail={email} busy={busyPostId === p.id}
                    onReact={onReact} onDelete={onDelete} onBlock={onBlock} onReport={onReport} />
                ))}
              </div>
            </section>
          </>
        )}

        {/* ── MY POSTS ── */}
        {tab === 'myposts' && (
          <>
            <div className="mb-6 flex items-center justify-between">
              <h2 className="section-heading">My Posts</h2>
              <Button variant="outline" size="sm" onClick={() => setSavedOnly((v) => !v)}>
                {savedOnly ? 'Show all' : 'Saved posts'}
              </Button>
            </div>
            {(savedOnly ? mySavedPosts : myPosts).length === 0 ? (
              <EmptyState
                icon={savedOnly ? Inbox : Layers}
                title={savedOnly ? 'Nothing saved yet' : 'No posts yet'}
                description={savedOnly
                  ? 'Posts you save from the feed appear here.'
                  : 'Share a verified achievement to create your first post.'}
              />
            ) : (
              <div className="space-y-4">
                {(savedOnly ? mySavedPosts : myPosts).map((p) => (
                  <div key={p.id} className="relative">
                    {p.status !== 'active' && (
                      <div className="absolute right-3 top-3 z-10 rounded-full bg-warning/15 px-2 py-0.5 text-[12px] font-medium text-warning">
                        {p.status === 'pending_holder_consent' ? 'Awaiting holder approval' : p.status}
                      </div>
                    )}
                    <PostCard post={p} meEmail={email} busy={busyPostId === p.id}
                      onReact={onReact} onDelete={onDelete} onBlock={onBlock} onReport={onReport} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── PROFILE — existing Blockward profile ── */}
        {tab === 'profile' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-border surface-card p-6 text-center">
              <div className="mx-auto mb-3 w-fit">
                <InitialsAvatar name={profile ? `${profile.first_name || ''} ${profile.last_name || ''}` : email} src={profile?.avatar_url} size="lg" />
              </div>
              <h2 className="font-display text-xl font-bold text-foreground">
                {profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : 'Your profile'}
              </h2>
              {profile?.handle && <p className="text-sm text-primary">@{profile.handle}</p>}
              {profile?.bio && <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">{profile.bio}</p>}
              <div className="mt-5 flex flex-col items-center justify-center gap-2 sm:flex-row">
                {profile?.handle && (
                  <Button variant="outline" asChild>
                    <Link to={`/@${profile.handle}`} target="_blank" rel="noopener noreferrer">
                      <Globe className="h-4 w-4" /> View public profile
                    </Link>
                  </Button>
                )}
                <Button asChild>
                  <Link to="/Profile">Edit profile</Link>
                </Button>
              </div>
            </div>
            {myOrgs.length > 0 && (
              <div className="rounded-2xl border border-border surface-card p-6">
                <h3 className="card-title mb-3">Your organisations</h3>
                <div className="space-y-2">
                  {myOrgs.map((o) => (
                    <div key={o.org_id} className="flex items-center gap-2 rounded-lg border border-border p-3">
                      <Building2 className="h-4 w-4 text-primary" />
                      <span className="text-sm text-foreground">{o.org_name}</span>
                      <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[12px] text-primary">
                        <BadgeCheck className="h-3 w-3" /> Official issuer
                      </span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[12px] text-tertiary">
                  Manage your organisation in the{' '}
                  <Link to="/organisations/dashboard" className="text-primary hover:underline">organisation dashboard</Link>.
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      <PostComposer
        open={composerOpen}
        onOpenChange={setComposerOpen}
        profile={profile}
        meEmail={email}
        shareable={shareable}
        orgs={myOrgs}
        preselectedRef={preselectedRef}
        onPublished={load}
      />
    </div>
  );
}