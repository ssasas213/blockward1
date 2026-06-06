import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, PenLine, HardDrive, FileText, Shield, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import RecordStatusBadge from '@/components/records/RecordStatusBadge';
import { toast } from 'sonner';

export default function StudentMyRecords() {
  const [records, setRecords] = useState([]);
  const [profile, setProfile] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      const profiles = await base44.entities.UserProfile.filter({ user_email: currentUser.email });
      const p = profiles[0];
      setProfile(p);

      // Students ONLY see their own records — enforced by email
      const recs = await base44.entities.StudentRecord.filter({
        student_email: currentUser.email,
        school_id: p?.school_id
      }, '-created_date');
      setRecords(recs);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const awaitingMySignature = records.filter(r =>
    r.status === 'awaiting_student_signature' && !r.student_signed
  );
  const activeRecords = records.filter(r => r.status === 'active');
  const driveRecords = records.filter(r => r.drive_file_url);

  const CATEGORY_COLORS = {
    academic: 'from-blue-500 to-indigo-500',
    sports: 'from-green-500 to-emerald-500',
    arts: 'from-pink-500 to-rose-500',
    leadership: 'from-purple-500 to-violet-500',
    community: 'from-amber-500 to-orange-500',
    behaviour: 'from-red-500 to-rose-500',
    special: 'from-indigo-500 to-purple-500',
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="h-8 w-8 rounded-full border-4 border-violet-600 border-t-transparent animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">My Records</h1>
        <p className="text-slate-500 mt-1">Your digital custodian records and awards from {profile?.grade_level || 'school'}</p>
      </div>

      {/* Signature action needed */}
      {awaitingMySignature.length > 0 && (
        <div className="bg-orange-50 border-2 border-orange-300 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <PenLine className="h-5 w-5 text-orange-600" />
            <p className="font-semibold text-orange-800">{awaitingMySignature.length} record{awaitingMySignature.length > 1 ? 's' : ''} awaiting your signature</p>
          </div>
          <div className="space-y-2">
            {awaitingMySignature.map(r => (
              <Link key={r.id} to={createPageUrl(`RecordDetail?id=${r.id}`)}
                className="flex items-center justify-between bg-white rounded-lg p-3 hover:shadow-md transition-shadow">
                <div>
                  <p className="font-medium text-slate-800">{r.title}</p>
                  <p className="text-xs text-slate-500">From: {r.teacher_name}</p>
                </div>
                <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white gap-1">
                  <PenLine className="h-3.5 w-3.5" /> Sign Now
                </Button>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Records', value: records.length, icon: FileText, color: 'bg-slate-100 text-slate-600' },
          { label: 'Need Signature', value: awaitingMySignature.length, icon: PenLine, color: 'bg-orange-100 text-orange-600' },
          { label: 'Active Records', value: activeRecords.length, icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-600' },
          { label: 'Saved to Drive', value: driveRecords.length, icon: HardDrive, color: 'bg-purple-100 text-purple-600' },
        ].map(s => (
          <Card key={s.label} className="border-0 shadow-md">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl ${s.color} flex items-center justify-center flex-shrink-0`}>
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{s.value}</p>
                <p className="text-xs text-slate-500">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Active Records Showcase */}
      {activeRecords.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-3">Active Records</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeRecords.map(r => (
              <Link key={r.id} to={createPageUrl(`RecordDetail?id=${r.id}`)}>
                <Card className="border-0 shadow-md hover:shadow-xl transition-shadow h-full">
                  <div className={`h-2 rounded-t-lg bg-gradient-to-r ${CATEGORY_COLORS[r.category] || 'from-slate-400 to-slate-500'}`} />
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <Badge className="text-xs bg-slate-100 text-slate-600 border-0 capitalize">{r.category}</Badge>
                      <div className="flex gap-1">
                        {r.admin_signed && <Shield className="h-3.5 w-3.5 text-violet-600" title="Admin signed" />}
                        {r.student_signed && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" title="Student signed" />}
                        {r.drive_file_url && <HardDrive className="h-3.5 w-3.5 text-purple-600" title="Saved to Drive" />}
                      </div>
                    </div>
                    <p className="font-semibold text-slate-900 mb-1">{r.title}</p>
                    {r.description && <p className="text-xs text-slate-500 line-clamp-2 mb-3">{r.description}</p>}
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>By {r.teacher_name}</span>
                      <span>{r.created_date ? format(new Date(r.created_date), 'MMM d, yyyy') : ''}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* All Records List */}
      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-3">All Records</h2>
        {records.length === 0 ? (
          <Card className="border-0 shadow-md">
            <CardContent className="py-16 text-center text-slate-400">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No records yet</p>
              <p className="text-sm">Your teacher will create records for your achievements</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {records.map(r => (
              <Link key={r.id} to={createPageUrl(`RecordDetail?id=${r.id}`)}>
                <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${CATEGORY_COLORS[r.category] || 'from-slate-400 to-slate-500'} flex items-center justify-center flex-shrink-0`}>
                      <FileText className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 truncate">{r.title}</p>
                      <p className="text-xs text-slate-500">By {r.teacher_name} · {r.created_date ? format(new Date(r.created_date), 'MMM d, yyyy') : ''}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <RecordStatusBadge status={r.status} />
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Drive section */}
      {driveRecords.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-purple-600" /> Saved Documents
          </h2>
          <div className="space-y-2">
            {driveRecords.map(r => (
              <Card key={r.id} className="border-0 shadow-sm">
                <CardContent className="p-4 flex items-center gap-4">
                  <HardDrive className="h-5 w-5 text-purple-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 truncate">{r.title}</p>
                    <p className="text-xs text-slate-400 truncate">{r.drive_folder_path}</p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <a href={r.drive_file_url} target="_blank" rel="noopener noreferrer">View</a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}