import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Plus, Share2, AtSign } from 'lucide-react';
import { useSchool } from '@/lib/SchoolContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import RoleGuard from '@/components/auth/RoleGuard';
import { loadEarnedAchievements } from '@/lib/achievementLifecycle';
import RequestForm from '@/components/achievements/RequestForm';
import PortfolioActions from '@/components/student/achievements/PortfolioActions';
import AllTab from '@/components/student/achievements/AllTab';
import VerifiedTab from '@/components/student/achievements/VerifiedTab';
import PendingTab from '@/components/student/achievements/PendingTab';
import UnverifiedTab from '@/components/student/achievements/UnverifiedTab';
import BlockWardDetailModal from '@/components/blockwards/BlockWardDetailModal';
import ProfileShareDialog from '@/components/profile/ProfileShareDialog';
import AchievementShareDialog from '@/components/publicProfile/AchievementShareDialog';
import CelebrationDialog from '@/components/achievements/CelebrationDialog';
import { cardFromVault } from '@/components/achievements/AchievementCard';
import { LayoutGrid, List } from 'lucide-react';

/**
 * My BlockWards — the one merged student achievement page (formerly
 * StudentBlockWards, StudentMyRecords, StudentPortfolioVault and
 * AchievementRequests). Tabs: All / Verified / Pending / Unverified.
 * Earned achievements load through loadEarnedAchievements() — the single
 * loader mandated by ACHIEVEMENT_ARCHITECTURE.md, with a 60s TTL cache so
 * navigation here from the dashboard renders instantly.
 *
 * Identity comes from SchoolContext. Each section keeps its own loading state
 * (null = loading) — the header and tabs render immediately and every grid
 * shows 4:3 skeleton cards until its data lands. No global spinner.
 */
export default function StudentBlockWards() { return <RoleGuard roles={['student']}><StudentBlockWardsImpl /></RoleGuard>; }
function StudentBlockWardsImpl() {
  return (
    <ProtectedRoute>
      <StudentBlockWardsContent />
    </ProtectedRoute>
  );
}

