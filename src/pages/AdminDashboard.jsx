import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { Button } from "@/components/ui/button";
import PageHeader from '@/components/ui/page-header';
import StatCard from '@/components/ui/stat-card';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import PendingSignaturesWidget from '@/components/dashboard/PendingSignaturesWidget';
import AdminAcademicWidget from '@/components/dashboard/AdminAcademicWidget';
import AdminAssignmentsWidget from '@/components/dashboard/AdminAssignmentsWidget';
import AdminAssembliesWidget from '@/components/dashboard/AdminAssembliesWidget';
import PendingTeacherRequests from '@/components/onboarding/PendingTeacherRequests';
import SetupChecklist from '@/components/onboarding/SetupChecklist';
import InvitePeopleModal from '@/components/invitations/InvitePeopleModal';
import { Send, Info, PenLine, Users, BookOpen, Shield, HardDrive, AlertCircle } from 'lucide-react';

function AdminDashboardContent() {
  const [userProfile, setUserProfile] = useState(null);
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
      const user = await base44.auth.me();
      let schoolId = null;
      if (user) {
        const profiles = await base44.entities.UserProfile.filter({ user_email: user.email });
        if (profiles.length > 0) {
          const p = profiles[0];
          setUserProfile(p);
          schoolId = p.school_id || null;
        }
      }
      if (schoolId) {
        const schools = await base44.entities.School.filter({ id: schoolId });
        if (schools.length > 0) setSchool(schools[0]);
      }
      const [students, teachers, classes, blockWards, pendingArchive] = await Promise.all([
        schoolId ? base44.entities.UserProfile.filter({ user_type: 'student', school_id: schoolId }) : base44.entities.UserProfile.filter({ user_type: 'student' }),
        schoolId ? base44.entities.UserProfile.filter({ user_type: 'teacher', school_id: schoolId }) : base44.entities.UserProfile.filter({ user_type: 'teacher' }),
        schoolId ? base44.entities.Class.filter({ school_id: schoolId }) : base44.entities.Class.list(),
        schoolId ? base44.entities.BlockWard.filter({ school_id: schoolId }, '-created_date') : base44.entities.BlockWard.list('-created_date', 20),
        schoolId ? base44.entities.StudentRecord.filter({ school_id: schoolId, status: 'pending_student_drive' }) : base44.entities.StudentRecord.filter({ status: 'pending_student_drive' })
      ]);
      const driveConnectedCount = students.filter(s => s.connected_google_email).length;
      setStats({
        totalStudents: students.length,
        totalTeachers: teachers.length,
        totalClasses: classes.length,
        totalBlockWards: blockWards.length,
        driveConnected: driveConnectedCount,
        recordsPendingArchive: pendingArchive.length,
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

      {isEmpty ? (
        /* Empty school — the Setup Checklist is the hero; it encodes the correct onboarding order. */
        <div className="space-y-6">
          <SetupChecklist />
          <PendingTeacherRequests />
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

          {/* Academic + Assignments + Assemblies */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <AdminAcademicWidget />
            <AdminAssignmentsWidget />
            <AdminAssembliesWidget />
          </div>

          {/* Setup Checklist + Pending Teacher Requests */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SetupChecklist />
            <PendingTeacherRequests />
          </div>

          {/* Pending Signatures */}
          <PendingSignaturesWidget
            userEmail={userProfile?.user_email}
            schoolId={userProfile?.school_id}
            role="admin"
            targetPage="Records"
          />
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