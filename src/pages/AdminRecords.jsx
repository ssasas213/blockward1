import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, ChevronRight, PenLine, Clock, CheckCircle2, FileText, Shield } from 'lucide-react';
import { format } from 'date-fns';
import RecordStatusBadge from '@/components/records/RecordStatusBadge';
import { toast } from 'sonner';

export default function AdminRecords() {
  const [records, setRecords] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loadError, setLoadError] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const debug = {
      authUser: null,
      profileFound: false,
      profileRole: null,
      profileSchoolId: null,
      queryResults: {},
      queryErrors: {},
    };

    try {
      // Step 1: auth
      const user = await base44.auth.me();
      debug.authUser = user?.email || 'null';

      // Step 2: UserProfile lookup
      let p = null;
      try {
        const profiles = await base44.entities.UserProfile.filter({ user_email: user.email });
        p = profiles[0] || null;
        debug.profileFound = !!p;
        debug.profileRole = p?.user_type || 'NULL';
        debug.profileSchoolId = p?.school_id || 'NULL';
        debug.queryResults.UserProfile = `${profiles.length} result(s)`;
      } catch (e) {
        debug.queryErrors.UserProfile = e.message;
        setDebugInfo(debug);
        setLoadError('UserProfile query failed: ' + e.message);
        setLoading(false);
        return;
      }

      setProfile(p);

      if (!p?.school_id) {
        debug.queryErrors.StudentRecord = 'SKIPPED — no school_id on profile';
        setDebugInfo(debug);
        setRecords([]);
        setLoading(false);
        return;
      }

      // Step 3: StudentRecord filtered by school_id server-side (avoids full table scan + RLS join)
      let schoolRecs = [];
      try {
        schoolRecs = await base44.entities.StudentRecord.filter(
          { school_id: p.school_id },
          '-created_date'
        );
        debug.queryResults.StudentRecord = `${schoolRecs.length} result(s)`;
      } catch (e) {
        debug.queryErrors.StudentRecord = e.message;
        setDebugInfo(debug);
        setLoadError('StudentRecord query failed: ' + e.message);
        setLoading(false);
        return;
      }

      setRecords(schoolRecs);
      setDebugInfo(debug);
    } catch (e) {
      debug.queryErrors.unexpected = e.message;
      setDebugInfo(debug);
      setLoadError('Unexpected error: ' + e.message);
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
  const pendingDrive = records.filter(r => r.status === 'pending_drive_save').length;
  const active = records.filter(r => r.status === 'active').length;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="h-8 w-8 rounded-full border-4 border-violet-600 border-t-transparent animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Student Records</h1>
        <p className="text-slate-500 mt-1">Review, sign, and manage all digital custodian records for your school</p>
      </div>

      {/* Error Panel */}
      {loadError && (
        <div className="bg-red-900 text-red-200 rounded-xl p-4 font-mono text-xs">
          <p className="text-red-300 font-bold mb-1">❌ LOAD ERROR</p>
          <p>{loadError}</p>
        </div>
      )}

      {/* Debug Panel */}
      {debugInfo ? (
        <div className="bg-slate-900 text-green-400 rounded-xl p-4 font-mono text-xs space-y-1">
          <p className="text-yellow-400 font-bold mb-2">🔍 DEBUG PANEL</p>
          <p>authUser: <span className="text-white">{debugInfo.authUser}</span></p>
          <p>profileFound: <span className={debugInfo.profileFound ? 'text-green-300' : 'text-red-400'}>{String(debugInfo.profileFound)}</span></p>
          <p>profileRole: <span className="text-white">{debugInfo.profileRole}</span></p>
          <p>profileSchoolId: <span className="text-white">{debugInfo.profileSchoolId}</span></p>
          <p className="pt-1 text-yellow-300">queryResults:</p>
          {Object.entries(debugInfo.queryResults).map(([k, v]) => (
            <p key={k} className="pl-2">  {k}: <span className="text-green-300">{v}</span></p>
          ))}
          {Object.keys(debugInfo.queryErrors).length > 0 && <>
            <p className="pt-1 text-red-400">queryErrors:</p>
            {Object.entries(debugInfo.queryErrors).map(([k, v]) => (
              <p key={k} className="pl-2">  {k}: <span className="text-red-300">{v}</span></p>
            ))}
          </>}
        </div>
      ) : !loadError && (
        <div className="bg-slate-900 text-yellow-400 rounded-xl p-4 font-mono text-xs">
          <p>⚠️ debugInfo is null — loadData crashed before setting it</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Records', value: records.length, color: 'from-slate-500 to-slate-600' },
          { label: 'Awaiting My Signature', value: pendingAdmin, color: 'from-amber-500 to-orange-500', alert: pendingAdmin > 0 },
          { label: 'Pending Drive Save', value: pendingDrive, color: 'from-purple-500 to-indigo-500' },
          { label: 'Active Records', value: active, color: 'from-emerald-500 to-green-500' },
        ].map(s => (
          <Card key={s.label} className={`border-0 shadow-md ${s.alert ? 'ring-2 ring-amber-400' : ''}`}>
            <CardContent className="p-4">
              <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${s.color} flex items-center justify-center mb-2`}>
                <FileText className="h-4 w-4 text-white" />
              </div>
              <p className="text-2xl font-bold text-slate-900">{s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pending signature alert */}
      {pendingAdmin > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <PenLine className="h-5 w-5 text-amber-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-amber-800">{pendingAdmin} record{pendingAdmin > 1 ? 's' : ''} awaiting your signature</p>
            <p className="text-sm text-amber-600">Review and sign to progress these records to students.</p>
          </div>
          <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white"
            onClick={() => setStatusFilter('awaiting_admin_signature')}>
            Review Now
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
          <SelectTrigger className="w-52">
            <SelectValue>{statusFilter === 'all' ? 'All Statuses' : statusFilter.replace(/_/g, ' ')}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="awaiting_admin_signature">Awaiting My Signature</SelectItem>
            <SelectItem value="awaiting_student_signature">Awaiting Student Signature</SelectItem>
            <SelectItem value="pending_drive_save">Pending Drive Save</SelectItem>
            <SelectItem value="active">Active</SelectItem>
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
                <TableHead>Title</TableHead>
                <TableHead>Teacher</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Signatures</TableHead>
                <TableHead>Date</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-slate-400">
                    No records found
                  </TableCell>
                </TableRow>
              ) : filtered.map(r => (
                <TableRow key={r.id} className="hover:bg-slate-50">
                  <TableCell>
                    <p className="font-medium text-slate-900">{r.student_name}</p>
                    <p className="text-xs text-slate-400">{r.student_email}</p>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-slate-800">{r.title}</p>
                    <Badge className="text-xs bg-slate-100 text-slate-600 border-0 capitalize mt-0.5">{r.category}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">{r.teacher_name}</TableCell>
                  <TableCell><RecordStatusBadge status={r.status} /></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Badge className={`text-xs border-0 gap-1 ${r.admin_signed ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-400'}`}>
                        <Shield className="h-2.5 w-2.5" />{r.admin_signed ? '✓' : '○'}
                      </Badge>
                      <Badge className={`text-xs border-0 ${r.student_signed ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                        👤 {r.student_signed ? '✓' : '○'}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-slate-500">
                    {r.created_date ? format(new Date(r.created_date), 'MMM d, yyyy') : '—'}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={createPageUrl(`RecordDetail?id=${r.id}`)}>
                        <ChevronRight className="h-4 w-4" />
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