function StudentBlockWardsContent() {
  const { user, profile, testMode } = useSchool();
  const [verified, setVerified] = useState(null);
  const [requests, setRequests] = useState(null);
  const [meta, setMeta] = useState(null);
  const [caps, setCaps] = useState(null);
  const [selfReported, setSelfReported] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const [selectedBlockWard, setSelectedBlockWard] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [viewMode, setViewMode] = useState(() => {
    try { return localStorage.getItem('bw_view_mode') || 'grid'; } catch { return 'grid'; }
  });
  const [shareTarget, setShareTarget] = useState(null);
  const [celebrateQueue, setCelebrateQueue] = useState([]);
  const [celebrating, setCelebrating] = useState(null);
  const [verifySelf, setVerifySelf] = useState(null);

  const load = useCallback(async () => {
    if (!user) return;
    const email = testMode?.isTestSuperUser && testMode.effectiveEmail ? testMode.effectiveEmail : user.email;
    // All three loads are independent — one parallel batch. Achievements come
    // from the shared TTL cache (instant on repeat navigation, background
    // revalidate when stale).
    const [earned, reqRes, selfRes] = await Promise.all([
      loadEarnedAchievements(),
      base44.functions.invoke('achievementRequestData', { mode: 'student' }).catch(() => null),
      base44.entities.SelfReportedAchievement.filter({ student_email: email }, '-created_date').catch(() => []),
    ]);
    setVerified(earned.achievements || []);
    if (reqRes?.data?.ok) {
      setRequests(reqRes.data.requests || []);
      setMeta({ orgs: reqRes.data.orgs, templates: reqRes.data.templates, staff: reqRes.data.staff });
      setCaps(reqRes.data.caps);
    } else {
      setRequests([]);
    }
    setSelfReported(selfRes || []);
  }, [user, testMode?.isTestSuperUser, testMode?.effectiveEmail, testMode?.activePersona]);

  useEffect(() => { load(); }, [load]);

  // Celebration — fires once per achievement the first time it appears as
  // Verified on this device, then never again. The first-ever visit just
  // seeds the set (no confetti for old achievements).
  useEffect(() => {
    if (verified === null || verified.length === 0) return;
    try {
      if (localStorage.getItem('bw_celebrated') === null) {
        localStorage.setItem('bw_celebrated', JSON.stringify(verified.map(v => v.verify_id).filter(Boolean)));
        return;
      }
      const celebrated = JSON.parse(localStorage.getItem('bw_celebrated') || '[]');
      const fresh = verified.filter(v => v.verify_id && !celebrated.includes(v.verify_id));
      if (fresh.length) setCelebrateQueue(fresh.map(cardFromVault));
    } catch { /* never block the page */ }
  }, [verified]);

  useEffect(() => {
    if (!celebrateQueue.length || celebrating) return;
    const [next, ...rest] = celebrateQueue;
    setCelebrateQueue(rest);
    setCelebrating(next);
    try {
      const celebrated = JSON.parse(localStorage.getItem('bw_celebrated') || '[]');
      localStorage.setItem('bw_celebrated', JSON.stringify([...celebrated, next.verification_id]));
    } catch { /* never block the celebration */ }
  }, [celebrateQueue, celebrating]);

  // "Get this verified" on unverified cards — prefills the request form from
  // the self-reported item (same flow as the dashboard self-achievements card).
  const handleGetVerified = (card) => {
    const s = card.raw;
    if (!meta?.orgs?.length) {
      toast.error('Join an organisation first — verification needs someone to verify it');
      return;
    }
    setVerifySelf(s);
    setEditing({
      school_id: meta.orgs[0].id,
      title: s.title,
      description: s.description || '',
      image_url: s.image_url || '',
      date_achieved: s.date_achieved || '',
      evidence: s.evidence || [],
    });
    setFormOpen(true);
  };

  const setView = (mode) => {
    setViewMode(mode);
    try { localStorage.setItem('bw_view_mode', mode); } catch { /* ignore */ }
  };

  const handleSubmit = async (payload, { submit, resubmit }) => {
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
    } catch (e) {
      toast.error(e?.response?.data?.error || e.message);
    } finally {
      setSaving(false);
    }
  };

  const openRequestCount = (requests || []).filter(r => !['minted', 'archived', 'rejected', 'expired', 'withdrawn'].includes(r.status)).length;

  // Student-initiated cancel — see the withdraw action server-side.
  const handleWithdraw = async (r) => {
    try {
      const res = await base44.functions.invoke('achievementRequestAction', { action: 'withdraw', request_id: r.id });
      if (!res.data?.ok) throw new Error(res.data?.error || 'Could not withdraw');
      toast.success('Request withdrawn');
      load();
    } catch (e) {
      toast.error(e?.response?.data?.error || e.message || 'Could not withdraw');
    }
  };

  // Duplicate a withdrawn request into a fresh draft — the form opens with
  // every detail prefilled; saving creates a NEW request (the withdrawn one
  // stays untouched for the audit trail).
  const handleDuplicate = (r) => {
    setEditing({ ...r, id: null, status: 'draft' });
    setFormOpen(true);
  };

  // Verified-but-unpublished recovery — the student presses "Finish
  // publishing" to re-run the mint after a server-side failure.
  const handleRetryPublish = async (r) => {
    try {
      const res = await base44.functions.invoke('achievementRequestAction', { action: 'retry_mint', request_id: r.id });
      if (!res.data?.ok) throw new Error(res.data?.error || 'Could not publish');
      toast.success('Published to your profile');
      load();
    } catch (e) {
      toast.error(e?.response?.data?.error || e.message || 'Could not publish');
    }
  };
  const unverifiedCount = (selfReported || []).filter(s => s.status !== 'verified').length;
  // Distinct achievements: verified + open requests + unverified self-reported.
  // Archived/minted requests already exist as verified achievements, and
  // verified self-reported items live in the verified list — never count twice.
  const allLoaded = verified !== null && requests !== null && selfReported !== null;
  const totalCount = allLoaded ? verified.length + openRequestCount + unverifiedCount : null;

  return (
    <div className="space-y-6">
      {/* Header — renders immediately from the session identity */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">My BlockWards</h1>
          <p className="text-muted-foreground mt-1">
            Your achievements are stored securely in your BlockWard Vault
          </p>
          {profile?.handle && (
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <button
                onClick={() => window.open(`${window.location.origin}/@${profile.handle}`, '_blank')}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
              >
                <AtSign className="h-3.5 w-3.5" /> {profile.handle}
              </button>
              <Button size="sm" variant="outline" onClick={() => setShareOpen(true)}>
                <Share2 className="h-3.5 w-3.5 mr-1.5" /> Share profile
              </Button>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PortfolioActions records={verified || []} profile={profile} user={user} />
          <Button
            onClick={() => { setEditing(null); setFormOpen(true); }}
            disabled={caps && !caps.can_submit}
            title={caps && !caps.can_submit ? 'You have hit your request limits' : undefined}
          >
            <Plus className="h-4 w-4 mr-2" /> Request an achievement
          </Button>
        </div>
      </div>

      {/* Tabs + view toggle — the grid is the default; the list is the compact mode */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All ({totalCount === null ? '…' : totalCount})</TabsTrigger>
          <TabsTrigger value="verified">Verified ({verified === null ? '…' : verified.length})</TabsTrigger>
          <TabsTrigger value="pending">Pending ({requests === null ? '…' : openRequestCount})</TabsTrigger>
          <TabsTrigger value="unverified">Unverified ({selfReported === null ? '…' : unverifiedCount})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <AllTab
            verified={verified || []}
            requests={requests || []}
            selfReported={selfReported || []}
            onSelectVerified={setSelectedBlockWard}
            onGoTo={setActiveTab}
            onShare={setShareTarget}
            onGetVerified={handleGetVerified}
            viewMode={viewMode}
            loading={!allLoaded}
          />
        </TabsContent>

        <TabsContent value="verified" className="mt-6">
          <VerifiedTab
            achievements={verified || []}
            profile={profile}
            onSelect={setSelectedBlockWard}
            onShare={setShareTarget}
            viewMode={viewMode}
            loading={verified === null}
          />
        </TabsContent>

        <TabsContent value="pending" className="mt-6">
          <PendingTab
            requests={requests || []}
            caps={caps}
            onEdit={(r) => { setEditing(r); setFormOpen(true); }}
            onWithdraw={handleWithdraw}
            onDuplicate={handleDuplicate}
            onRetry={handleRetryPublish}
            loading={requests === null}
          />
        </TabsContent>

        <TabsContent value="unverified" className="mt-6">
          <UnverifiedTab
            items={selfReported || []}
            onGetVerified={handleGetVerified}
            viewMode={viewMode}
            loading={selfReported === null}
          />
        </TabsContent>
        </Tabs>

        {/* View toggle */}
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1 self-start">
          <button
            onClick={() => setView('grid')}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors ${viewMode === 'grid' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-hover hover:text-foreground'}`}
            aria-label="Grid view"
            title="Grid view"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setView('list')}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors ${viewMode === 'list' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-hover hover:text-foreground'}`}
            aria-label="List view"
            title="Compact list view"
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Modals */}
      <BlockWardDetailModal
        blockWard={selectedBlockWard}
        open={!!selectedBlockWard}
        onClose={() => setSelectedBlockWard(null)}
      />

      <ProfileShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        profile={{
          name: profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : '',
          handle: profile?.handle,
          bio: profile?.bio || null,
          avatar_url: profile?.avatar_url || null,
          count: verified?.length || 0,
        }}
      />

      <AchievementShareDialog
        open={!!shareTarget}
        onOpenChange={(o) => { if (!o) setShareTarget(null); }}
        achievement={shareTarget ? { verification_id: shareTarget.verification_id, title: shareTarget.title } : null}
      />

      <CelebrationDialog
        item={celebrating}
        onDismiss={() => setCelebrating(null)}
        onShare={(card) => { setCelebrating(null); setShareTarget(card); }}
      />

      <RequestForm
        open={formOpen}
        onOpenChange={(o) => { setFormOpen(o); if (!o) setEditing(null); }}
        meta={meta}
        initial={editing}
        onSubmit={handleSubmit}
        saving={saving}
      />
    </div>
  );
}