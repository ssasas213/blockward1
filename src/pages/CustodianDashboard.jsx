/**
 * CustodianDashboard — School Digital Custodian Overview
 * Shows the complete state of all student achievement records for the school:
 * totals, pipeline metrics, drive save status, verification stats, and quick actions.
 */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Shield, Trophy, Clock, CheckCircle2, XCircle, HardDrive,
  PenLine, FileText, Archive, Users, BarChart3,
  AlertTriangle, ExternalLink, Loader2, ChevronRight, Sparkles
} from 'lucide-react';
import { format } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

const STATUS_COLORS = {
  draft: '#94a3b8',
  awaiting_teacher_signature: '#f59e0b',
  awaiting_admin_signature: '#f97316',
  approved: '#22c55e',
  archived: '#8b5cf6',
  rejected: '#ef4444',
  minted: '#8b5cf6',
};

export default function CustodianDashboard() {
  const [profile, setProfile] = useState(null);
  const [school, setSchool] = useState(null);
  const [records, setRecords] = useState([]);
  const [driveVaults, setDriveVaults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const user = await base44.auth.me();
      const profiles = await base44.entities.UserProfile.filter({ user_email: user.email });
      const p = profiles[0];
      setProfile(p);
      if (!p?.school_id) { setLoading(false); return; }

      const [recs, schools, vaults] = await Promise.all([
        base44.entities.StudentRecord.filter({ school_id: p.school_id }, '-created_date'),
        base44.entities.School.filter({ id: p.school_id }),
        base44.entities.DriveVault.filter({ school_id: p.school_id }),
      ]);

      setRecords(recs);
      setSchool(schools[0] || null);
      setDriveVaults(vaults);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
    </div>
  );

  // Metrics
  const total = records.length;
  const byStatus = {
    draft: records.filter(r => r.status === 'draft').length,
    awaiting_teacher: records.filter(r => r.status === 'awaiting_teacher_signature').length,
    awaiting_admin: records.filter(r => r.status === 'awaiting_admin_signature').length,
    approved: records.filter(r => r.status === 'approved').length,
    archived: records.filter(r => r.status === 'delivered_to_vault' || r.status === 'archived' || r.status === 'minted').length,
    rejected: records.filter(r => r.status === 'rejected').length,
  };

  const driveConnectedStudents = new Set(driveVaults.map(v => v.student_email)).size;
  const verifiedCount = records.filter(r => r.verify_id).length;
  const withBothSigs = records.filter(r => r.teacher_signed && r.admin_signed).length;
  const withEvidence = records.filter(r => r.file_url).length;

  const recentArchived = records
    .filter(r => r.status === 'delivered_to_vault' || r.status === 'archived' || r.status === 'minted')
    .slice(0, 6);

  const pendingUrgent = byStatus.awaiting_admin + byStatus.awaiting_teacher + byStatus.approved;

  const pipelineData = [
    { name: 'Draft', value: byStatus.draft, color: '#94a3b8' },
    { name: 'Teacher Review', value: byStatus.awaiting_teacher, color: '#f59e0b' },
    { name: 'Admin Review', value: byStatus.awaiting_admin, color: '#f97316' },
    { name: 'Approved', value: byStatus.approved, color: '#22c55e' },
    { name: 'Archived', value: byStatus.archived, color: '#8b5cf6' },
    { name: 'Rejected', value: byStatus.rejected, color: '#ef4444' },
  ];

  const byCategory = {};
  records.forEach(r => {
    if (!byCategory[r.category]) byCategory[r.category] = 0;
    byCategory[r.category]++;
  });
  const categoryData = Object.entries(byCategory).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Digital Custodian</h1>
              <p className="text-slate-500 mt-0.5">{school?.name || 'School'} — Verified Achievement Archive</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" asChild>
            <Link to={createPageUrl('AdminApprovalQueue')}>
              <PenLine className="h-4 w-4 mr-1.5" /> Approval Queue
              {byStatus.awaiting_admin > 0 && (
                <span className="ml-1.5 bg-orange-500 text-white text-xs rounded-full px-1.5 py-0.5">{byStatus.awaiting_admin}</span>
              )}
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to={createPageUrl('AdminRecords')}>
              <FileText className="h-4 w-4 mr-1.5" /> All Records
            </Link>
          </Button>
        </div>
      </div>

      {/* Urgent Alert */}
      {pendingUrgent > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-orange-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-orange-800">
              {byStatus.awaiting_admin > 0 && `${byStatus.awaiting_admin} record${byStatus.awaiting_admin !== 1 ? 's' : ''} awaiting admin signature`}
              {byStatus.awaiting_admin > 0 && byStatus.awaiting_teacher > 0 && ' · '}
              {byStatus.awaiting_teacher > 0 && `${byStatus.awaiting_teacher} awaiting teacher review`}
              {byStatus.approved > 0 && ` · ${byStatus.approved} approved and ready to archive`}
            </p>
          </div>
          <Button size="sm" asChild className="bg-orange-500 hover:bg-orange-600 text-white flex-shrink-0">
            <Link to={createPageUrl('AdminApprovalQueue')}>Take Action</Link>
          </Button>
        </div>
      )}

      {/* Primary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Records', value: total, icon: FileText, color: 'text-slate-700', bg: 'bg-slate-100' },
          { label: 'Awaiting Teacher', value: byStatus.awaiting_teacher, icon: Clock, color: 'text-amber-700', bg: 'bg-amber-100', alert: byStatus.awaiting_teacher > 0 },
          { label: 'Awaiting Admin', value: byStatus.awaiting_admin, icon: PenLine, color: 'text-orange-700', bg: 'bg-orange-100', alert: byStatus.awaiting_admin > 0 },
          { label: 'Approved', value: byStatus.approved, icon: CheckCircle2, color: 'text-green-700', bg: 'bg-green-100', alert: byStatus.approved > 0 },
          { label: 'Archived', value: byStatus.archived, icon: Archive, color: 'text-violet-700', bg: 'bg-violet-100' },
          { label: 'Rejected', value: byStatus.rejected, icon: XCircle, color: 'text-red-700', bg: 'bg-red-100' },
        ].map(m => (
          <Card key={m.label} className={`border-0 shadow-md ${m.alert ? 'ring-2 ring-orange-400' : ''}`}>
            <CardContent className="p-4 text-center">
              <div className={`h-9 w-9 rounded-xl ${m.bg} flex items-center justify-center mx-auto mb-2`}>
                <m.icon className={`h-5 w-5 ${m.color}`} />
              </div>
              <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
              <p className="text-xs text-slate-500 mt-0.5 leading-tight">{m.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pipeline Chart + Verification Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pipeline bar chart */}
        <div className="lg:col-span-2">
          <Card className="border-0 shadow-md h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-violet-600" /> Record Pipeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={pipelineData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {pipelineData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Verification & Drive stats */}
        <div className="space-y-4">
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="h-4 w-4 text-violet-600" /> Verification Stats
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {[
                { label: 'With Evidence', value: withEvidence, total, color: 'bg-blue-500' },
                { label: 'Dual Signed', value: withBothSigs, total, color: 'bg-violet-500' },
                { label: 'Verified (ID issued)', value: verifiedCount, total, color: 'bg-green-500' },
                { label: 'Drive Saved', value: driveVaults.length, total, color: 'bg-emerald-500' },
              ].map(s => (
                <div key={s.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-600">{s.label}</span>
                    <span className="font-semibold">{s.value}/{s.total}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${s.color} transition-all`}
                      style={{ width: s.total > 0 ? `${Math.round((s.value / s.total) * 100)}%` : '0%' }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <HardDrive className="h-8 w-8 text-violet-500" />
                <div>
                  <p className="text-2xl font-bold text-slate-900">{driveVaults.length}</p>
                  <p className="text-xs text-slate-500">Files saved to Drive</p>
                </div>
              </div>
              <div className="mt-2 text-xs text-slate-500">
                {driveConnectedStudents} student{driveConnectedStudents !== 1 ? 's' : ''} with Drive archives
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Category breakdown */}
      {categoryData.length > 0 && (
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" /> Records by Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {categoryData.sort((a, b) => b.value - a.value).map(c => (
                <div key={c.name} className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg">
                  <span className="text-sm font-medium text-slate-700 capitalize">{c.name}</span>
                  <Badge className="bg-violet-100 text-violet-700 border-0 text-xs">{c.value}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Custodian Archive — Recent Archived Records */}
      <Card className="border-0 shadow-md">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Archive className="h-4 w-4 text-violet-600" /> Custodian Archive — Recent
          </CardTitle>
          <Button variant="ghost" size="sm" asChild className="text-violet-600">
            <Link to={createPageUrl('AdminRecords')}>View All <ChevronRight className="h-3.5 w-3.5 ml-1" /></Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recentArchived.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <Sparkles className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No archived records yet. Approve and archive records to see them here.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentArchived.map(r => (
                <div key={r.id} className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
                  <div className="h-10 w-10 rounded-full bg-violet-100 flex items-center justify-center font-bold text-violet-700 flex-shrink-0 text-sm">
                    {r.student_name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate">{r.title}</p>
                    <p className="text-xs text-slate-500">{r.student_name} · {r.category}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {r.verify_id && (
                      <span className="text-xs font-mono text-slate-400 hidden md:block">{r.verify_id}</span>
                    )}
                    {r.drive_file_url && (
                      <a href={r.drive_file_url} target="_blank" rel="noopener noreferrer"
                        className="text-emerald-600 hover:text-emerald-700">
                        <HardDrive className="h-4 w-4" />
                      </a>
                    )}
                    <Link to={createPageUrl(`RecordDetail?id=${r.id}`)}>
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Permission Matrix */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-600" /> Permission Matrix
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 pr-4 text-slate-500 font-medium">Action</th>
                  <th className="text-center py-2 px-3 text-blue-600 font-medium">Student</th>
                  <th className="text-center py-2 px-3 text-amber-600 font-medium">Teacher</th>
                  <th className="text-center py-2 px-3 text-violet-600 font-medium">Admin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {[
                  ['Submit achievement', '✅', '✅ (on behalf)', '❌'],
                  ['Upload evidence', '✅', '✅', '❌'],
                  ['Review evidence', '❌', '✅ (own classes)', '✅'],
                  ['Teacher sign', '❌', '✅', '❌'],
                  ['Reject record', '❌', '✅', '✅'],
                  ['Admin sign & verify', '❌', '❌', '✅'],
                  ['Mint & Archive to Drive', '❌', '❌', '✅'],
                  ['View own records', '✅', '❌', '❌'],
                  ['View all school records', '❌', '✅ (classes)', '✅'],
                  ['Connect Google Drive', '✅', '❌', '❌'],
                  ['Manage users', '❌', '❌', '✅'],
                  ['View portfolio vault', '✅', '❌', '❌'],
                ].map(([action, student, teacher, admin]) => (
                  <tr key={action}>
                    <td className="py-2 pr-4 text-slate-700">{action}</td>
                    <td className="text-center py-2 px-3 text-xs">{student}</td>
                    <td className="text-center py-2 px-3 text-xs">{teacher}</td>
                    <td className="text-center py-2 px-3 text-xs">{admin}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}