import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, ChevronRight, FileText } from 'lucide-react';
import { format } from 'date-fns';
import RecordStatusBadge from '@/components/records/RecordStatusBadge';
import CreateRecordDialog from '@/components/records/CreateRecordDialog';
import { toast } from 'sonner';

export default function TeacherRecords() {
  const [records, setRecords] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const user = await base44.auth.me();
      const profiles = await base44.entities.UserProfile.filter({ user_email: user.email });
      const p = profiles[0];
      setProfile(p);
      if (!p) return;

      // Teacher only sees records they created, scoped to their school
      const recs = await base44.entities.StudentRecord.filter({
        teacher_email: user.email,
        school_id: p.school_id
      }, '-created_date');
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
      r.title?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const draft = records.filter(r => r.status === 'draft').length;
  const pending = records.filter(r => ['submitted', 'awaiting_admin_signature', 'awaiting_student_signature'].includes(r.status)).length;
  const active = records.filter(r => r.status === 'active').length;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="h-8 w-8 rounded-full border-4 border-violet-600 border-t-transparent animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">My Student Records</h1>
          <p className="text-slate-500 mt-1">Create and track digital custodian records for your students</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700">
          <Plus className="h-4 w-4 mr-2" /> New Record
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: records.length, color: 'text-slate-600' },
          { label: 'Drafts', value: draft, color: 'text-slate-400' },
          { label: 'In Progress', value: pending, color: 'text-amber-600' },
          { label: 'Active', value: active, color: 'text-emerald-600' },
        ].map(s => (
          <Card key={s.label} className="border-0 shadow-md">
            <CardContent className="p-4 text-center">
              <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-500 mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by student or title..." className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="awaiting_admin_signature">Awaiting Admin</SelectItem>
            <SelectItem value="awaiting_student_signature">Awaiting Student</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="border-0 shadow-md">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Title / Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-slate-400">
                    <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p>No records yet</p>
                    <Button variant="outline" className="mt-3" onClick={() => setShowCreate(true)}>
                      <Plus className="h-4 w-4 mr-2" /> Create First Record
                    </Button>
                  </TableCell>
                </TableRow>
              ) : filtered.map(r => (
                <TableRow key={r.id} className="hover:bg-slate-50">
                  <TableCell>
                    <p className="font-medium">{r.student_name}</p>
                    <p className="text-xs text-slate-400">{r.class_name || '—'}</p>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-slate-800">{r.title}</p>
                    <Badge className="text-xs bg-slate-100 text-slate-600 border-0 capitalize">{r.category}</Badge>
                  </TableCell>
                  <TableCell><RecordStatusBadge status={r.status} /></TableCell>
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

      <CreateRecordDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        teacherProfile={profile}
        onCreated={loadData}
      />
    </div>
  );
}