import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import PageHeader from '@/components/ui/page-header';
import StatCard from '@/components/ui/stat-card';
import EmptyState from '@/components/ui/empty-state';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import PendingSignaturesWidget from '@/components/dashboard/PendingSignaturesWidget';
import AdminAcademicWidget from '@/components/dashboard/AdminAcademicWidget';
import AdminAssignmentsWidget from '@/components/dashboard/AdminAssignmentsWidget';
import AdminAssembliesWidget from '@/components/dashboard/AdminAssembliesWidget';
import PendingTeacherRequests from '@/components/onboarding/PendingTeacherRequests';
import SetupChecklist from '@/components/onboarding/SetupChecklist';
import InvitePeopleModal from '@/components/invitations/InvitePeopleModal';
import { Send } from 'lucide-react';
import {
  Users, BookOpen, Shield, TrendingUp,
  ChevronRight, RefreshCw, Loader2,
  Settings, BarChart3, FileText, HeartPulse, Download,
  CheckCircle2, XCircle, ExternalLink, Info, PenLine, HardDrive, AlertCircle
} from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

function AdminDashboardContent() {
  const [userProfile, setUserProfile] = useState(null);
  const [school, setSchool] = useState(null);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [reconcileResult, setReconcileResult] = useState(null);
  const [healthResult, setHealthResult] = useState(null);
  const [healthChecking, setHealthChecking] = useState(false);
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalTeachers: 0,
    totalClasses: 0,
    totalBlockWards: 0,
    recentPoints: [],
    recentBlockWards: [],
    pointsByCategory: [],
    driveConnected: 0,
    driveNotConnected: 0,
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
      const [students, teachers, classes, blockWards, points, pendingArchive] = await Promise.all([
        schoolId ? base44.entities.UserProfile.filter({ user_type: 'student', school_id: schoolId }) : base44.entities.UserProfile.filter({ user_type: 'student' }),
        schoolId ? base44.entities.UserProfile.filter({ user_type: 'teacher', school_id: schoolId }) : base44.entities.UserProfile.filter({ user_type: 'teacher' }),
        schoolId ? base44.entities.Class.filter({ school_id: schoolId }) : base44.entities.Class.list(),
        schoolId ? base44.entities.BlockWard.filter({ school_id: schoolId }, '-created_date') : base44.entities.BlockWard.list('-created_date', 20),
        schoolId ? base44.entities.PointEntry.filter({ school_id: schoolId }, '-created_date') : base44.entities.PointEntry.list('-created_date', 20),
        schoolId ? base44.entities.StudentRecord.filter({ school_id: schoolId, status: 'pending_student_drive' }) : base44.entities.StudentRecord.filter({ status: 'pending_student_drive' })
      ]);
      const driveConnectedCount = students.filter(s => s.connected_google_email).length;
      const categoryTotals = {};
      points.forEach(p => {
        const key = p.category_name || 'Other';
        if (!categoryTotals[key]) categoryTotals[key] = { name: key, value: 0 };
        categoryTotals[key].value += Math.abs(p.points);
      });
      setStats({
        totalStudents: students.length,
        totalTeachers: teachers.length,
        totalClasses: classes.length,
        totalBlockWards: blockWards.length,
        recentPoints: points.slice(0, 5),
        recentBlockWards: blockWards.slice(0, 5),
        pointsByCategory: Object.values(categoryTotals),
        driveConnected: driveConnectedCount,
        driveNotConnected: students.length - driveConnectedCount,
        recordsPendingArchive: pendingArchive.length,
      });
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReconcile = async () => {
    setReconciling(true);
    setReconcileResult(null);
    try {
      const res = await base44.functions.invoke('reconcileBlockWards', {});
      setReconcileResult(res.data?.results || { error: 'No results returned' });
      toast.success('Reconciliation complete');
    } catch (err) {
      setReconcileResult({ error: err.message });
      toast.error('Reconciliation failed');
    } finally {
      setReconciling(false);
    }
  };

  const handleHealthCheck = async () => {
    setHealthChecking(true);
    setHealthResult(null);
    try {
      const res = await base44.functions.invoke('healthCheckSepolia', {});
      setHealthResult(res.data);
      toast.success('Health check complete');
    } catch (err) {
      setHealthResult({ error: err.message });
      toast.error('Health check failed');
    } finally {
      setHealthChecking(false);
    }
  };

  const handleExportCSV = (type) => {
    if (type === 'blockwards') {
      const rows = [['Student', 'Title', 'Category', 'Status', 'Issuer', 'Date', 'TX Hash']];
      stats.recentBlockWards.forEach(bw => {
        rows.push([
          bw.student_name || '', bw.title || '', bw.category || '', bw.status || '',
          bw.issuer_name || '', bw.minted_at ? format(new Date(bw.minted_at), 'yyyy-MM-dd') : '',
          bw.transaction_hash || ''
        ]);
      });
      downloadCSV(rows, 'blockwards_export.csv');
    } else if (type === 'points') {
      const rows = [['Student', 'Teacher', 'Type', 'Points', 'Category', 'Reason', 'Date']];
      stats.recentPoints.forEach(p => {
        rows.push([
          p.student_name || '', p.teacher_name || '', p.type || '', p.points || '',
          p.category_name || '', p.reason || '',
          p.timestamp ? format(new Date(p.timestamp), 'yyyy-MM-dd') : ''
        ]);
      });
      downloadCSV(rows, 'points_export.csv');
    }
    toast.success('CSV export started');
  };

  const downloadCSV = (rows, filename) => {
    const content = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const COLORS = ['hsl(258 90% 66%)', 'hsl(330 81% 60%)', 'hsl(239 84% 67%)', 'hsl(142 71% 45%)', 'hsl(38 92% 50%)'];

  if (loading) return <DashboardSkeleton />;

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

      {/* Records & Approval */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
              <PenLine className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-sm">Achievement Records</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Review, sign, and approve student award records</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" asChild>
              <Link to={createPageUrl('Records')}>
                <PenLine className="h-4 w-4 mr-2" />
                Open Records
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Point System */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-sm">Point System</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Categories, analytics, and recent activity</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link to={createPageUrl('PointCategories')}>
                  <Settings className="h-4 w-4 mr-2" />
                  Categories
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to={createPageUrl('Analytics')}>
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Analytics
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to={createPageUrl('Reports')}>
                  <FileText className="h-4 w-4 mr-2" />
                  Reports
                </Link>
              </Button>
            </div>

            {stats.pointsByCategory.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Points by Category</p>
                <div className="flex items-center gap-4">
                  <div className="h-24 w-24 flex-shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={stats.pointsByCategory} cx="50%" cy="50%" innerRadius={20} outerRadius={40} paddingAngle={3} dataKey="value">
                          {stats.pointsByCategory.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {stats.pointsByCategory.map((cat, i) => (
                      <div key={cat.name} className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-xs text-muted-foreground">{cat.name} ({cat.value})</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {stats.recentPoints.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Recent Point Activity</p>
                <div className="space-y-1.5">
                  {stats.recentPoints.map((point) => (
                    <div key={point.id} className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`h-6 w-6 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0 ${point.type === 'achievement' ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'}`}>
                          {point.type === 'achievement' ? '+' : '−'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{point.student_name}</p>
                          <p className="text-xs text-muted-foreground truncate">{point.reason}</p>
                        </div>
                      </div>
                      <Badge variant={point.type === 'achievement' ? 'default' : 'destructive'} className="text-xs flex-shrink-0">
                        {point.points > 0 ? '+' : ''}{point.points}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* BlockWard Records */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                <Shield className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-sm">BlockWard Records</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Minted NFT records and blockchain status</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link to={createPageUrl('Records')}>
                  <FileText className="h-4 w-4 mr-2" />
                  Achievement Records
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to={createPageUrl('BlockchainDocs')}>
                  <FileText className="h-4 w-4 mr-2" />
                  Blockchain Docs
                </Link>
              </Button>
              <Button variant="outline" size="sm" onClick={handleReconcile} disabled={reconciling}>
                {reconciling ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Reconcile
              </Button>
            </div>

            {reconcileResult && (
              <div className={`p-3 rounded-lg border text-xs ${reconcileResult.error ? 'bg-destructive/5 border-destructive/20 text-destructive' : 'bg-success/5 border-success/20 text-success'}`}>
                {reconcileResult.error ? (
                  <p>Reconciliation failed: {reconcileResult.error}</p>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    <span>Scanned: {reconcileResult.total}</span>
                    <span>Repaired: {reconcileResult.repaired}</span>
                    <span>Correct: {reconcileResult.alreadyCorrect}</span>
                    <span>Pending: {reconcileResult.pending}</span>
                    <span>Failed: {reconcileResult.failed}</span>
                  </div>
                )}
              </div>
            )}

            {stats.recentBlockWards.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Recent Minted Records</p>
                <div className="space-y-1.5">
                  {stats.recentBlockWards.slice(0, 4).map((bw) => (
                    <div key={bw.id} className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2 min-w-0">
                        <Shield className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{bw.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{bw.student_name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {bw.transaction_hash && (
                          <a
                            href={`https://sepolia.etherscan.io/tx/${bw.transaction_hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-primary"
                            title="View on Etherscan"
                            onClick={e => e.stopPropagation()}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                        <Badge
                          className={`text-xs ${bw.status === 'active' ? 'border-success/30 bg-success/15 text-success' : 'border-destructive/30 bg-destructive/15 text-destructive'}`}
                          variant="outline"
                        >
                          {bw.status === 'active' ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                          {bw.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
                <Button variant="ghost" size="sm" className="mt-2" asChild>
                  <Link to={createPageUrl('Records')}>
                    View all records <ChevronRight className="h-3 w-3 ml-1" />
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* System Health & Data Export */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                <HeartPulse className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-sm">System Health</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Network, contract, and wallet status</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" size="sm" onClick={handleHealthCheck} disabled={healthChecking}>
              {healthChecking ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <HeartPulse className="h-4 w-4 mr-2" />}
              Run Health Check
            </Button>
            {healthResult && (
              <div className={`p-3 rounded-lg border text-xs space-y-1.5 ${healthResult.error ? 'bg-destructive/5 border-destructive/20' : 'bg-muted/50 border-border'}`}>
                {healthResult.error ? (
                  <p className="text-destructive">Error: {healthResult.error}</p>
                ) : (
                  Object.entries(healthResult).map(([key, val]) => (
                    <div key={key} className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</span>
                      <span className={`font-mono break-all text-right ${typeof val === 'boolean' ? (val ? 'text-success' : 'text-destructive') : 'text-foreground'}`}>
                        {typeof val === 'boolean' ? (val ? 'OK' : 'Failed') : String(val)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                <Download className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-sm">Data Export</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Export records as CSV</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => handleExportCSV('blockwards')}>
                <Download className="h-4 w-4 mr-2" />
                BlockWard History
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExportCSV('points')}>
                <Download className="h-4 w-4 mr-2" />
                Points History
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to={createPageUrl('Reports')}>
                  <FileText className="h-4 w-4 mr-2" />
                  Full Reports
                </Link>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-3">Exports include recent records loaded on this dashboard. For full exports, use the Reports page.</p>
          </CardContent>
        </Card>
      </div>
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