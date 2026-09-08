import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Share2, AtSign } from 'lucide-react';
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

/**
 * My BlockWards — the one merged student achievement page (formerly
 * StudentBlockWards, StudentMyRecords, StudentPortfolioVault and
 * AchievementRequests). Tabs: All / Verified / Pending / Unverified.
 * Earned achievements load through loadEarnedAchievements() — the single
 * loader mandated by ACHIEVEMENT_ARCHITECTURE.md.
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
  const { testMode } = useSchool();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [verified, setVerified] = useState([]);
  const [requests, setRequests] = useState([]);
  const [meta, setMeta] = useState(null);
  const [caps, setCaps] = useState(null);
  const [selfReported, setSelfReported] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [selectedBlockWard, setSelectedBlockWard] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const me = await base44.auth.me();
      setUser(me);
      const profiles = await base44.entities.UserProfile.filter({ user_email: me.email });
      const p = profiles[0] || null;
      setProfile(p);

      // THE single loader for earned achievements (ACHIEVEMENT_ARCHITECTURE.md)
      const { achievements } = await loadEarnedAchievements();
      setVerified(achievements);

      const email = testMode?.isTestSuperUser && testMode.effectiveEmail ? testMode.effectiveEmail : me.email;
      const [reqRes, selfRes] = await Promise.all([
        base44.functions.invoke('achievementRequestData', { mode: 'student' }),
        base44.entities.SelfReportedAchievement.filter({ student_email: email }, '-created_date'),
      ]);
      if (reqRes.data?.ok) {
        setRequests(reqRes.data.requests || []);
        setMeta({ orgs: reqRes.data.orgs, templates: reqRes.data.templates, staff: reqRes.data.staff });
        setCaps(reqRes.data.caps);
      }
      setSelfReported(selfRes || []);
    } catch (e) {
      toast.error(e?.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }, [testMode?.activePersona]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (payload, { submit, resubmit }) => {
    setSaving(true);
    try {
      const action = submit ? (resubmit ? 'resubmit' : 'submit') : 'save_draft';
      const res = await base44.functions.invoke('achievementRequestAction', {
        action, form: payload, request_id: editing?.id || null,
      });
      if (!res.data?.ok) throw new Error(res.data?.error || 'Failed to save');
      toast.success(submit ? (resubmit ? 'Resubmitted for review' : 'Request submitted') : 'Draft saved');
      setFormOpen(false);
      setEditing(null);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.error || e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    );
  }

  const openRequestCount = requests.filter(r => !['minted', 'archived', 'rejected', 'expired'].includes(r.status)).length;
  const unverifiedCount = selfReported.filter(s => s.status !== 'verified').length;
  const totalCount = verified.length + requests.length + selfReported.length;

  return (
    <div className="space-y-6">
      {/* Header */}
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
          <PortfolioActions records={verified} profile={profile} user={user} />
          <Button
            onClick={() => { setEditing(null); setFormOpen(true); }}
            disabled={caps && !caps.can_submit}
            title={caps && !caps.can_submit ? 'You have hit your request limits' : undefined}
          >
            <Plus className="h-4 w-4 mr-2" /> Request an achievement
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All ({totalCount})</TabsTrigger>
          <TabsTrigger value="verified">Verified ({verified.length})</TabsTrigger>
          <TabsTrigger value="pending">Pending ({openRequestCount})</TabsTrigger>
          <TabsTrigger value="unverified">Unverified ({unverifiedCount})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <AllTab
            verified={verified}
            requests={requests}
            selfReported={selfReported}
            onSelectVerified={setSelectedBlockWard}
            onGoTo={setActiveTab}
          />
        </TabsContent>

        <TabsContent value="verified" className="mt-6">
          <VerifiedTab
            achievements={verified}
            profile={profile}
            onSelect={setSelectedBlockWard}
          />
        </TabsContent>

        <TabsContent value="pending" className="mt-6">
          <PendingTab
            requests={requests}
            caps={caps}
            onEdit={(r) => { setEditing(r); setFormOpen(true); }}
          />
        </TabsContent>

        <TabsContent value="unverified" className="mt-6">
          <UnverifiedTab items={selfReported} />
        </TabsContent>
      </Tabs>

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
          count: verified.length,
        }}
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