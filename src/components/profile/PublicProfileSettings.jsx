import React, { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Globe2, Link2, Loader2, Save, AtSign, Check, X, ExternalLink, Lock, Palette, GraduationCap,
} from 'lucide-react';
import ProfileCustomizer from '@/components/profile/ProfileCustomizer';
import ProfilePreview from '@/components/publicProfile/ProfilePreview';
import { DEFAULT_PROFILE_CUSTOM, DEFAULT_SECTION_ORDER } from '@/lib/profileThemes';

const HANDLE_RE = /^[a-z0-9_]{3,20}$/;
const MAX_BIO = 200;
const VISIBILITIES = [
  { key: 'public', Icon: Globe2, label: 'Public', desc: 'Anyone with the link can see it. Previews as a rich card when shared.' },
  { key: 'link_only', Icon: Link2, label: 'Link only', desc: 'Only people you give the link to can see it. Hidden from search engines.' },
  { key: 'private', Icon: Lock, label: 'Private', desc: 'Nobody can see your profile, even with the link.' },
];
const ACH_VIS_LABELS = { public: 'Public', link_only: 'Link only', private: 'Hidden' };

const DEFAULT_CUSTOM = DEFAULT_PROFILE_CUSTOM;

export default function PublicProfileSettings({ profile, onSaved }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [handleInput, setHandleInput] = useState('');
  const [originalHandle, setOriginalHandle] = useState(null);
  const [bio, setBio] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [publicGrades, setPublicGrades] = useState(false);
  const [cooldownDays, setCooldownDays] = useState(0);
  const [achievements, setAchievements] = useState([]);
  const [custom, setCustom] = useState(DEFAULT_CUSTOM);
  // Snapshot of what was last saved — powers the unsaved-changes bar so a
  // user can always see (and reach) the Save action after editing.
  const [savedCustom, setSavedCustom] = useState(DEFAULT_CUSTOM);
  const [availability, setAvailability] = useState({ state: 'idle', reason: null }); // idle | checking | ok | taken | invalid
  const checkTimer = useRef(null);

  useEffect(() => {
    load();
    return () => { if (checkTimer.current) clearTimeout(checkTimer.current); };
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('updatePublicProfile', { get_my: true });
      const p = res.data?.profile || {};
      setOriginalHandle(p.handle);
      setHandleInput(p.handle || '');
      setBio(p.bio || '');
      setVisibility(p.profile_visibility || 'public');
      setPublicGrades(p.public_grades === true);
      setCooldownDays(p.cooldown_days_remaining || 0);
      setAchievements(res.data?.achievements || []);
      const nextCustom = {
        banner_url: p.banner_url || null,
        theme_id: p.theme_id || 'slate',
        accent_colour: p.accent_colour || null,
        accent_gradient: p.accent_gradient || null,
        profile_layout: p.profile_layout || 'grid',
        display_font: p.display_font || 'sans',
        social_links: Array.isArray(p.social_links) ? p.social_links : [],
        featured_link: p.featured_link || null,
        avatar_frame: p.avatar_frame || 'none',
        card_style: p.card_style || 'elevated',
        corner_style: p.corner_style || 'rounded',
        surface_pattern: p.surface_pattern || 'none',
        hero_style: p.hero_style || 'banner',
        card_density: p.card_density || 'comfortable',
        highlight_style: p.highlight_style || 'carousel',
        forced_scheme: p.forced_scheme || 'auto',
        tagline: p.tagline || null,
        pronouns: p.pronouns || null,
        languages: Array.isArray(p.languages) ? p.languages : [],
        open_to: Array.isArray(p.open_to) ? p.open_to : [],
        custom_links: Array.isArray(p.custom_links) ? p.custom_links : [],
        section_order: Array.isArray(p.section_order) && p.section_order.length === DEFAULT_SECTION_ORDER.length
          ? p.section_order
          : DEFAULT_SECTION_ORDER,
        section_visibility: p.section_visibility || DEFAULT_PROFILE_CUSTOM.section_visibility,
      };
      setCustom(nextCustom);
      setSavedCustom(nextCustom);
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed to load profile settings');
    } finally {
      setLoading(false);
    }
  };

  // Live handle availability — debounced, only for new/changed handles.
  useEffect(() => {
    const h = handleInput.trim().toLowerCase();
    if (!h || h === originalHandle) { setAvailability({ state: 'idle', reason: null }); return; }
    if (!HANDLE_RE.test(h)) { setAvailability({ state: 'invalid', reason: '3–20 characters, lowercase letters, numbers and underscores' }); return; }
    setAvailability({ state: 'checking', reason: null });
    if (checkTimer.current) clearTimeout(checkTimer.current);
    checkTimer.current = setTimeout(async () => {
      try {
        const res = await base44.functions.invoke('checkHandleAvailability', { handle: h });
        const d = res.data || {};
        setAvailability(d.available ? { state: 'ok', reason: null } : { state: 'taken', reason: d.reason || 'That handle is already taken' });
      } catch {
        setAvailability({ state: 'idle', reason: null });
      }
    }, 500);
  }, [handleInput, originalHandle]);

  const canChangeHandle = !originalHandle || cooldownDays === 0;
  const handleDirty = handleInput.trim().toLowerCase() !== (originalHandle || '');
  const handleBlocked = handleDirty && (!canChangeHandle || ['taken', 'invalid', 'checking'].includes(availability.state));
  const customDirty = JSON.stringify(custom) !== JSON.stringify(savedCustom);

  const setAchievementVisibility = async (registryId, vis) => {
    const prev = achievements;
    setAchievements((list) => list.map((a) => (a.registry_id === registryId ? { ...a, visibility: vis } : a)));
    try {
      await base44.functions.invoke('updatePublicProfile', { achievement_visibility: { registry_id: registryId, visibility: vis } });
      toast.success('Achievement visibility updated');
    } catch (e) {
      setAchievements(prev);
      toast.error(e?.response?.data?.error || 'Could not update visibility');
    }
  };

  const save = async () => {
    if (handleBlocked) { toast.error(availability.reason || 'Fix your handle first'); return; }
    setSaving(true);
    try {
      const payload = { bio, profile_visibility: visibility, public_grades: publicGrades, ...custom };
      if (handleDirty) payload.handle = handleInput.trim().toLowerCase();

      const res = await base44.functions.invoke('updatePublicProfile', payload);
      if (!res.data?.ok) throw new Error(res.data?.error || 'Failed to save');
      const p = res.data?.profile || {};
      setOriginalHandle(p.handle);
      setCooldownDays(p.cooldown_days_remaining || 0);
      // Merge the server response into the user's current selections instead
      // of replacing them — a missing field keeps what's on screen, and a
      // default is only applied where the server explicitly returns null.
      setCustom((prev) => {
        const merged = {
          ...prev,
          banner_url: p.banner_url === null ? null : p.banner_url ?? prev.banner_url,
          theme_id: p.theme_id ?? prev.theme_id,
          accent_colour: p.accent_colour === null ? null : p.accent_colour ?? prev.accent_colour,
          accent_gradient: p.accent_gradient === null ? null : p.accent_gradient ?? prev.accent_gradient,
          profile_layout: p.profile_layout ?? prev.profile_layout,
          display_font: p.display_font ?? prev.display_font,
          social_links: Array.isArray(p.social_links) ? p.social_links : prev.social_links,
          featured_link: p.featured_link === null ? null : p.featured_link ?? prev.featured_link,
          avatar_frame: p.avatar_frame ?? prev.avatar_frame,
          card_style: p.card_style ?? prev.card_style,
          corner_style: p.corner_style ?? prev.corner_style,
          surface_pattern: p.surface_pattern ?? prev.surface_pattern,
          hero_style: p.hero_style ?? prev.hero_style,
          card_density: p.card_density ?? prev.card_density,
          highlight_style: p.highlight_style ?? prev.highlight_style,
          forced_scheme: p.forced_scheme ?? prev.forced_scheme,
          tagline: p.tagline === null ? null : p.tagline ?? prev.tagline,
          pronouns: p.pronouns === null ? null : p.pronouns ?? prev.pronouns,
          languages: Array.isArray(p.languages) ? p.languages : prev.languages,
          open_to: Array.isArray(p.open_to) ? p.open_to : prev.open_to,
          custom_links: Array.isArray(p.custom_links) ? p.custom_links : prev.custom_links,
          section_order: Array.isArray(p.section_order) && p.section_order.length === DEFAULT_SECTION_ORDER.length
            ? p.section_order
            : prev.section_order,
          section_visibility: p.section_visibility ? p.section_visibility : prev.section_visibility,
        };
        setSavedCustom(merged);
        return merged;
      });
      // Regenerate the server-rendered share/OG card so link previews match
      // the saved profile (cached server-side — re-renders only on change).
      const savedHandle = res.data?.profile?.handle;
      if (savedHandle) {
        base44.functions.invoke('generateProfileCard', { variant: 'og', handle: savedHandle }).catch(() => {});
      }
      toast.success('Public profile saved');
      if (onSaved) onSaved();
    } catch (e) {
      toast.error(e?.response?.data?.error || e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-border bg-card shadow-sm">
        <CardContent className="py-10 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const nextChangeDate = cooldownDays > 0
    ? new Date(Date.now() + cooldownDays * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
    : null;

  return (
    <>
      <Card className="border-border bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-foreground">
            <AtSign className="h-4 w-4 text-primary" /> Public profile
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Your shareable profile page at <span className="text-primary font-medium">/@{originalHandle || 'handle'}</span>
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {originalHandle && (
            <Button
              variant="outline" size="sm"
              onClick={() => window.open(`${window.location.origin}/@${originalHandle}`, '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" /> View my public profile
            </Button>
          )}

          {/* Handle */}
          <div className="space-y-2">
            <Label>Your handle</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
              <Input
                value={handleInput}
                onChange={(e) => setHandleInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                maxLength={20}
                className="pl-8"
                placeholder="maya_okonkwo"
                disabled={!canChangeHandle}
              />
              {handleInput && handleInput !== originalHandle && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                  {availability.state === 'ok' && <Check className="h-4 w-4 text-success" />}
                  {availability.state === 'checking' && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  {['taken', 'invalid'].includes(availability.state) && <X className="h-4 w-4 text-destructive" />}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              3–20 characters — lowercase letters, numbers and underscores. This is your permanent public link.
              {availability.reason && <span className="text-destructive"> {availability.reason}</span>}
            </p>
            {!canChangeHandle && nextChangeDate && (
              <p className="text-xs text-warning">Handles can be changed once every 30 days — yours unlocks on {nextChangeDate}.</p>
            )}
          </div>

          {/* Bio — 200 chars, line breaks allowed */}
          <div className="space-y-2">
            <Label>Bio</Label>
            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, MAX_BIO))}
              maxLength={MAX_BIO}
              rows={3}
              placeholder={'Sprinter · violinist · student council president\nAnything you achieve, we can verify.'}
            />
            <p className="text-xs text-muted-foreground text-right">{bio.length}/{MAX_BIO}</p>
          </div>

          {/* Global visibility */}
          <div className="space-y-2">
            <Label>Who can see your profile</Label>
            <div className="grid gap-2">
              {VISIBILITIES.map(({ key, Icon, label, desc }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setVisibility(key)}
                  className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${visibility === key ? 'border-primary/50 bg-primary/10' : 'border-border bg-background hover:bg-hover'}`}
                >
                  <Icon className={`h-4 w-4 mt-0.5 ${visibility === key ? 'text-primary' : 'text-muted-foreground'}`} />
                  <div>
                    <p className="text-sm font-medium text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Public grades — explicit opt-in, private by default */}
          <div className="space-y-2">
            <Label>Show published grades publicly</Label>
            <button
              type="button"
              onClick={() => setPublicGrades(!publicGrades)}
              className={`w-full flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${publicGrades ? 'border-primary/50 bg-primary/10' : 'border-border bg-background hover:bg-hover'}`}
            >
              <GraduationCap className={`h-4 w-4 mt-0.5 ${publicGrades ? 'text-primary' : 'text-muted-foreground'}`} />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{publicGrades ? 'On — my latest published grade per subject is public' : 'Off — grades stay private'}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Only the subject, final grade, percentage and term are ever shown — never teacher comments or marks detail. Save to apply.
                </p>
              </div>
              <span className={`h-5 w-5 rounded-full border flex-shrink-0 flex items-center justify-center ${publicGrades ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground'}`}>
                {publicGrades && <Check className="h-3 w-3" />}
              </span>
            </button>
          </div>

          {/* Per-achievement visibility */}
          {achievements.length > 0 && (
            <div className="space-y-2">
              <Label>Achievement visibility</Label>
              <div className="space-y-2">
                {achievements.map((a) => (
                  <div key={a.registry_id} className="flex items-center gap-3 rounded-lg border border-border bg-background p-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{a.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{a.organisation_name}</p>
                    </div>
                    <div className="flex gap-1.5">
                      {Object.entries(ACH_VIS_LABELS).map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setAchievementVisibility(a.registry_id, key)}
                          className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                            (a.visibility || 'public') === key
                              ? 'border-primary/50 bg-primary/15 text-primary'
                              : 'border-border text-muted-foreground hover:bg-hover'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                <Badge variant="info" className="mr-1.5">Public</Badge>
                shown to everyone ·
                <Badge variant="secondary" className="mx-1.5">Link only</Badge>
                link holders ·
                <Badge variant="destructive" className="mx-1.5">Hidden</Badge>
                never shown
              </p>
            </div>
          )}

          <Button onClick={save} disabled={saving || handleBlocked}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            {saving ? 'Saving…' : 'Save public profile'}
          </Button>
        </CardContent>
      </Card>

      {/* ── Customisation with live preview ── */}
      <Card className="border-border bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-foreground">
            <Palette className="h-4 w-4 text-primary" /> Customise your profile
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Choose from designed presets — banner, theme, layout, fonts and links. The preview updates as you go.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
            <ProfileCustomizer value={custom} onChange={(patch) => setCustom((prev) => ({ ...prev, ...patch }))} />
            <div className="lg:sticky lg:top-20 h-fit">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Live preview</p>
              <ProfilePreview
                name={profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : ''}
                handle={handleInput || originalHandle || 'handle'}
                bio={bio}
                avatarUrl={profile?.avatar_url || null}
                value={custom}
                achievements={achievements}
              />
            </div>
          </div>

          {/* Unsaved-changes bar — the Save action travels with the dirty
              state, so it's always reachable right after editing */}
          {customDirty ? (
            <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3">
              <p className="text-sm font-medium text-foreground">You have unsaved changes</p>
              <Button onClick={save} disabled={saving || handleBlocked}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                {saving ? 'Saving…' : 'Save customisation'}
              </Button>
            </div>
          ) : (
            <p className="mt-6 text-xs text-muted-foreground flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-success" /> All changes saved
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}