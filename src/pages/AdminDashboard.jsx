import React, { useState, useEffect } from 'react';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useSchool } from '@/lib/SchoolContext';
import GlowActionButton from '@/components/ui/GlowActionButton';
import PageHeader from '@/components/ui/page-header';
import StatCard from '@/components/ui/stat-card';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import AdminApprovalQueue from '@/components/admin/AdminApprovalQueue';
import PendingSignaturesWidget from '@/components/dashboard/PendingSignaturesWidget';
import StaffApprovalsCard from '@/components/people/StaffApprovalsCard';
import InvitePeopleModal from '@/components/invitations/InvitePeopleModal';
import AdminAlertsWidget from '@/components/admin/AdminAlertsWidget';
import RecentCredentialsCard from '@/components/admin/RecentCredentialsCard';
import RecentActivityCard from '@/components/dashboard/RecentActivityCard';
import { Send, PenLine, Award, ClipboardCheck, Users, UserCheck, Ban, ShieldCheck } from 'lucide-react';

// Organisation Admin dashboard — credential-platform first. Metrics and
// sections reflect BlockWard's verified-credential product; legacy
// school-management widgets are out of the primary view (their routes and
// data are untouched). Every number is a real server-side count — no
// fabricated analytics; empty states when nothing has been collected yet.
function AdminDashboardContent() {
  const { profile: userProfile } = useSchool();
  const [school, setSchool] = useState(null);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [stats, setStats] = useState({ totalBlockWards: 0, totalStudents: 0, totalTeachers: 0 });
  const [metrics, setMetrics] = useState({ recipients: 0, revoked: 0, verified_30d: 0, pending_approvals: 0, active_verifiers: 0 });
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [notifications, setNotifications] = useState(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [res, notifRes] = await Promise.all([
        base44.functions.invoke('getDashboardData', {}),
        base44.functions.invoke('getNotifications', {}).catch(() => null),
      ]);
      const d = res.data || {};
      if (!d.ok) throw new Error(d.error || 'Failed to load dashboard');
      setNotifications(notifRes?.data?.ok ? (notifRes.data.notifications || []).slice(0, 5) : []);
      setSchool(d.school || null);
      const s = d.stats || {};
      setStats({
        totalBlockWards: s.total_blockwards || 0,
        totalStudents: s.total_students || 0,
        totalTeachers: s.total_teachers || 0,
      });
      setMetrics(d.credential_metrics || { recipients: 0, revoked: 0, verified_30d: 0, pending_approvals: 0, active_verifiers: 0 });
      setPendingApprovals(d.pending_approvals || []);
    } catch (error) {
      console.error('Error loading dashboard:', error);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <DashboardSkeleton />;

  const isEmpty = stats.totalStudents === 0 && stats.totalTeachers === 0 && stats.totalBlockWards === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organisation overview"
        description={school?.name || 'Credential issuing overview'}
      >
        <div className="flex flex-wrap gap-2">
          <GlowActionButton variant="secondary" size="md" icon={Send} label="Invite People" onClick={() => setInviteOpen(true)} />
          <GlowActionButton size="md" icon={PenLine} label="Open Records" to={createPageUrl('Records')} />
        </div>
      </PageHeader>

      <InvitePeopleModal open={inviteOpen} onOpenChange={setInviteOpen} defaultRole="teacher" schoolId={userProfile?.school_id} />

      {isEmpty ? (
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <p className="text-sm font-medium text-foreground">No credentials yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Achievements awaiting verification will appear here once your organisation starts issuing credentials.
            </p>
          </div>
          <StaffApprovalsCard hideWhenEmpty />
        </div>
      ) : (
        <>
          {/* Key metrics — all real counts from the server */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <StatCard label="Credentials Issued" value={stats.totalBlockWards} icon={Award} />
            <StatCard label="Pending Approvals" value={metrics.pending_approvals} icon={ClipboardCheck} />
            <StatCard label="Active Issuers" value={metrics.active_verifiers} icon={Users} />
            <StatCard label="Recipients" value={metrics.recipients} icon={UserCheck} />
            <StatCard label="Verified (30d)" value={metrics.verified_30d} icon={ShieldCheck} />
            <StatCard label="Revoked" value={metrics.revoked} icon={Ban} />
          </div>

          {/* Primary action area */}
          <AdminApprovalQueue items={pendingApprovals} />

          {/* Operational alerts: missing registers, failed invites, staff approvals, anchors */}
          <AdminAlertsWidget />

          {/* Recent credential issuance · Recent activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RecentCredentialsCard />
            <RecentActivityCard notifications={notifications} loading={notifications === null} />
          </div>

          {/* Issuer management + outstanding signatures */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <StaffApprovalsCard hideWhenEmpty />
            <PendingSignaturesWidget
              userEmail={userProfile?.user_email}
              schoolId={userProfile?.school_id}
              role="admin"
              targetPage="Records"
            />
          </div>
        </>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <ProtectedRoute>
      <AdminDashboardContent />
    </ProtectedRoute>
  );
}