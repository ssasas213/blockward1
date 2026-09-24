import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useSchool } from '@/lib/SchoolContext';
import { Button } from "@/components/ui/button";
import PageHeader from '@/components/ui/page-header';
import StatCard from '@/components/ui/stat-card';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import PendingSignaturesWidget from '@/components/dashboard/PendingSignaturesWidget';
import AdminAcademicWidget from '@/components/dashboard/AdminAcademicWidget';
import AdminAssignmentsWidget from '@/components/dashboard/AdminAssignmentsWidget';
import AdminAssembliesWidget from '@/components/dashboard/AdminAssembliesWidget';
import StaffApprovalsCard from '@/components/people/StaffApprovalsCard';
import SetupChecklist from '@/components/onboarding/SetupChecklist';
import InvitePeopleModal from '@/components/invitations/InvitePeopleModal';
import EndorsementAdminPanel from '@/components/endorsements/EndorsementAdminPanel';
import OrgMembershipRequestsWidget from '@/components/dashboard/OrgMembershipRequestsWidget';
import AdminAlertsWidget from '@/components/admin/AdminAlertsWidget';
import { Send, Info, PenLine, Users, BookOpen, Shield, HardDrive, AlertCircle } from 'lucide-react';

function AdminDashboardContent() {
  // Identity comes from SchoolContext — the effective persona in Test Mode.
  const { profile: userProfile } = useSchool();
  const [school, setSchool] = useState(null);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalTeachers: 0,
    totalClasses: 0,
    totalBlockWards: 0,
    driveConnected: 0,
    recordsPendingArchive: 0,
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Persona-aware data — the backend resolves the effective actor
      // (test persona in Test Mode) and reads through the service role, so
      // the stats follow the persona's school instead of the controller's.
      const res = await base44.functions.invoke('getDashboardData', {});
      const d = res.data || {};
      if (!d.ok) throw new Error(d.error || 'Failed to load dashboard');
      setSchool(d.school || null);
      const s = d.stats || {};
      setStats({
        totalStudents: s.total_students || 0,
        totalTeachers: s.total_teachers || 0,
        totalClasses: s.total_classes || 0,
        totalBlockWards: s.total_blockwards || 0,
        driveConnected: s.drive_connected || 0,
        recordsPendingArchive: s.records_pending_archive || 0,
      });
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <DashboardSkeleton />;

  const isEmpty = stats.totalStudents === 0 && stats.totalTeachers === 0 && stats.totalClasses === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Dashboard"
        description={school?.name || 'Administration overview'}
      >
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setInviteOpen(true)}>
            <Send className="h-4 w-4 mr-2" /> Invite People
          </Button>
          <Button asChild>
            <Link to={createPageUrl('Records')}>
              <PenLine className="h-4 w-4 mr-2" />
              Open Records
            </Link>
          </Button>
        </div>
      </PageHeader>

      <InvitePeopleModal open={inviteOpen} onOpenChange={setInviteOpen} defaultRole="teacher" schoolId={userProfile?.school_id} />

      {/* Info banner */}
      <div className="flex items-start gap-3 p-3 bg-info/5 border border-info/20 rounded-lg max-w-2xl">
        <Info className="h-4 w-4 text-info mt-0.5 flex-shrink-0" />
        <p className="text-sm text-foreground">
          Admins review, approve, and sign achievement records. Only teachers can create and submit achievement records.
        </p>
      </div>

      {/* Cross-org membership requests awaiting this organisation's approval */}
      <OrgMembershipRequestsWidget />

      {isEmpty ? (
        /* Empty school — the Setup Checklist is the hero; it encodes the correct onboarding order. */
        <div className="space-y-6">
          <SetupChecklist />
          <StaffApprovalsCard hideWhenEmpty />
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard label="Total Students" value={stats.totalStudents} icon={Users} />
            <StatCard label="Total Teachers" value={stats.totalTeachers} icon={Users} />
            <StatCard label="Active Classes" value={stats.totalClasses} icon={BookOpen} />
            <StatCard label="BlockWards Issued" value={stats.totalBlockWards} icon={Shield} />
            <StatCard label="Drive Connected" value={stats.driveConnected} icon={HardDrive} />
            <StatCard label="Pending Archive" value={stats.recordsPendingArchive} icon={AlertCircle} />
          </div>

          {/* Operational alerts: missing registers, failed invites, staff approvals, anchors */}
          <AdminAlertsWidget />

          {/* Academic + Assignments + Assemblies */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <AdminAcademicWidget />
            <AdminAssignmentsWidget />
            <AdminAssembliesWidget />
          </div>

          {/* Setup Checklist + Pending Teacher Requests */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SetupChecklist />
            <StaffApprovalsCard hideWhenEmpty />
          </div>

          {/* Pending Signatures */}
          <PendingSignaturesWidget
            userEmail={userProfile?.user_email}
            schoolId={userProfile?.school_id}
            role="admin"
            targetPage="Records"
          />

          {/* Peer endorsement programme: invite funnel + scarcity settings */}
          <EndorsementAdminPanel />
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