import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Clock, CheckCircle2, XCircle, Search, Filter,
  Loader2, FileText, ChevronRight, AlertTriangle,
  PenLine, Shield, Award, Eye
} from 'lucide-react';

const STATUS_CONFIG = {
  submitted: { label: 'Submitted', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: FileText },
  awaiting_teacher_signature: { label: 'Awaiting Teacher', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock },
  awaiting_admin_signature: { label: 'Awaiting Your Signature', color: 'bg-orange-100 text-orange-700 border-orange-200', icon: PenLine },
  approved: { label: 'Ready to Deliver', color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle2 },
  delivered_to_vault: { label: 'Delivered to Vault', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: Shield },
  minted: { label: 'Minted', color: 'bg-violet-100 text-violet-700 border-violet-200', icon: Award },
  archived: { label: 'Archived', color: 'bg-slate-100 text-slate-600 border-slate-200', icon: Shield },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle },
  draft: { label: 'Draft', color: 'bg-slate-100 text-slate-500 border-slate-200', icon: FileText },
};

const CATEGORY_COLORS = {
  academic: 'bg-blue-50 text-blue-700',
  sports: 'bg-green-50 text-green-700',
  arts: 'bg-purple-50 text-purple-700',
  leadership: 'bg-amber-50 text-amber-700',
  community: 'bg-rose-50 text-rose-700',
  innovation: 'bg-cyan-50 text-cyan-700',
  special: 'bg-orange-50 text-orange-700',
};

function AdminApprovalQueueContent() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('awaiting_admin_signature');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const user = await base44.auth.me();
      const profiles = await base44.entities.UserProfile.filter({ user_email: user.email });
      const p = profiles[0];
      setProfile(p);
      if (!p?.school_id) return;

      const recs = await base44.entities.StudentRecord.filter({ school_id: p.school_id }, '-created_date');
      setRecords(recs);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const filtered = records.filter(r => {
    const matchesStatus = filterStatus === 'all'
      || r.status === filterStatus;
    const q = search.toLowerCase();
    const matchesSearch = !q ||
      r.student_name?.toLowerCase().includes(q) ||
      r.title?.toLowerCase().includes(q) ||
      r.teacher_name?.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  // Metrics — 'archived' is the single approved state (teacher + admin signed, BlockWard minted)
  const awaitingAdmin = records.filter(r => r.status === 'awaiting_admin_signature').length;
  const awaitingTeacher = records.filter(r => r.status === 'awaiting_teacher_signature').length;
  const approvedReady = records.filter(r => r.status === 'approved').length;
  const delivered = records.filter(r => r.status === 'delivered_to_vault').length;
  const archived = records.filter(r => r.status === 'archived').length;

  const filterTabs = [
    { key: 'awaiting_admin_signature', label: 'Needs My Signature', count: awaitingAdmin },
    { key: 'approved', label: 'Ready to Deliver', count: approvedReady },
    { key: 'delivered_to_vault', label: 'Delivered', count: delivered },
    { key: 'awaiting_teacher_signature', label: 'With Teacher', count: awaitingTeacher },
    { key: 'archived', label: 'Archived', count: archived },
    { key: 'all', label: 'All Records', count: records.length },
  ];

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
    </div>
  );

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Approval Queue</h1>
          <p className="text-slate-500 mt-1">Review and sign student achievement records</p>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Needs My Signature', value: awaitingAdmin, color: 'from-orange-500 to-amber-500', icon: PenLine, urgent: awaitingAdmin > 0 },
          { label: 'With Teacher', value: awaitingTeacher, color: 'from-amber-400 to-yellow-500', icon: Clock },
          { label: 'Archived', value: archived, color: 'from-green-500 to-emerald-500', icon: CheckCircle2 },
          { label: 'Total Records', value: records.length, color: 'from-violet-500 to-indigo-500', icon: Award },
        ].map((m, i) => (
          <Card key={i} className={`border-0 shadow-md ${m.urgent ? 'ring-2 ring-orange-400' : ''}`}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500">{m.label}</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{m.value}</p>
                </div>
                <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${m.color} flex items-center justify-center`}>
                  <m.icon className="h-5 w-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Urgent Alert */}
      {awaitingAdmin > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-orange-800">
              {awaitingAdmin} record{awaitingAdmin !== 1 ? 's' : ''} awaiting your signature
            </p>
            <p className="text-xs text-orange-600">Review teacher-endorsed submissions and apply your digital signature to authorise minting.</p>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {filterTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilterStatus(tab.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              filterStatus === tab.key
                ? 'bg-violet-600 text-white shadow-md'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {tab.label}
            <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${
              filterStatus === tab.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search by student, title, or teacher..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 h-11"
        />
      </div>

      {/* Records Table */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No records match your filter</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filtered.map(record => {
                const cfg = STATUS_CONFIG[record.status] || STATUS_CONFIG.draft;
                const StatusIcon = cfg.icon;
                const catColor = CATEGORY_COLORS[record.category] || 'bg-slate-50 text-slate-600';
                const needsAction = record.status === 'awaiting_admin_signature';

                return (
                  <div key={record.id} className={`p-4 hover:bg-slate-50 transition-colors ${needsAction ? 'bg-orange-50/40' : ''}`}>
                    <div className="flex items-start gap-4">
                      <div className="h-10 w-10 rounded-full bg-violet-100 flex items-center justify-center font-bold text-violet-700 flex-shrink-0 mt-0.5">
                        {record.student_name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div>
                            <p className="font-semibold text-slate-900">{record.title}</p>
                            <p className="text-sm text-slate-500 mt-0.5">
                              <span className="font-medium text-slate-700">{record.student_name}</span>
                              {record.teacher_name && <> · Teacher: {record.teacher_name}</>}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Badge variant="outline" className={`text-xs ${cfg.color}`}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {cfg.label}
                            </Badge>
                            {record.category && (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${catColor}`}>
                                {record.category}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 mt-2">
                          {record.teacher_signed && (
                            <span className="text-xs text-green-600 flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Teacher signed
                            </span>
                          )}
                          {record.admin_signed && (
                            <span className="text-xs text-blue-600 flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Admin signed
                            </span>
                          )}
                          {record.date_achieved && (
                            <span className="text-xs text-slate-400">{record.date_achieved}</span>
                          )}
                        </div>
                      </div>
                      <Link
                        to={createPageUrl(`RecordDetail?id=${record.id}`)}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all flex-shrink-0 ${
                          needsAction
                            ? 'bg-orange-500 text-white hover:bg-orange-600 shadow-md'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {needsAction ? <PenLine className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        {needsAction ? 'Sign Now' : 'View'}
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminApprovalQueue() {
  return <AdminApprovalQueueContent />;
}