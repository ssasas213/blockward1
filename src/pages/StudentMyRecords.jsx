import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronRight, Plus, Upload, FileText, Sparkles, Trophy, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import RecordStatusBadge from '@/components/records/RecordStatusBadge';
import { toast } from 'sonner';
import { useSchool } from '@/lib/SchoolContext';

const CATEGORIES = ['academic', 'sports', 'arts', 'leadership', 'community', 'behaviour', 'special'];

const CATEGORY_COLORS = {
  academic: 'from-blue-500 to-indigo-500',
  sports: 'from-green-500 to-emerald-500',
  arts: 'from-purple-500 to-fuchsia-500',
  leadership: 'from-amber-500 to-orange-500',
  community: 'from-rose-500 to-pink-500',
  behaviour: 'from-red-500 to-rose-500',
  special: 'from-violet-500 to-purple-500',
};

import RoleGuard from '@/components/auth/RoleGuard';
export default function StudentMyRecords() { return <RoleGuard roles={['student']}><StudentMyRecordsImpl/></RoleGuard>; }
function StudentMyRecordsImpl() {
  const { testMode } = useSchool();
  const [records, setRecords] = useState([]);
  const [profile, setProfile] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSubmit, setShowSubmit] = useState(false);
  const [form, setForm] = useState({ title: '', category: 'academic', description: '', date_achieved: '', teacher_email: '' });
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [teachers, setTeachers] = useState([]);
  const [deliveredAchievements, setDeliveredAchievements] = useState([]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      const profiles = await base44.entities.UserProfile.filter({ user_email: currentUser.email });
      const p = profiles[0];
      setProfile(p);

      // Fetch all student records (direct, for showing pending/in-progress submissions)
      const effectiveEmail = testMode?.isTestSuperUser && testMode.effectiveEmail ? testMode.effectiveEmail : currentUser.email;
      const recordFilter = { student_email: effectiveEmail };
      if (p?.school_id) recordFilter.school_id = p.school_id;
      const recs = await base44.entities.StudentRecord.filter(recordFilter, '-created_date');
      setRecords(recs);

      // Fetch DELIVERED achievements via the shared vault loader — same source as
      // Dashboard, My BlockWards, and Portfolio Vault. This guarantees the
      // "Minted NFTs" count matches every other page.
      try {
        const vaultRes = await base44.functions.invoke('getStudentVault', {});
        if (vaultRes.data?.ok) {
          setDeliveredAchievements(vaultRes.data.achievements || []);
        }
      } catch (e) { /* shared loader error — counts will show 0 */ }

      // Fetch available teachers in the school for validation
      if (p?.school_id) {
        const schoolTeachers = await base44.entities.UserProfile.filter({
          school_id: p.school_id,
          user_type: 'teacher',
          status: 'active'
        });
        setTeachers(schoolTeachers);
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitNew = async () => {
    if (!form.title || !form.category) {
      toast.error('Please fill in title and category');
      return;
    }
    if (!form.teacher_email) {
      toast.error('Please select a teacher to validate your achievement');
      return;
    }
    setSaving(true);
    try {
      let fileUrl = null;
      if (file) {
        setUploading(true);
        const result = await base44.integrations.Core.UploadFile({ file });
        fileUrl = result.file_url;
        setUploading(false);
      }

      const selectedTeacher = teachers.find(t => t.user_email === form.teacher_email);
      const teacherName = selectedTeacher ? `${selectedTeacher.first_name} ${selectedTeacher.last_name}` : '';

      // Create as draft. In Test Mode, route through the service-role createTestRecord
      // function so the record is owned by the active student persona (RLS would block
      // a direct create whose student_email is the persona email).
      let record;
      if (testMode?.isTestSuperUser) {
        const res = await base44.functions.invoke('createTestRecord', {
          title: form.title, category: form.category, description: form.description,
          date_achieved: form.date_achieved || null, file_url: fileUrl,
          teacher_email: form.teacher_email, teacher_name: teacherName,
        });
        if (!res.data?.ok) throw new Error(res.data?.error || 'Failed to create record');
        record = res.data.record;
      } else {
        // Entity create is locked to service role — route through the function
        // (validates the chosen teacher, sets student/owner fields from the caller).
        const createRes = await base44.functions.invoke('createStudentRecord', {
          title: form.title, category: form.category, description: form.description,
          date_achieved: form.date_achieved || null, file_url: fileUrl,
          teacher_email: form.teacher_email,
        });
        if (!createRes.data?.ok) throw new Error(createRes.data?.error || 'Failed to create record');
        record = createRes.data.record;
      }

      // Submit through the workflow — creates the audit log server-side, no client-side audit
      const submitRes = await base44.functions.invoke('recordWorkflow', {
        action: 'submitRecord',
        recordId: record.id,
      });
      if (!submitRes.data?.ok) throw new Error(submitRes.data?.error || 'Failed to submit record');

      toast.success('Achievement sent to teacher for validation!');
      setShowSubmit(false);
      setForm({ title: '', category: 'academic', description: '', date_achieved: '', teacher_email: '' });
      setFile(null);
      loadData();
    } catch (e) {
      toast.error('Failed: ' + e.message);
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  // Use the shared vault loader for delivered achievements — same count as Dashboard,
  // My BlockWards, and Portfolio Vault.
  const mintedRecords = deliveredAchievements;
  const pendingRecords = records.filter(r => !['delivered_to_vault', 'archived', 'rejected'].includes(r.status));

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="h-8 w-8 rounded-full border-4 border-violet-600 border-t-transparent animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">My Achievements</h1>
          <p className="text-slate-500 mt-1">Submit your achievements to get them verified and minted as NFTs</p>
        </div>
        <Button onClick={() => setShowSubmit(true)} className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700">
          <Plus className="h-4 w-4 mr-2" /> Submit Achievement
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: records.length, color: 'bg-slate-100 text-slate-600' },
          { label: 'In Progress', value: pendingRecords.length, color: 'bg-amber-100 text-amber-700' },
          { label: 'Minted NFTs', value: mintedRecords.length, color: 'bg-violet-100 text-violet-700' },
          { label: 'Rejected', value: records.filter(r => r.status === 'rejected').length, color: 'bg-red-100 text-red-600' },
        ].map(s => (
          <Card key={s.label} className="border-0 shadow-md">
            <CardContent className="p-4 text-center">
              <p className={`text-3xl font-bold ${s.color.split(' ')[1]}`}>{s.value}</p>
              <p className="text-xs text-slate-500 mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Minted NFTs showcase */}
      {mintedRecords.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-600" /> My NFT Achievements
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mintedRecords.map(r => (
              <Link key={r.id} to={createPageUrl(`RecordDetail?id=${r.id}`)}>
                <Card className="border-0 shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden">
                  {r.nft_image_url ? (
                    <img src={r.nft_image_url} alt={r.title} className="w-full h-40 object-cover" />
                  ) : (
                    <div className={`h-40 bg-gradient-to-br ${CATEGORY_COLORS[r.category] || 'from-slate-400 to-slate-500'} flex items-center justify-center`}>
                      <Trophy className="h-16 w-16 text-white/80" />
                    </div>
                  )}
                  <CardContent className="p-4">
                    <p className="font-bold text-slate-900 mb-1">{r.title}</p>
                    <p className="text-xs text-slate-500 mb-2">{r.description?.slice(0, 80)}{r.description?.length > 80 ? '...' : ''}</p>
                    <div className="flex items-center justify-between">
                      <Badge className="text-xs bg-violet-100 text-violet-700 border-0 capitalize">{r.category}</Badge>
                      <span className="text-xs text-slate-400">{r.minted_at ? format(new Date(r.minted_at), 'MMM d, yyyy') : ''}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* All Records */}
      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-3">All Submissions</h2>
        {records.length === 0 ? (
          <Card className="border-0 shadow-md">
            <CardContent className="py-16 text-center text-slate-400">
              <Trophy className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="font-medium text-slate-600">No achievements yet</p>
              <p className="text-sm mb-4">Submit your first achievement to get it verified and minted as an NFT</p>
              <Button onClick={() => setShowSubmit(true)} className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700">
                <Plus className="h-4 w-4 mr-2" /> Submit Achievement
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {records.map(r => (
              <Link key={r.id} to={createPageUrl(`RecordDetail?id=${r.id}`)}>
                <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${CATEGORY_COLORS[r.category] || 'from-slate-400 to-slate-500'} flex items-center justify-center flex-shrink-0`}>
                      {r.file_url && r.file_url.match(/\.(jpg|jpeg|png|gif|webp)$/i)
                        ? <img src={r.file_url} alt="" className="h-full w-full object-cover rounded-xl" />
                        : <Trophy className="h-6 w-6 text-white" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{r.title}</p>
                      <p className="text-xs text-slate-500 capitalize">{r.category} · {r.created_date ? format(new Date(r.created_date), 'MMM d, yyyy') : ''}</p>
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

      {/* Submit Achievement Dialog */}
      <Dialog open={showSubmit} onOpenChange={setShowSubmit}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-violet-600" /> Submit Achievement
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Achievement Title *</Label>
              <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. First Place — Regional Math Olympiad" />
            </div>
            <div className="space-y-2">
              <Label>Category *</Label>
              <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Send to Teacher for Validation *</Label>
              <p className="text-xs text-slate-500">Choose which teacher should review and endorse your achievement</p>
              <Select value={form.teacher_email} onValueChange={v => setForm({ ...form, teacher_email: v })}>
                <SelectTrigger><SelectValue placeholder="Select a teacher..." /></SelectTrigger>
                <SelectContent>
                  {teachers.length === 0 ? (
                    <SelectItem value="_none" disabled>No teachers available</SelectItem>
                  ) : teachers.map(t => (
                    <SelectItem key={t.user_email} value={t.user_email}>
                      {t.first_name} {t.last_name}{t.department ? ` — ${t.department}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date Achieved</Label>
              <Input type="date" value={form.date_achieved} onChange={e => setForm({ ...form, date_achieved: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                rows={3} placeholder="Describe your achievement in detail..." />
            </div>
            <div className="space-y-2">
              <Label>Evidence *</Label>
              <p className="text-xs text-slate-500">Upload a certificate, photo, screenshot, or any proof of your achievement</p>
              <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center cursor-pointer hover:border-violet-300 transition-colors"
                onClick={() => document.getElementById('achievement-file').click()}>
                {file ? (
                  <div>
                    <p className="text-sm font-medium text-violet-600">{file.name}</p>
                    <p className="text-xs text-slate-400 mt-1">Click to change</p>
                  </div>
                ) : (
                  <div>
                    <Upload className="h-8 w-8 mx-auto text-slate-400 mb-2" />
                    <p className="text-sm text-slate-500">Click to upload image, certificate, or document</p>
                    <p className="text-xs text-slate-400 mt-1">JPG, PNG, PDF supported</p>
                  </div>
                )}
                <input id="achievement-file" type="file" accept="image/*,.pdf,.doc,.docx" className="hidden"
                  onChange={e => setFile(e.target.files[0])} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmit(false)}>Cancel</Button>
            <Button onClick={handleSubmitNew} disabled={saving || uploading} className="bg-gradient-to-r from-violet-600 to-indigo-600">
              {(saving || uploading) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {uploading ? 'Uploading...' : 'Submit Achievement'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}