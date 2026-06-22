import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, ChevronRight, PenLine, Trophy, Clock, HardDrive } from 'lucide-react';
import { format } from 'date-fns';
import RecordStatusBadge from '@/components/records/RecordStatusBadge';
import { toast } from 'sonner';

export default function TeacherRecords() {
  const [records, setRecords] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('awaiting_teacher_signature');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const user = await base44.auth.me();
      const profiles = await base44.entities.UserProfile.filter({ user_email: user.email });
      const p = profiles[0];
      setProfile(p);
      if (!p?.school_id) return;

      // Teachers see records specifically sent to them OR from students in their assigned classes
      const classes = await base44.entities.Class.filter({ teacher_email: user.email });
      const assignedStudentEmails = new Set();
      classes.forEach(cls => (cls.student_emails || []).forEach(e => assignedStudentEmails.add(e)));

      const allRecs = await base44.entities.StudentRecord.filter({ school_id: p.school_id }, '-created_date');
      // Filter to only assigned students (or records the teacher has already signed — keep those visible)
      const filtered = allRecs.filter(r =>
        assignedStudentEmails.has(r.student_email) || r.teacher_email === user.email
      );
      setRecords(filtered);
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

  const pendingReview = records.filter(r => r.status === 'awaiting_teacher_signature').length;
  const sentToMe = records.filter(r => r.teacher_email === profile?.user_email && r.status === 'awaiting_teacher_signature').length;
  const myApproved = records.filter(r => r.teacher_email === profile?.user_email && r.teacher_signed).length;
  const minted = records.filter(r => r.status === 'minted' || r.status === 'archived').length;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="h-8 w-8 rounded-full border-4 border-violet-600 border-t-transparent animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Student Achievements</h1>
        <p className="text-slate-500 mt-1">Review, sign, and endorse student achievement submissions</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Sent to Me', value: sentToMe, color: 'text-violet-600', alert: sentToMe > 0 },
          { label: 'Awaiting Review', value: pendingReview, color: 'text-amber-600' },
          { label: 'I\'ve Approved', value: myApproved, color: 'text-emerald-600' },
          { label: 'Minted as NFTs', value: minted, color: 'text-violet-600' },
        ].map(s => (
          <Card key={s.label} className={`border-0 shadow-md ${s.alert ? 'ring-2 ring-violet-400' : ''}`}>
            <CardContent className="p-4 text-center">
              <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-500 mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pending review alert */}
      {sentToMe > 0 && (
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 flex items-center gap-3">
          <PenLine className="h-5 w-5 text-violet-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-violet-800">{sentToMe} achievement{sentToMe > 1 ? 's' : ''} sent directly to you for validation</p>
            <p className="text-sm text-violet-600">Review student submissions and sign to forward to admin for final authorisation.</p>
          </div>
          <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white"
            onClick={() => setStatusFilter('awaiting_teacher_signature')}>
            Review Now
          </Button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by student or title..." className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-52">
            <SelectValue>{statusFilter === 'all' ? 'All Statuses' : statusFilter.replace(/_/g, ' ')}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="awaiting_teacher_signature">Awaiting My Review</SelectItem>
            <SelectItem value="awaiting_admin_signature">Awaiting Admin</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="minted">Minted</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
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
                <TableHead>Achievement</TableHead>
                <TableHead>Evidence</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-slate-400">
                    <Trophy className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p>No submissions yet</p>
                  </TableCell>
                </TableRow>
              ) : filtered.map(r => (
                <TableRow key={r.id} className={`hover:bg-slate-50 ${r.status === 'awaiting_teacher_signature' ? 'bg-amber-50/40' : ''}`}>
                  <TableCell>
                    <p className="font-medium">{r.student_name}</p>
                    <p className="text-xs text-slate-400">{r.student_email}</p>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-slate-800">{r.title}</p>
                    <Badge className="text-xs bg-slate-100 text-slate-600 border-0 capitalize mt-0.5">{r.category}</Badge>
                  </TableCell>
                  <TableCell>
                    {r.file_url
                      ? r.file_url.match(/\.(jpg|jpeg|png|gif|webp)$/i)
                        ? <img src={r.file_url} alt="evidence" className="h-10 w-10 rounded-lg object-cover border" />
                        : <Badge className="bg-blue-50 text-blue-600 border-0 text-xs">File attached</Badge>
                      : <span className="text-xs text-slate-400">None</span>
                    }
                  </TableCell>
                  <TableCell>
                    <RecordStatusBadge status={r.status} />
                    {r.drive_file_url && (
                      <a href={r.drive_file_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-emerald-600 hover:underline mt-1">
                        <HardDrive className="h-3 w-3" /> View in Drive
                      </a>
                    )}
                    {r.verify_id && (
                      <p className="text-xs text-slate-400 mt-0.5 font-mono">{r.verify_id}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-slate-500">
                    {r.created_date ? format(new Date(r.created_date), 'MMM d, yyyy') : '—'}
                  </TableCell>
                  <TableCell>
                    <Button variant={r.status === 'awaiting_teacher_signature' ? 'default' : 'ghost'} size="sm" asChild
                      className={r.status === 'awaiting_teacher_signature' ? 'bg-violet-600 hover:bg-violet-700' : ''}>
                      <Link to={createPageUrl(`RecordDetail?id=${r.id}`)}>
                        {r.status === 'awaiting_teacher_signature' ? 'Review' : <ChevronRight className="h-4 w-4" />}
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