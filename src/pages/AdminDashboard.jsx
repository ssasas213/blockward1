import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import PendingSignaturesWidget from '@/components/dashboard/PendingSignaturesWidget';
import {
  Users, BookOpen, Award, Shield, TrendingUp,
  ArrowUpRight, ChevronRight, Activity, RefreshCw, Loader2,
  Settings, BarChart3, FileText, HeartPulse, Download,
  CheckCircle2, XCircle, Clock, AlertTriangle, ExternalLink, Info, PenLine
} from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';
import { format } from 'date-fns';

function AdminDashboardContent() {
  const [userProfile, setUserProfile] = useState(null);
  const [school, setSchool] = useState(null);
  const [loading, setLoading] = useState(true);
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
    pointsByCategory: []
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
      const [students, teachers, classes, blockWards, points] = await Promise.all([
        schoolId ? base44.entities.UserProfile.filter({ user_type: 'student', school_id: schoolId }) : base44.entities.UserProfile.filter({ user_type: 'student' }),
        schoolId ? base44.entities.UserProfile.filter({ user_type: 'teacher', school_id: schoolId }) : base44.entities.UserProfile.filter({ user_type: 'teacher' }),
        schoolId ? base44.entities.Class.filter({ school_id: schoolId }) : base44.entities.Class.list(),
        schoolId ? base44.entities.BlockWard.filter({ school_id: schoolId }, '-created_date') : base44.entities.BlockWard.list('-created_date', 20),
        schoolId ? base44.entities.PointEntry.filter({ school_id: schoolId }, '-created_date') : base44.entities.PointEntry.list('-created_date', 20)
      ]);
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
        pointsByCategory: Object.values(categoryTotals)
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
          bw.student_name || '',
          bw.title || '',
          bw.category || '',
          bw.status || '',
          bw.issuer_name || '',
          bw.minted_at ? format(new Date(bw.minted_at), 'yyyy-MM-dd') : '',
          bw.transaction_hash || ''
        ]);
      });
      downloadCSV(rows, 'blockwards_export.csv');
    } else if (type === 'points') {
      const rows = [['Student', 'Teacher', 'Type', 'Points', 'Category', 'Reason', 'Date']];
      stats.recentPoints.forEach(p => {
        rows.push([
          p.student_name || '',
          p.teacher_name || '',
          p.type || '',
          p.points || '',
          p.category_name || '',
          p.reason || '',
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

  const COLORS = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444'];

  const statCards = [
    { title: 'Total Students', value: stats.totalStudents, icon: Users, color: 'from-blue-500 to-cyan-500' },
    { title: 'Total Teachers', value: stats.totalTeachers, icon: Users, color: 'from-violet-500 to-purple-500' },
    { title: 'Active Classes', value: stats.totalClasses, icon: BookOpen, color: 'from-emerald-500 to-green-500' },
    { title: 'BlockWards Issued', value: stats.totalBlockWards, icon: Shield, color: 'from-amber-500 to-orange-500' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 rounded-full border-4 border-violet-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">
          Admin Controls
        </h1>
        <p className="text-slate-500 mt-1">
          {school?.name || 'Admin Dashboard'} — {userProfile?.first_name} {userProfile?.last_name}
        </p>
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3 max-w-2xl">
          <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-blue-700">
            Admins manage users, classes, system settings, and NFT records. <strong>Teachers issue BlockWards to students.</strong>
          </p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.07 }}
          >
            <Card className="border-0 shadow-md">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500">{stat.title}</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</p>
                  </div>
                  <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center`}>
                    <stat.icon className="h-5 w-5 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* ─── 1. USER MANAGEMENT ─── */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-100 flex items-center justify-center">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-base">User Management</CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">Manage teachers, students, roles, and approvals</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" size="sm" asChild>
              <Link to={createPageUrl('ManageUsers')}>
                <Users className="h-4 w-4 mr-2" />
                View All Users
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to={createPageUrl('ManageUsers')}>
                <Shield className="h-4 w-4 mr-2" />
                Manage Roles
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to={createPageUrl('AdminPermissions')}>
                <Settings className="h-4 w-4 mr-2" />
                Admin Permissions
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to={createPageUrl('SchoolCodes')}>
                <ChevronRight className="h-4 w-4 mr-2" />
                School Join Codes
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ─── 2. SCHOOL & CLASS MANAGEMENT ─── */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-100 flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <CardTitle className="text-base">School & Class Management</CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">Create and manage classes, view join codes, and archive classes</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" size="sm" asChild>
              <Link to={createPageUrl('Classes')}>
                <BookOpen className="h-4 w-4 mr-2" />
                Manage Classes
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to={createPageUrl('Timetable')}>
                <ChevronRight className="h-4 w-4 mr-2" />
                Timetable
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to={createPageUrl('SchoolEvents')}>
                <ChevronRight className="h-4 w-4 mr-2" />
                School Events
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to={createPageUrl('SystemSettings')}>
                <Settings className="h-4 w-4 mr-2" />
                School Settings
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ─── 3. POINT SYSTEM MANAGEMENT ─── */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-amber-100 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <CardTitle className="text-base">Point System Management</CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">Create and edit point categories, view point history, manage values</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" size="sm" asChild>
              <Link to={createPageUrl('PointCategories')}>
                <Settings className="h-4 w-4 mr-2" />
                Point Categories
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to={createPageUrl('Analytics')}>
                <BarChart3 className="h-4 w-4 mr-2" />
                View Points Analytics
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to={createPageUrl('Reports')}>
                <FileText className="h-4 w-4 mr-2" />
                Points Reports
              </Link>
            </Button>
          </div>

          {/* Points Distribution Chart */}
          {stats.pointsByCategory.length > 0 && (
            <div>
              <p className="text-sm font-medium text-slate-700 mb-3">Points by Category</p>
              <div className="flex items-center gap-6">
                <div className="h-32 w-32 flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={stats.pointsByCategory} cx="50%" cy="50%" innerRadius={28} outerRadius={50} paddingAngle={3} dataKey="value">
                        {stats.pointsByCategory.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {stats.pointsByCategory.map((cat, i) => (
                    <div key={cat.name} className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-xs text-slate-600">{cat.name} ({cat.value})</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Recent Point Activity */}
          {stats.recentPoints.length > 0 && (
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Recent Point Activity</p>
              <div className="space-y-2">
                {stats.recentPoints.map((point) => (
                  <div key={point.id} className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${point.type === 'achievement' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {point.type === 'achievement' ? '+' : '−'}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{point.student_name}</p>
                        <p className="text-xs text-slate-500">{point.reason}</p>
                      </div>
                    </div>
                    <Badge variant={point.type === 'achievement' ? 'default' : 'destructive'} className="text-xs">
                      {point.points > 0 ? '+' : ''}{point.points}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── PENDING SIGNATURES WIDGET ─── */}
      <PendingSignaturesWidget
        userEmail={userProfile?.user_email}
        schoolId={userProfile?.school_id}
        role="admin"
        targetPage="AdminApprovalQueue"
      />

      {/* ─── DIGITAL CUSTODIAN RECORDS ─── */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-orange-100 flex items-center justify-center">
              <PenLine className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <CardTitle className="text-base">Digital Custodian Records</CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">Review, sign, and approve student award records. Records require both admin and student signatures.</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" size="sm" asChild>
              <Link to={createPageUrl('AdminRecords')}>
                <FileText className="h-4 w-4 mr-2" />
                All Student Records
              </Link>
            </Button>
            <Button className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white" size="sm" asChild>
              <Link to={createPageUrl('AdminApprovalQueue')}>
                <PenLine className="h-4 w-4 mr-2" />
                Approval Queue
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ─── 4. BLOCKWARD / NFT MANAGEMENT ─── */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-violet-100 flex items-center justify-center">
              <Shield className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <CardTitle className="text-base">BlockWard Management</CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">View NFT records, check status, reconcile failed transactions. <span className="font-medium text-violet-700">Teachers issue BlockWards — admins manage records.</span></p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" size="sm" asChild>
              <Link to={createPageUrl('BlockWards')}>
                <Shield className="h-4 w-4 mr-2" />
                View BlockWard Records
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
              Reconcile Pending / Failed
            </Button>
          </div>

          {reconcileResult && (
            <div className={`p-4 rounded-lg border text-sm ${reconcileResult.error ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'}`}>
              {reconcileResult.error ? (
                <p><strong>Reconciliation failed:</strong> {reconcileResult.error}</p>
              ) : (
                <div className="flex flex-wrap gap-4">
                  <span>✅ <strong>Scanned:</strong> {reconcileResult.total}</span>
                  <span>🔧 <strong>Repaired:</strong> {reconcileResult.repaired}</span>
                  <span>✓ <strong>Correct:</strong> {reconcileResult.alreadyCorrect}</span>
                  <span>⏳ <strong>Pending:</strong> {reconcileResult.pending}</span>
                  <span>❌ <strong>Failed:</strong> {reconcileResult.failed}</span>
                  <span>📝 <strong>No TX:</strong> {reconcileResult.noTx}</span>
                </div>
              )}
            </div>
          )}

          {/* Recent BlockWards preview */}
          {stats.recentBlockWards.length > 0 && (
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Recent BlockWard Records</p>
              <div className="space-y-2">
                {stats.recentBlockWards.slice(0, 4).map((bw) => (
                  <div key={bw.id} className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Shield className="h-4 w-4 text-violet-500 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-slate-900">{bw.title}</p>
                        <p className="text-xs text-slate-500">→ {bw.student_name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {bw.transaction_hash && (
                        <a
                          href={`https://sepolia.etherscan.io/tx/${bw.transaction_hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-violet-500 hover:text-violet-700"
                          title="View on Etherscan"
                          onClick={e => e.stopPropagation()}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                      <Badge
                        className={`text-xs ${bw.status === 'active' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`}
                        variant="outline"
                      >
                        {bw.status === 'active' ? <CheckCircle2 className="h-3 w-3 mr-1 inline" /> : <XCircle className="h-3 w-3 mr-1 inline" />}
                        {bw.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="ghost" size="sm" className="mt-2 text-violet-600" asChild>
                <Link to={createPageUrl('BlockWards')}>
                  View all records <ChevronRight className="h-3 w-3 ml-1" />
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── 5. SYSTEM HEALTH ─── */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-rose-100 flex items-center justify-center">
              <HeartPulse className="h-5 w-5 text-rose-600" />
            </div>
            <div>
              <CardTitle className="text-base">System Health</CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">Check Sepolia network, contract, and issuer wallet status</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" size="sm" onClick={handleHealthCheck} disabled={healthChecking}>
              {healthChecking ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <HeartPulse className="h-4 w-4 mr-2" />}
              Run Health Check
            </Button>
          </div>

          {healthResult && (
            <div className={`p-4 rounded-lg border text-sm space-y-2 ${healthResult.error ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
              {healthResult.error ? (
                <p className="text-red-700"><strong>Error:</strong> {healthResult.error}</p>
              ) : (
                Object.entries(healthResult).map(([key, val]) => (
                  <div key={key} className="flex items-center justify-between gap-4">
                    <span className="text-slate-600 capitalize">{key.replace(/_/g, ' ')}</span>
                    <span className={`font-mono text-xs break-all text-right ${typeof val === 'boolean' ? (val ? 'text-green-700' : 'text-red-700') : 'text-slate-700'}`}>
                      {typeof val === 'boolean' ? (val ? '✅ OK' : '❌ Failed') : String(val)}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── 6. DATA EXPORT ─── */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center">
              <Download className="h-5 w-5 text-slate-600" />
            </div>
            <div>
              <CardTitle className="text-base">Data Export</CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">Export records as CSV for reporting and backup</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" size="sm" onClick={() => handleExportCSV('blockwards')}>
              <Download className="h-4 w-4 mr-2" />
              Export BlockWard History
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExportCSV('points')}>
              <Download className="h-4 w-4 mr-2" />
              Export Points History
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to={createPageUrl('Reports')}>
                <FileText className="h-4 w-4 mr-2" />
                Full Reports
              </Link>
            </Button>
          </div>
          <p className="text-xs text-slate-400 mt-3">Exports include the most recent records loaded on this dashboard. For full exports, use the Reports page.</p>
        </CardContent>
      </Card>

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