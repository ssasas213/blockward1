import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import EmptyState from '@/components/ui/empty-state';
import GlowActionButton from '@/components/ui/GlowActionButton';
import { useSchool } from '@/lib/SchoolContext';
import { loadEarnedAchievements, invalidateAchievementCache } from '@/lib/achievementLifecycle';
import { hasVerifiedIntegrity, integrityCheckIsStale } from '@/lib/credentialIntegrity';
import {
  ensureDefaultCategories, loadCategories, loadMeta, assignCategories,
  setFeatured, setArchived, saveCardOrder,
} from '@/lib/achievementMeta';
import AchievementCard, { cardFromRequest, cardFromSelf, cardFromVault } from '@/components/achievements/AchievementCard';
import AchievementShareDialog from '@/components/publicProfile/AchievementShareDialog';
import EvidenceUpload from '@/components/evidence/EvidenceUpload';
import AchievementDetailDrawer from '@/components/achievements/AchievementDetailDrawer';
import AchievementGridSkeleton from '@/components/achievements/AchievementGridSkeleton';
import BlockWardDetailModal from '@/components/blockwards/BlockWardDetailModal';
import CredentialEditDialog from '@/components/achievements/edit/CredentialEditDialog';
import RequestForm from '@/components/achievements/RequestForm';
import PortfolioActions from '@/components/student/achievements/PortfolioActions';
import CelebrationDialog from '@/components/achievements/CelebrationDialog';
import HistoricalVaultCard from '@/components/historical/HistoricalVaultCard';
import CategoryManager from '@/components/achievements/unified/CategoryManager';
import UnifiedGrid from '@/components/achievements/unified/UnifiedGrid';
import { CategoryChip } from '@/components/achievements/unified/CategoryVisual';
import {
  Plus, Search, Building2, Loader2, FileText,
  ShieldCheck, Clock, UserPlus, Star, Archive, FolderKanban,
  LayoutGrid, List, X, History, CheckSquare, AtSign,
} from 'lucide-react';
import { format } from 'date-fns';
import { createPageUrl } from '@/utils';

const ACH_CATEGORIES = [
  ['certification', 'Certification'], ['competition', 'Competition'], ['academic', 'Academic'],
  ['professional', 'Professional'], ['course', 'Course'], ['training', 'Training'],
  ['award', 'Award'], ['challenge', 'Challenge'], ['other', 'Other'],
];

const EMPTY_FORM = {
  title: '', category: '', description: '', date: '', expires: '',
  issuer_org: '', issuer_org_id: '', issuer_status: '', issuer_email: '', issuer_website: '',
  certificate_url: '', certificate_name: '',
  evidence: [], linkUrl: '', linkName: '',
};

const TABS = ['all', 'pending', 'verified', 'archived'];

/**
 * MyAchievements — the ONE unified holder dashboard: achievements, credentials,
 * verification requests and archives in a single portfolio view. Merges the
 * former My Achievements (new organisation pipeline: Achievement →
 * VerificationRequest → Credential) and My BlockWards (legacy vault +
 * school requests + self-reported + historical) pages. No achievement is ever
 * duplicated for also having a credential — the credential rides on its
 * achievement's card.
 *
 * Personal categories / featured / card order / archived live in dedicated
 * metadata entities — they can never touch issuer-signed content, the
 * BW-HASH-V1 commitment or verification state.
 */
