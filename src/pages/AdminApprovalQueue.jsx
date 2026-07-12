import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PageHeader from '@/components/ui/page-header';
import StatCard from '@/components/ui/stat-card';
import StatusBadge from '@/components/ui/status-badge';
import EmptyState from '@/components/ui/empty-state';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import {
  Clock, CheckCircle2, Search,
  PenLine, Award, Eye, AlertTriangle
} from 'lucide-react';
import { cn } from "@/lib/utils";

const CATEGORY_COLORS = {
  academic: 'bg-blue-50 text-blue-700',
  sports: 'bg-green-50 text-green-700',
  arts: 'bg-purple-50 text-purple-700',
  leadership: 'bg-amber-50 text-amber-700',
  community: 'bg-rose-50 text-rose-700',
  innovation: 'bg-cyan-50 text-cyan-700',
  special: 'bg-orange-50 text-orange-700',
  behaviour: 'bg-slate-50 text-slate-600',
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
    const matchesStatus = filterStatus === 'all' || r.status === filterStatus;
    const q = search.toLowerCase();
    const matchesSearch = !q ||
      r.student_name?.toLowerCase().includes(q) ||
      r.title?.toLowerCase().includes(q) ||
      r.teacher_name?.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

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

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title="Approval Queue"
        description="Review and sign student achievement records"
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Needs My Signature" value={awaitingAdmin} icon={PenLine} hint={awaitingAdmin > 0 ? 'Action required' : undefined} />
        <StatCard label="With Teacher" value={awaitingTeacher} icon={Clock} />
        <StatCard label="Archived" value={archived} icon={CheckCircle2} />
        <StatCard label="Total Records" value={records.length} icon={Award} />
      </div>

      {/* Urgent Alert */}
      {awaitingAdmin > 0 && (
        <div className="flex items-start gap-3 p-3 bg-warning/5 border border-warning/20 rounded-lg">
          <AlertTriangle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">
              {awaitingAdmin} record{awaitingAdmin !== 1 ? 's' : ''} awaiting your signature
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Review teacher-endorsed submissions and apply your digital signature to authorise minting.</p>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-1.5">
        {filterTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilterStatus(tab.key)}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              filterStatus === tab.key
                ? 'bg-primary text-primary-foreground'
                : 'bg-card border border-border text-muted-foreground hover:bg-muted'
            )}
          >
            {tab.label}
            <span className={cn(
              "ml-1.5 px-1.5 py-0.5 rounded text-xs tabular-nums",
              filterStatus === tab.key ? 'bg-primary-foreground/20' : 'bg-muted text-muted-foreground'
            )}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by student, title, or teacher..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
          aria-label="Search records"
        />
      </div>

      {/* Records List */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="No records match your filter"
              description="Try changing the filter or search query."
            />
          ) : (
            <div className="divide-y divide-border">
              {filtered.map(record => {
                const catColor = CATEGORY_COLORS[record.category] || 'bg-slate-50 text-slate-600';
                const needsAction = record.status === 'awaiting_admin_signature';

                return (
                  <div key={record.id} className={cn("p-4 hover:bg-muted/50 transition-colors", needsAction && "bg-warning/5")}>
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center font-medium text-primary text-sm flex-shrink-0 mt-0.5">
                        {record.student_name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div className="min-w-0">
                            <p className="font-medium text-foreground text-sm">{record.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              <span className="font-medium text-foreground">{record.student_name}</span>
                              {record.teacher_name && <> · {record.teacher_name}</>}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <StatusBadge status={record.status} />
                            {record.category && (
                              <span className={cn("text-xs px-2 py-0.5 rounded font-medium", catColor)}>
                                {record.category}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 mt-2">
                          {record.teacher_signed && (
                            <span className="text-xs text-success flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Teacher signed
                            </span>
                          )}
                          {record.admin_signed && (
                            <span className="text-xs text-success flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Admin signed
                            </span>
                          )}
                          {record.date_achieved && (
                            <span className="text-xs text-muted-foreground">{record.date_achieved}</span>
                          )}
                        </div>
                      </div>
                      <Link
                        to={needsAction ? `/admin/approve/${record.id}` : createPageUrl(`RecordDetail?id=${record.id}`)}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex-shrink-0",
                          needsAction
                            ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                            : 'bg-muted text-foreground hover:bg-muted/70'
                        )}
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