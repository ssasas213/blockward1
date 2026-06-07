import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, ChevronRight, PenLine, Shield, Trophy, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import RecordStatusBadge from '@/components/records/RecordStatusBadge';
import { toast } from 'sonner';

export default function AdminRecords() {
  const [records, setRecords] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const user = await base44.auth.me();
      const profiles = await base44.entities.UserProfile.filter({ user_email: user.email });
      const p = profiles[0];
      setProfile(p);
      if (!p?.school_id) { setLoading(false); return; }

      const recs = await base44.entities.StudentRecord.filter({ school_id: p.school_id }, '-created_date');
      setRecords(recs);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const filtered = records.filter(r => {
    const matchSearch = !search ||
      r.student_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.title?.toLowerCase().includes(search.toLowerCase()) ||
      r.teacher_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const pendingAdmin = records.filter(r => r.status === 'awaiting_admin_signature').length;
  const approved = records.filter(r => r.status === 'approved').length;
  const minted = records.filter(r => r.status === 'minted' || r.status === 'archived').length;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="h-8 w-8 rounded-full border-4 border-violet-600 border-t-transparent animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Achievement Approvals</h1>
        <p className="text-slate-500 mt-1">Review teacher-endorsed achievements, give final approval, and authorize NFT minting</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: records.length, color: 'text-slate-600' },
          { label: 'Awaiting My Approval', value: pendingAdmin, color: 'text-orange-600', alert: pendingAdmin > 0 },
          { label: 'Ready to Mint', value: approved, color: 'text-green-600', alert: approved > 0 },
          { label: 'Minted NFTs', value: minted, color: 'text-violet-600' },
        ].map(s => (
          <Card key={s.label} className={`border-0 shadow-md ${s.alert ? 'ring-2 ring-amber-400' : ''}`}>
            <CardContent className="p-4 text-center">
              <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-500 mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Alerts */}
      {pendingAdmin > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center gap-3">
          <Shield className="h-5 w-5 text-orange-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-orange-800">{pendingAdmin} achievement{pendingAdmin > 1 ? 's' : ''} awaiting your approval</p>
            <p className="text-sm text-orange-600">Teacher-endorsed submissions waiting for your final signature to authorize minting.</p>
          </div>
          <Button size="sm" className="bg-orange-600 hover:bg-orange-700 text-white"
            onClick={() => setStatusFilter('awaiting_admin_signature')}>
            Approve Now
          </Button>
        </div>
      )}
      {approved > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-green-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-green-800">{approved} achievement{approved > 1 ? 's' : ''} ready to be minted as NFTs</p>
            <p className="text-sm text-green-600">These have been fully approved — open each one to trigger NFT minting and Drive archiving.</p>
          </div>
          <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white"
            onClick={() => setStatusFilter('approved')}>
            View
          </Button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search records..." className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-56">
            <SelectValue>{statusFilter === 'all' ? 'All Statuses' : statusFilter.replace(/_/g, ' ')}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="awaiting_teacher_signature">Awaiting Teacher</SelectItem>
            <SelectItem value="awaiting_admin_signature">Awaiting My Approval</SelectItem>
            <SelectItem value="approved">Approved — Ready to Mint</SelectItem>
            <SelectItem value="minted">Minted</SelectItem>
            <SelectItem value="archived">Archived to Drive</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Achievement</TableHead>
                <TableHead>Teacher</TableHead>
                <TableHead>Evidence</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-slate-400">
                    <Trophy className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    No records found
                  </TableCell>
                </TableRow>
              ) : filtered.map(r => (
                <TableRow key={r.id} className={`hover:bg-slate-50 ${r.status === 'awaiting_admin_signature' ? 'bg-orange-50/30' : r.status === 'approved' ? 'bg-green-50/30' : ''}`}>
                  <TableCell>
                    <p className="font-medium text-slate-900">{r.student_name}</p>
                    <p className="text-xs text-slate-400">{r.student_email}</p>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-slate-800">{r.title}</p>
                    <Badge className="text-xs bg-slate-100 text-slate-600 border-0 capitalize mt-0.5">{r.category}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">{r.teacher_name || '—'}</TableCell>
                  <TableCell>
                    {r.file_url
                      ? r.file_url.match(/\.(jpg|jpeg|png|gif|webp)$/i)
                        ? <img src={r.file_url} alt="evidence" className="h-10 w-10 rounded-lg object-cover border" />
                        : <Badge className="bg-blue-50 text-blue-600 border-0 text-xs">File</Badge>
                      : <span className="text-xs text-slate-400">—</span>
                    }
                  </TableCell>
                  <TableCell><RecordStatusBadge status={r.status} /></TableCell>
                  <TableCell className="text-xs text-slate-500">
                    {r.created_date ? format(new Date(r.created_date), 'MMM d, yyyy') : '—'}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant={['awaiting_admin_signature', 'approved'].includes(r.status) ? 'default' : 'ghost'}
                      size="sm" asChild
                      className={r.status === 'awaiting_admin_signature' ? 'bg-orange-600 hover:bg-orange-700' : r.status === 'approved' ? 'bg-violet-600 hover:bg-violet-700' : ''}>
                      <Link to={createPageUrl(`RecordDetail?id=${r.id}`)}>
                        {r.status === 'awaiting_admin_signature' ? 'Approve' : r.status === 'approved' ? 'Mint NFT' : <ChevronRight className="h-4 w-4" />}
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}