export default function MyAchievements() {
  const { user, profile, testMode } = useSchool();
  const email = testMode?.isTestSuperUser && testMode.effectiveEmail ? testMode.effectiveEmail : user?.email;

  // ── Data sources (null = loading) ──
  const [achievements, setAchievements] = useState(null); // new pipeline, joined
  const [vault, setVault] = useState(null);               // legacy delivered records
  const [reqsData, setReqsData] = useState(null);         // legacy school requests
  const [self, setSelf] = useState(null);                 // self-reported
  const [hist, setHist] = useState(null);                 // historical verifications
  const [metaReq, setMetaReq] = useState(null);           // orgs/templates/staff for RequestForm
  const [caps, setCaps] = useState(null);
  const [cats, setCats] = useState(null);                 // personal categories
  const [metas, setMetas] = useState(null);               // personal metadata

  // ── UI state ──
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const t = new URLSearchParams(window.location.search).get('tab');
      return TABS.includes(t) ? t : 'all';
    } catch { return 'all'; }
  });
  const [viewMode, setViewMode] = useState(() => {
    try { return localStorage.getItem('bw_ach_view') || 'grid'; } catch { return 'grid'; }
  });
  const [sort, setSort] = useState('order');
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [assignOpen, setAssignOpen] = useState(false);
  const [catsOpen, setCatsOpen] = useState(false);
  const [detail, setDetail] = useState(null);             // new-pipeline drawer
  const [selectedBlockWard, setSelectedBlockWard] = useState(null); // legacy vault modal
  const [editTarget, setEditTarget] = useState(null);     // request/self editor
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_FORM);
  const [savingNew, setSavingNew] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [issuerQuery, setIssuerQuery] = useState('');
  const [issuerResults, setIssuerResults] = useState(null);
  const [searchingIssuers, setSearchingIssuers] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState({ name: '', website: '', contact_email: '' });
  const [inviting, setInviting] = useState(false);
  const [requestFor, setRequestFor] = useState(null);
  const [requestEmail, setRequestEmail] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [retryingId, setRetryingId] = useState(null);
  const [shareTarget, setShareTarget] = useState(null);
  const [celebrateQueue, setCelebrateQueue] = useState([]);
  const [celebrating, setCelebrating] = useState(null);
  const [verifySelf, setVerifySelf] = useState(null);

  const setV = (k, v) => setAddForm((f) => ({ ...f, [k]: v }));

  // ── Load everything — one parallel batch, all owner-scoped by RLS ──
  const load = useCallback(async () => {
    if (!user) return;
    const [earned, reqRes, selfRes, histRes, achs, vreqs, creds] = await Promise.all([
      loadEarnedAchievements(),
      base44.functions.invoke('achievementRequestData', { mode: 'student' }).catch(() => null),
      base44.entities.SelfReportedAchievement.filter({ student_email: email }, '-created_date').catch(() => []),
      base44.entities.HistoricalAchievementRequest.filter({ student_email: email }, { sort: '-created_date', limit: 20 }).catch(() => ({ items: [] })),
      base44.entities.Achievement.filter({}, { sort: '-created_date', limit: 100 }).catch(() => ({ items: [] })),
      base44.entities.VerificationRequest.filter({}, { sort: '-created_date', limit: 100 }).catch(() => ({ items: [] })),
      base44.entities.Credential.filter({}, { limit: 100 }).catch(() => ({ items: [] })),
    ]);
    setVault(earned?.achievements || []);
    if (reqRes?.data?.ok) {
      setReqsData(reqRes.data.requests || []);
      setMetaReq({ orgs: reqRes.data.orgs, templates: reqRes.data.templates, staff: reqRes.data.staff });
      setCaps(reqRes.data.caps);
    } else { setReqsData([]); setMetaReq({ orgs: [], templates: [], staff: [] }); }
    setSelf(selfRes || []);
    setHist(histRes.items || []);

    const reqList = vreqs.items || vreqs || [];
    const credList = creds.items || creds || [];
    const reqByAch = new Map(reqList.map((r) => [r.achievement_id, r]));
    const credByAch = new Map(credList.map((c) => [c.achievement_id, c]));
    setAchievements(((achs.items || achs) || []).map((a) => ({
      ...a, request: reqByAch.get(a.id) || null, credential: credByAch.get(a.id) || null,
    })));

    // Categories — seed the starter set on first use.
    try {
      const existing = await loadCategories();
      const finalCats = await ensureDefaultCategories(existing);
      setCats(finalCats);
    } catch { setCats([]); }
    try { setMetas(await loadMeta()); } catch { setMetas([]); }
  }, [user, email]);

  useEffect(() => { load(); }, [load]);

  // ── Integrity freshness — verified credentials whose cached chain check is
  // stale (10-min TTL) get ONE silent refresh through publicVerifyData, which
  // re-verifies the anchor on-chain server-side and persists the result. A
  // fresh non-confirmed result is never re-verified (no loops). ──
  const refreshedRef = useRef(false);
  useEffect(() => {
    if (!achievements || refreshedRef.current) return;
    const stale = achievements.filter((a) => {
      const c = a.credential;
      return a.status === 'verified' && c?.bw_id && c?.anchor_status === 'confirmed'
        && !hasVerifiedIntegrity(c) && integrityCheckIsStale(c);
    }).slice(0, 6);
    refreshedRef.current = true;
    if (!stale.length) return;
    Promise.all(stale.map((a) => base44.functions.invoke('publicVerifyData', { bw_id: a.credential.bw_id }).catch(() => null)))
      .then((res) => { if (res.some(Boolean)) { invalidateAchievementCache(); load(); } });
  }, [achievements, load]);

  const setView = (m) => { setViewMode(m); try { localStorage.setItem('bw_ach_view', m); } catch { /* ignore */ } };

  // ── Unified item model ──
  const metaByRef = useMemo(() => new Map((metas || []).map((m) => [m.achievement_ref, m])), [metas]);

  const items = useMemo(() => {
    if (achievements === null || vault === null || self === null || reqsData === null) return null;
    const out = [];
    for (const a of achievements) {
      const c = a.credential;
      const integrity = c?.anchor_status === 'confirmed' && c?.bw_id
        ? (hasVerifiedIntegrity(c) ? 'confirmed'
          : (c.chain_check?.status && c.chain_check.status !== 'confirmed' && !integrityCheckIsStale(c)) ? 'failed' : 'stale')
        : null;
      out.push({
        kind: 'achievement', ref: `ach:${a.id}`, raw: a, integrity,
        card: {
          id: a.id,
          status: a.status === 'verified' ? 'verified' : a.status === 'revoked' ? 'revoked' : (a.status === 'rejected' ? 'unverified' : 'pending'),
          chain: c?.anchor_status === 'confirmed',
          title: a.title,
          cover: null,
          category: a.category || 'other',
          org: a.issuer_org || null,
          orgLogo: null,
          date: a.date_achieved || null,
          verification_id: c?.bw_id || null,
          raw: a,
        },
        date: a.date_achieved || a.created_date,
        title: a.title || '', description: a.description || '', org: a.issuer_org || '',
      });
    }
    for (const v of vault) {
      out.push({ kind: 'vault', ref: `vault:${v.record_id || v.id}`, raw: v, integrity: 'confirmed', card: cardFromVault(v), date: v.minted_at || v.created_date, title: v.title || '', description: v.description || '', org: v.organisation_name || '' });
    }
    const openReq = (r) => !['archived', 'minted', 'withdrawn', 'rejected', 'expired'].includes(r.status);
    for (const r of reqsData) {
      if (!openReq(r)) continue;
      out.push({ kind: 'request', ref: `req:${r.id}`, raw: r, integrity: null, card: cardFromRequest(r), date: r.submitted_at || r.created_date, title: r.title || '', description: '', org: r.school_name || '' });
    }
    for (const s of self) {
      if (s.status === 'verified' || s.verification_request_id) continue;
      out.push({ kind: 'self', ref: `self:${s.id}`, raw: s, integrity: null, card: cardFromSelf(s), date: s.date_achieved || s.created_date, title: s.title || '', description: s.description || '', org: s.organisation_name || '' });
    }
    return out;
  }, [achievements, vault, self, reqsData]);

  const tabOf = (it, m) => {
    if (m?.archived) return 'archived';
    if (it.kind === 'vault') return 'verified';
    if (it.kind === 'request' || it.kind === 'self') return 'pending';
    if (it.raw.status === 'verified' || it.raw.status === 'revoked') return 'verified';
    return 'pending';
  };

  const catById = useMemo(() => new Map((cats || []).map((c) => [c.id, c])), [cats]);

  const filtered = useMemo(() => {
    if (!items) return null;
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      const m = metaByRef.get(it.ref);
      if (activeTab !== 'all' && tabOf(it, m) !== activeTab) return false;
      if (activeTab === 'all' && m?.archived) return false;
      if (catFilter !== 'all') {
        const ids = (m?.category_ids || []).filter((id) => catById.has(id));
        if (catFilter === 'none') { if (ids.length > 0) return false; }
        else if (!ids.includes(catFilter)) return false;
      }
      if (q) {
        const catNames = (m?.category_ids || []).map((id) => catById.get(id)?.name || '').join(' ');
        const hay = `${it.title} ${it.description} ${it.org} ${catNames}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, activeTab, catFilter, search, metaByRef, catById]);

  const sorted = useMemo(() => {
    if (!filtered) return null;
    const arr = [...filtered];
    const orderOf = (it) => metaByRef.get(it.ref)?.card_order;
    if (sort === 'order') arr.sort((a, b) => ((orderOf(a) ?? Infinity) - (orderOf(b) ?? Infinity)) || (new Date(b.date || 0) - new Date(a.date || 0)));
    else if (sort === 'newest') arr.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    else if (sort === 'oldest') arr.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
    else if (sort === 'title') arr.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    else if (sort === 'issuer') arr.sort((a, b) => (a.org || '').localeCompare(b.org || ''));
    return arr;
  }, [filtered, sort, metaByRef]);

  const featuredItems = useMemo(() => {
    if (!items) return [];
    return items.filter((it) => {
      const m = metaByRef.get(it.ref);
      return m?.featured && !m?.archived;
    }).sort((a, b) => ((metaByRef.get(a.ref)?.card_order ?? Infinity) - (metaByRef.get(b.ref)?.card_order ?? Infinity)));
  }, [items, metaByRef]);

  const counts = useMemo(() => {
    if (!items) return null;
    let total = 0, verified = 0, pending = 0;
    for (const it of items) {
      const m = metaByRef.get(it.ref);
      if (m?.archived) continue;
      total += 1;
      const t = tabOf(it, m);
      if (t === 'verified') verified += 1;
      else if (t === 'pending') pending += 1;
    }
    return { total, verified, pending };
  }, [items, metaByRef]);

  // ── Interactions ──
  const openItem = (it) => {
    if (it.kind === 'achievement') setDetail(it.raw);
    else if (it.kind === 'vault') setSelectedBlockWard(it.raw);
    else if (it.kind === 'request') setEditTarget({ kind: 'request', data: it.raw });
    else if (it.kind === 'self') setEditTarget({ kind: 'self', data: it.raw });
  };

  const toggleSelect = (ref) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(ref)) next.delete(ref); else next.add(ref);
      return next;
    });
  };

  const refreshMetas = async () => { try { setMetas(await loadMeta()); } catch { /* ignore */ } };

  const handleBulkAssign = async (ids) => {
    try {
      await assignCategories(email, [...selected], ids);
      toast.success(ids.length ? 'Assigned to category' : 'Removed from categories');
      setAssignOpen(false);
      setSelected(new Set());
      await refreshMetas();
    } catch (e) { toast.error(e?.response?.data?.error || 'Could not assign'); }
  };
  const handleBulkFeature = async (on) => {
    try {
      await setFeatured(email, [...selected], on);
      toast.success(on ? 'Added to Featured' : 'Removed from Featured');
      setSelected(new Set());
      await refreshMetas();
    } catch (e) { toast.error('Could not update'); }
  };
  const handleBulkArchive = async (on) => {
    try {
      await setArchived(email, [...selected], on);
      toast.success(on ? 'Moved to Archived' : 'Restored');
      setSelected(new Set());
      await refreshMetas();
    } catch (e) { toast.error('Could not update'); }
  };
  const handleDragEnd = async (ordered) => {
    try { await saveCardOrder(email, ordered.map((it) => it.ref)); await refreshMetas(); } catch { /* ignore */ }
  };

  // ── New-pipeline achievement flow (createAchievement / requestOrgVerification) ──
  const runIssuerSearch = async (q) => {
    setIssuerQuery(q);
    if (!q || q.length < 2) { setIssuerResults(null); return; }
    setSearchingIssuers(true);
    try {
      const res = await base44.functions.invoke('searchIssuers', { q });
      setIssuerResults(res.data?.results || []);
    } catch { setIssuerResults([]); } finally { setSearchingIssuers(false); }
  };
  const pickIssuer = (o) => {
    setAddForm((f) => ({ ...f, issuer_org: o.name, issuer_org_id: o.id || '', issuer_status: o.status || 'pending', issuer_email: o.contact_email || '', issuer_website: o.website || '' }));
    setIssuerQuery(o.name);
    setIssuerResults(null);
  };
  const submitInvite = async () => {
    if (invite.name.trim().length < 2) { toast.error('Add the organisation name'); return; }
    if (!invite.contact_email.includes('@')) { toast.error('Add a valid contact email for the organisation'); return; }
    setInviting(true);
    try {
      const res = await base44.functions.invoke('searchIssuers', { action: 'suggest', ...invite });
      if (res.data?.ok) {
        toast.success(`Invitation emailed to ${invite.name} — you'll be able to request verification once they join.`);
        setInviteOpen(false);
        setV('issuer_org', invite.name.trim());
        setV('issuer_email', invite.contact_email.trim());
        setInvite({ name: '', website: '', contact_email: '' });
      } else { toast.error(res.data?.error || 'Could not send the invitation'); }
    } catch (e) { toast.error(e?.response?.data?.error || 'Could not send the invitation'); }
    finally { setInviting(false); }
  };
  const handleCreateNew = async () => {
    if (addForm.title.trim().length < 3) { toast.error('Add a title'); return; }
    if (!addForm.category) { toast.error('Pick a category'); return; }
    if (!addForm.date) { toast.error('Add the date achieved'); return; }
    if (addForm.issuer_org && !addForm.issuer_email) { toast.error('Add the issuer contact email so they can be asked to verify'); return; }
    if (!addForm.issuer_org) { toast.error('Connect the organisation that issued this achievement'); return; }
    setSavingNew(true);
    try {
      const res = await base44.functions.invoke('createAchievement', {
        title: addForm.title.trim(),
        category: addForm.category,
        description: addForm.description.trim(),
        date_achieved: addForm.date,
        expires_at: addForm.expires || null,
        issuer_org: addForm.issuer_org.trim(),
        issuer_email: addForm.issuer_email.trim(),
        issuer_website: addForm.issuer_website.trim() || null,
        certificate_url: addForm.certificate_url || null,
        certificate_name: addForm.certificate_name || null,
        evidence: addForm.evidence,
      });
      if (res.data?.ok) {
        toast.success('Achievement added — now request verification from the issuer');
        setAddOpen(false);
        setAddForm(EMPTY_FORM);
        setIssuerQuery(''); setIssuerResults(null);
        load();
      } else { toast.error(res.data?.error || 'Could not add the achievement'); }
    } catch (e) { toast.error(e?.response?.data?.error || 'Could not add the achievement'); }
    finally { setSavingNew(false); }
  };
  const openRequest = (a) => { setRequestFor(a); setRequestEmail(a.issuer_email || ''); };
  const submitRequest = async () => {
    if (!requestEmail.includes('@')) { toast.error('Add the issuer contact email'); return; }
    setRequesting(true);
    try {
      let orgId = requestFor.issuer_org_id || null;
      if (!orgId && requestFor.issuer_org) {
        try {
          const s = await base44.functions.invoke('searchIssuers', { q: requestFor.issuer_org });
          const match = (s.data?.results || []).find((o) => (o.name || '').toLowerCase() === (requestFor.issuer_org || '').toLowerCase());
          if (match) orgId = match.id;
        } catch { /* fall through to the token flow */ }
      }
      const res = orgId
        ? await base44.functions.invoke('requestOrgVerification', { achievement_id: requestFor.id, org_id: orgId })
        : await base44.functions.invoke('requestVerification', { achievement_id: requestFor.id, issuer_email: requestEmail.trim() });
      if (res.data?.ok) { toast.success('Verification request sent'); setRequestFor(null); load(); }
      else { toast.error(res.data?.error || 'Could not send the request'); }
    } catch (e) { toast.error(e?.response?.data?.error || 'Could not send the request'); }
    finally { setRequesting(false); }
  };
  // Public/private visibility — server-enforced (holder-only, audited).
  const [visibilityBusy, setVisibilityBusy] = useState(false);
  const handleVisibility = async (makePublic) => {
    if (!detail) return;
    setVisibilityBusy(true);
    try {
      const res = await base44.functions.invoke('achievementAction', {
        action: 'set_visibility', achievement_id: detail.id, is_public: makePublic,
      });
      if (!res.data?.ok) throw new Error(res.data?.error || 'Could not update visibility');
      toast.success(makePublic ? 'Now visible on your public profile' : 'Now private — hidden from public pages');
      load();
    } catch (e) { toast.error(e?.response?.data?.error || e.message); }
    finally { setVisibilityBusy(false); }
  };

  const retryAnchor = async (a) => {
    if (!a.credential?.id) return;
    setRetryingId(a.id);
    try {
      const res = await base44.functions.invoke('retryAnchor', { credential_id: a.credential.id });
      if (res.data?.ok) { toast.success('Retrying blockchain confirmation…'); load(); }
      else { toast.error(res.data?.error || 'Could not retry — please try again shortly'); }
    } catch (e) { toast.error(e?.response?.data?.error || 'Could not retry — please try again shortly'); }
    finally { setRetryingId(null); }
  };

  // ── Legacy school-request flow (RequestForm + achievementRequestAction) ──
  const handleSubmitLegacy = async (payload, { submit, resubmit }) => {
    setSaving(true);
    try {
      const action = submit ? (resubmit ? 'resubmit' : 'submit') : 'save_draft';
      const res = await base44.functions.invoke('achievementRequestAction', {
        action, form: payload, request_id: editing?.id || null,
      });
      if (!res.data?.ok) throw new Error(res.data?.error || 'Failed to save');
      if (verifySelf && submit) {
        const rid = res.data.request_id || res.data.request?.id || res.data.id || null;
        await base44.entities.SelfReportedAchievement.update(verifySelf.id, {
          status: 'verification_requested',
          verification_request_id: rid,
        }).catch(() => {});
        toast.success('Sent for verification — it stays marked unverified until approved');
        setVerifySelf(null);
      } else {
        toast.success(submit ? (resubmit ? 'Resubmitted for review' : 'Request submitted') : 'Draft saved');
      }
      setFormOpen(false);
      setEditing(null);
      load();
    } catch (e) { toast.error(e?.response?.data?.error || e.message); }
    finally { setSaving(false); }
  };
  const handleWithdraw = async (r) => {
    try {
      const res = await base44.functions.invoke('achievementRequestAction', { action: 'withdraw', request_id: r.id });
      if (!res.data?.ok) throw new Error(res.data?.error || 'Could not withdraw');
      toast.success('Request withdrawn');
      load();
    } catch (e) { toast.error(e?.response?.data?.error || e.message || 'Could not withdraw'); }
  };
  const handleRetryPublish = async (r) => {
    try {
      const res = await base44.functions.invoke('achievementRequestAction', { action: 'retry_mint', request_id: r.id });
      if (!res.data?.ok) throw new Error(res.data?.error || 'Could not publish');
      toast.success('Published to your profile');
      load();
    } catch (e) { toast.error(e?.response?.data?.error || e.message || 'Could not publish'); }
  };

  // "Get this verified" on unverified self cards — prefills the request form.
  const handleGetVerified = (card) => {
    const s = card.raw;
    if (!metaReq?.orgs?.length) {
      toast.error('Join an organisation first — verification needs someone to verify it');
      return;
    }
    setVerifySelf(s);
    setEditing({
      school_id: metaReq.orgs[0].id,
      title: s.title,
      description: s.description || '',
      image_url: s.image_url || '',
      date_achieved: s.date_achieved || '',
      evidence: s.evidence || [],
    });
    setFormOpen(true);
  };

  // ── Celebration — once per achievement, first time it appears verified ──
  useEffect(() => {
    if (!items || items.length === 0) return;
    try {
      const keys = items.filter((it) => it.card.status === 'verified').map((it) => it.card.verification_id || it.ref).filter(Boolean);
      if (localStorage.getItem('bw_celebrated') === null) {
        localStorage.setItem('bw_celebrated', JSON.stringify(keys));
        return;
      }
      const celebrated = JSON.parse(localStorage.getItem('bw_celebrated') || '[]');
      const fresh = items.filter((it) => it.card.status === 'verified' && it.card.verification_id && !celebrated.includes(it.card.verification_id));
      if (fresh.length) setCelebrateQueue(fresh.map((it) => it.card));
    } catch { /* never block the page */ }
  }, [items]);
  useEffect(() => {
    if (!celebrateQueue.length || celebrating) return;
    const [next, ...rest] = celebrateQueue;
    setCelebrateQueue(rest);
    setCelebrating(next);
    try {
      const celebrated = JSON.parse(localStorage.getItem('bw_celebrated') || '[]');
      localStorage.setItem('bw_celebrated', JSON.stringify([...celebrated, next.verification_id]));
    } catch { /* ignore */ }
  }, [celebrateQueue, celebrating]);

  const allLoaded = items !== null && cats !== null && metas !== null;
  const exportRecords = useMemo(() => ([
    ...(vault || []),
    ...(achievements || []).filter((a) => a.status === 'verified').map((a) => ({
      title: a.title, category: a.category, date_achieved: a.date_achieved,
      description: a.description, verify_id: a.credential?.bw_id || null,
      points: null, teacher_name: null, admin_name: null,
    })),
  ]), [vault, achievements]);

  const loadingAll = achievements === null || vault === null || self === null || reqsData === null;

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">My Achievements</h1>
          <p className="text-muted-foreground mt-1">
            Your complete achievement portfolio — verified credentials live on Polygon
          </p>
          {profile?.handle && (
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <button
                onClick={() => window.open(`${window.location.origin}/@${profile.handle}`, '_blank')}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
              >
                <AtSign className="h-3.5 w-3.5" /> {profile.handle}
              </button>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PortfolioActions records={exportRecords} profile={profile} user={user} />
          <Button variant="outline" onClick={() => setCatsOpen(true)}>
            <FolderKanban className="h-4 w-4 mr-2" /> Categories
          </Button>
          <GlowActionButton
            variant="secondary" size="md" icon={History}
            label="Add past achievement" to={createPageUrl('HistoricalAchievement')}
          />
          <GlowActionButton size="md" icon={Plus} label="Add achievement" onClick={() => { setAddForm(EMPTY_FORM); setAddOpen(true); }} />
        </div>
      </div>

      {/* ── Summary ── */}
      <div className="grid grid-cols-3 gap-3 max-w-xl">
        <div className="surface-card rounded-xl px-4 py-3">
          <p className="caption">Total</p>
          <p className="stat-value">{counts === null ? '…' : counts.total}</p>
        </div>
        <div className="surface-card rounded-xl px-4 py-3">
          <p className="caption">Blockward Verified</p>
          <p className="stat-value">{counts === null ? '…' : counts.verified}</p>
        </div>
        <div className="surface-card rounded-xl px-4 py-3">
          <p className="caption">Pending</p>
          <p className="stat-value">{counts === null ? '…' : counts.pending}</p>
        </div>
      </div>

      {/* ── Toolbar: tabs, search, category filter, sort, organise, view ── */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="pending">Pending{counts ? ` (${counts.pending})` : ''}</TabsTrigger>
              <TabsTrigger value="verified">Verified{counts ? ` (${counts.verified})` : ''}</TabsTrigger>
              <TabsTrigger value="archived">Archived</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex-1" />
          <Button
            variant={selectMode ? 'default' : 'outline'} size="sm"
            onClick={() => { setSelectMode(!selectMode); setSelected(new Set()); }}
          >
            <CheckSquare className="h-4 w-4 mr-1.5" /> {selectMode ? 'Done' : 'Select'}
          </Button>
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
            <button onClick={() => setView('grid')} aria-label="Grid view" title="Grid view"
              className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors ${viewMode === 'grid' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-hover hover:text-foreground'}`}>
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button onClick={() => setView('list')} aria-label="List view" title="Compact list view"
              className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors ${viewMode === 'list' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-hover hover:text-foreground'}`}>
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-tertiary pointer-events-none" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search titles, descriptions, categories, issuers…" className="pl-9" />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-tertiary hover:text-foreground" aria-label="Clear search"><X className="h-3.5 w-3.5" /></button>
            )}
          </div>
          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              <SelectItem value="none">Uncategorised</SelectItem>
              {(cats || []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="order">My order</SelectItem>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
              <SelectItem value="title">Alphabetical</SelectItem>
              <SelectItem value="issuer">Issuer</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Content ── */}
      {!allLoaded ? (
        <AchievementGridSkeleton />
      ) : (
        <>
          {/* Featured section — All tab, top */}
          {activeTab === 'all' && featuredItems.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Star className="h-4 w-4 text-warning" />
                <h3 className="section-heading">Featured</h3>
                <span className="caption">Your most important achievements for applications and CVs</span>
              </div>
              <UnifiedGrid
                items={featuredItems}
                viewMode={viewMode}
                selectMode={selectMode}
                selectedRefs={selected}
                onToggleSelect={toggleSelect}
                onOpen={openItem}
                onShare={setShareTarget}
                onGetVerified={handleGetVerified}
                onEdit={(card) => setEditTarget({ kind: 'self', data: card?.raw || card })}
              />
            </section>
          )}

          {/* Main list for the active tab */}
          {activeTab === 'all' ? (
            <UnifiedGrid
              items={sorted || []}
              viewMode={viewMode}
              loading={loadingAll}
              dndEnabled={viewMode === 'grid' && !selectMode && (sorted || []).length > 1}
              onDragEnd={handleDragEnd}
              selectMode={selectMode}
              selectedRefs={selected}
              onToggleSelect={toggleSelect}
              onOpen={openItem}
              onShare={setShareTarget}
              onGetVerified={handleGetVerified}
              onEdit={(card) => setEditTarget({ kind: 'self', data: card?.raw || card })}
              emptyTitle="No achievements here yet"
              emptyDescription="Add your first achievement — certificates, competition results, courses, awards — and connect the issuing organisation to get it Blockward Verified."
              emptyAction={<GlowActionButton size="md" icon={Plus} label="Add achievement" onClick={() => { setAddForm(EMPTY_FORM); setAddOpen(true); }} />}
            />
          ) : (
            <div className="space-y-6">
              <UnifiedGrid
                items={sorted || []}
                viewMode={viewMode}
                selectMode={selectMode}
                selectedRefs={selected}
                onToggleSelect={toggleSelect}
                onOpen={openItem}
                onShare={setShareTarget}
                onGetVerified={handleGetVerified}
                onEdit={(card) => setEditTarget({ kind: 'self', data: card?.raw || card })}
                emptyTitle={
                  activeTab === 'pending' ? 'Nothing awaiting verification'
                    : activeTab === 'verified' ? 'No verified achievements yet'
                    : 'Nothing archived'
                }
                emptyDescription={
                  activeTab === 'pending' ? 'Achievements you add or request appear here while the issuer reviews them.'
                    : activeTab === 'verified' ? 'Once an issuer confirms an achievement and it anchors on Polygon, it appears here as Blockward Verified.'
                    : 'Select achievements and choose Archive to tuck them away without deleting anything.'
                }
                emptyAction={
                  activeTab === 'pending' || activeTab === 'verified'
                    ? <GlowActionButton size="md" icon={Plus} label="Add achievement" onClick={() => { setAddForm(EMPTY_FORM); setAddOpen(true); }} />
                    : null
                }
              />

              {/* Past-achievement verifications — two-stage flow, Pending tab */}
              {activeTab === 'pending' && hist && hist.length > 0 && (
                <div className="space-y-3">
                  <h3 className="section-heading">Past achievement verifications</h3>
                  {hist.map((h) => <HistoricalVaultCard key={h.id} req={h} onUpdated={load} />)}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Selection bar ── */}
      {selectMode && selected.size > 0 && (
        <div className="fixed inset-x-4 bottom-4 z-40 lg:left-72">
          <div className="glass rounded-xl border border-border px-4 py-3 flex flex-wrap items-center gap-2 shadow-2xl">
            <span className="text-sm font-medium text-foreground mr-2">{selected.size} selected</span>
            <Button size="sm" onClick={() => setAssignOpen(true)}><FolderKanban className="h-4 w-4 mr-1.5" /> Assign category</Button>
            <Button size="sm" variant="outline" onClick={() => handleBulkFeature(true)}><Star className="h-4 w-4 mr-1.5" /> Feature</Button>
            <Button size="sm" variant="outline" onClick={() => handleBulkFeature(false)}>Unfeature</Button>
            <Button size="sm" variant="outline" onClick={() => handleBulkArchive(true)}><Archive className="h-4 w-4 mr-1.5" /> Archive</Button>
            <Button size="sm" variant="outline" onClick={() => handleBulkArchive(false)}>Restore</Button>
            <div className="flex-1" />
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
          </div>
        </div>
      )}

      {/* ── Bulk assign dialog ── */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign to categories</DialogTitle>
            <DialogDescription>Personal organisation only — never affects verification.</DialogDescription>
          </DialogHeader>
          <BulkAssignPicker
            cats={cats || []}
            initial={(metas || []).filter((m) => selected.has(m.achievement_ref) && m.category_ids?.length).map((m) => m.category_ids)}
            onConfirm={handleBulkAssign}
            busy={false}
          />
        </DialogContent>
      </Dialog>

      {/* ── Category manager ── */}
      <CategoryManager
        open={catsOpen}
        onOpenChange={setCatsOpen}
        email={email}
        cats={cats || []}
        onChanged={async () => { try { setCats(await loadCategories()); } catch { /* ignore */ } }}
      />

      {/* ── Detail surfaces (one per record kind — all pre-existing) ── */}
      <AchievementDetailDrawer
        item={detail}
        open={!!detail}
        onOpenChange={(v) => !v && setDetail(null)}
        onResend={openRequest}
        onRetry={retryAnchor}
        retrying={retryingId}
        onVisibility={handleVisibility}
        visibilityBusy={visibilityBusy}
      />
      <BlockWardDetailModal
        blockWard={selectedBlockWard}
        open={!!selectedBlockWard}
        onClose={() => setSelectedBlockWard(null)}
      />
      <CredentialEditDialog
        target={editTarget}
        open={!!editTarget}
        onOpenChange={(o) => { if (!o) setEditTarget(null); }}
        onDone={load}
      />

      {/* ── Add achievement (new pipeline) ── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add an achievement</DialogTitle>
            <DialogDescription>
              Achievements always start unverified — verification comes from the issuing organisation.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Achievement title</Label>
              <Input value={addForm.title} onChange={(e) => setV('title', e.target.value)} placeholder="e.g. AWS Certified Solutions Architect" />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={addForm.category} onValueChange={(v) => setV('category', v)}>
                <SelectTrigger><SelectValue placeholder="Pick a category" /></SelectTrigger>
                <SelectContent>
                  {ACH_CATEGORIES.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Date achieved</Label>
              <Input type="date" value={addForm.date} onChange={(e) => setV('date', e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Expiry date <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input type="date" value={addForm.expires} onChange={(e) => setV('expires', e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>What is it?</Label>
              <Textarea value={addForm.description} onChange={(e) => setV('description', e.target.value)} rows={3} placeholder="What you did, where and when" />
            </div>

            <div className="sm:col-span-2 space-y-2 rounded-lg border border-border bg-secondary/30 p-3">
              <Label className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 text-primary" /> Issuing organisation</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-tertiary" />
                <Input value={issuerQuery} onChange={(e) => runIssuerSearch(e.target.value)} placeholder="Search organisations…" className="pl-9" />
                {searchingIssuers && <Loader2 className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-tertiary" />}
              </div>
              {issuerResults !== null && issuerResults.length > 0 && (
                <div className="rounded-lg border border-border divide-y divide-border max-h-44 overflow-y-auto">
                  {issuerResults.map((o) => (
                    <button key={o.id} type="button" onClick={() => pickIssuer(o)} className="w-full text-left px-3 py-2 hover:bg-hover flex items-center justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block text-sm text-foreground truncate">{o.name}</span>
                        <span className="block text-xs text-tertiary capitalize truncate">{(o.org_type || 'other').replace(/_/g, ' ')}</span>
                      </span>
                      {o.status === 'verified' ? (
                        <span className="text-xs text-success flex items-center gap-1 flex-shrink-0"><ShieldCheck className="h-3 w-3" /> Verified Issuer</span>
                      ) : (
                        <span className="text-xs text-warning flex items-center gap-1 flex-shrink-0"><Clock className="h-3 w-3" /> Registered — Verification Pending</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {issuerResults !== null && issuerResults.length === 0 && !searchingIssuers && (
                <button type="button" onClick={() => setInviteOpen(true)} className="text-sm text-primary hover:underline flex items-center gap-1.5">
                  <UserPlus className="h-3.5 w-3.5" /> Can't find your issuer? Invite the organisation
                </button>
              )}
              {addForm.issuer_org && (
                <p className="text-xs text-muted-foreground">
                  Selected: <span className="text-foreground font-medium">{addForm.issuer_org}</span>
                  {addForm.issuer_email ? ` · ${addForm.issuer_email}` : ''}
                </p>
              )}
            </div>

            <div className="sm:col-span-2 space-y-2">
              <Label className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-primary" /> Supporting evidence</Label>
              <p className="text-xs text-muted-foreground -mt-1">
                Upload proof of your achievement. The issuing organisation's verifier inspects it before signing.
              </p>
              <EvidenceUploadField value={addForm.evidence} onChange={(v) => setV('evidence', v)} onBusyChange={setUploading} />
            </div>
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={savingNew}>Cancel</Button>
            <Button onClick={handleCreateNew} disabled={savingNew || uploading}>
              {savingNew && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Add achievement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Invite organisation ── */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invite your issuer</DialogTitle>
            <DialogDescription>
              We'll email the organisation an invitation to join Blockward. Once they register and are
              verified, you can request verification from them.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Organisation name</Label>
              <Input value={invite.name} onChange={(e) => setInvite({ ...invite, name: e.target.value })} placeholder="e.g. Emirates Robotics Society" /></div>
            <div className="space-y-1.5"><Label>Website <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input value={invite.website} onChange={(e) => setInvite({ ...invite, website: e.target.value })} placeholder="https://…" /></div>
            <div className="space-y-1.5"><Label>Organisation contact email</Label>
              <Input type="email" value={invite.contact_email} onChange={(e) => setInvite({ ...invite, contact_email: e.target.value })} placeholder="info@organisation.com" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)} disabled={inviting}>Cancel</Button>
            <Button onClick={submitInvite} disabled={inviting}>
              {inviting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Invite Organisation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Request verification ── */}
      <Dialog open={!!requestFor} onOpenChange={(v) => !v && setRequestFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request verification</DialogTitle>
            <DialogDescription>
              The issuer organisation receives a secure verification link. They confirm the achievement,
              their verifier signs it, and Blockward secures it on Polygon.
            </DialogDescription>
          </DialogHeader>
          {requestFor && (
            <div className="space-y-3">
              <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm">
                <p className="font-medium text-foreground">{requestFor.title}</p>
                <p className="text-xs text-tertiary mt-0.5">{requestFor.issuer_org}</p>
              </div>
              <div className="space-y-1.5">
                <Label>Issuer contact email</Label>
                <Input type="email" value={requestEmail} onChange={(e) => setRequestEmail(e.target.value)} placeholder="verifier@organisation.com" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestFor(null)} disabled={requesting}>Cancel</Button>
            <Button onClick={submitRequest} disabled={requesting}>
              {requesting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Send request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── School achievement request (legacy flow, unchanged) ── */}
      <RequestForm
        open={formOpen}
        onOpenChange={(o) => { setFormOpen(o); if (!o) { setEditing(null); setVerifySelf(null); } }}
        meta={metaReq}
        initial={editing}
        onSubmit={handleSubmitLegacy}
        saving={saving}
      />

      {/* ── Celebration ── */}
      <CelebrationDialog
        item={celebrating}
        onDismiss={() => setCelebrating(null)}
        onShare={(card) => { setCelebrating(null); setShareTarget(card); }}
      />
      <AchievementShareDialog open={!!shareTarget} onOpenChange={(o) => { if (!o) setShareTarget(null); }} achievement={shareTarget ? { verification_id: shareTarget.verification_id, title: shareTarget.title } : null} />
    </div>
  );
}

/** Bulk category picker used by the selection bar's assign dialog. */
function BulkAssignPicker({ cats, initial, onConfirm }) {
  const [picked, setPicked] = useState(() => {
    // Start from categories common to every selected achievement.
    if (!initial || !initial.length) return new Set();
    return new Set(initial.reduce((acc, ids) => acc.filter((x) => ids.includes(x)), initial[0] || []));
  });
  const toggle = (id) => setPicked((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  return (
    <>
      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        {cats.map((c) => <CategoryPickRow key={c.id} cat={c} checked={picked.has(c.id)} onToggle={() => toggle(c.id)} />)}
        {cats.length === 0 && <p className="text-sm text-muted-foreground">No categories yet — create some first.</p>}
      </div>
      <DialogFooter>
        <Button onClick={() => onConfirm([...picked])}>Save</Button>
      </DialogFooter>
    </>
  );
}

function CategoryPickRow({ cat, checked, onToggle }) {
  return (
    <button type="button" onClick={onToggle} className="w-full flex items-center gap-2.5 rounded-lg border border-border px-3 py-2 hover:bg-hover text-left">
      <span className={`h-4 w-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${checked ? 'bg-primary border-primary text-primary-foreground' : 'border-border-strong'}`}>
        {checked && <span className="text-[10px] font-bold">✓</span>}
      </span>
      <CategoryChip cat={cat} />
    </button>
  );
}

function EvidenceUploadField(props) { return <EvidenceUpload {...props} helpText="PDF, PNG, JPG or WEBP · up to 5 files · 10 MB each · stored privately" />; }