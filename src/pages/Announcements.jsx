import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AudienceSelector from '@/components/announcements/AudienceSelector';
import {
  Megaphone, Plus, Search, Clock, CheckCircle2, FileText,
  Send, Loader2, CalendarClock, User, Users, AlertTriangle, Info, Bell
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const STATUS_CONFIG = {
  draft: { label: 'Draft', color: 'bg-slate-100 text-slate-600', icon: FileText },
  scheduled: { label: 'Scheduled', color: 'bg-amber-100 text-amber-700', icon: CalendarClock },
  sent: { label: 'Sent', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
};

function audienceLabel(a) {
  if (!a) return 'Everyone';
  if (a.scope_type === 'SCHOOL') return 'Whole School';
  if (a.scope_type === 'YEAR_GROUP') return a.year_group_name || 'Year Group';
  if (a.scope_type === 'CLASS') return a.class_name || 'Class';
  if (a.scope_type === 'TEAM') return a.team_name || 'Team';
  if (a.scope_type === 'STUDENTS') {
    const names = a.student_names || [];
    return names.length <= 2 ? names.join(', ') : `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
  }
  // legacy
  return (a.audience || '').replace(/_/g, ' ') || 'Everyone';
}

function AnnouncementCard({ announcement, onRead }) {
  const status = STATUS_CONFIG[announcement.status] || STATUS_CONFIG.draft;
  const StatusIcon = status.icon;
  return (
    <div
      className="p-4 bg-white border border-slate-200 rounded-xl hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onRead && onRead(announcement)}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="font-semibold text-slate-900">{announcement.title}</h3>
        <Badge className={`${status.color} border-0 shrink-0 flex items-center gap-1 text-xs`}>
          <StatusIcon className="h-3 w-3" />
          {status.label}
        </Badge>
      </div>
      <p className="text-sm text-slate-600 line-clamp-2 mb-3">{announcement.body || announcement.body_short}</p>
      <div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap">
        <span className="flex items-center gap-1">
          <User className="h-3 w-3" />
          {announcement.created_by}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {format(new Date(announcement.created_date || announcement.sent_at || new Date()), 'd MMM yyyy')}
        </span>
        <Badge variant="outline" className="text-xs capitalize flex items-center gap-1">
          <Users className="h-3 w-3" />
          {audienceLabel(announcement)}
        </Badge>
      </div>
    </div>
  );
}

const DEFAULT_AUDIENCE = { scopeType: 'SCHOOL' };

export default function Announcements() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);

  const [form, setForm] = useState({ title: '', body: '', audience: DEFAULT_AUDIENCE, scheduled_at: '', priority: 'normal' });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const u = await base44.auth.me();
      setUser(u);
      const profiles = await base44.entities.UserProfile.filter({ user_email: u.email });
      const p = profiles[0] || null;
      setProfile(p);

      let data = [];
      if (p?.user_type === 'student') {
        data = await base44.entities.Announcement.filter({ status: 'sent' }, '-created_date', 50);
        // Filter to only what applies to this student
        data = data.filter(a => {
          if (a.scope_type === 'SCHOOL' || !a.scope_type) return true;
          if (a.scope_type === 'STUDENTS') return (a.student_emails || []).includes(u.email);
          return true; // year/class filtering would need enrollment check
        });
      } else {
        const schoolId = p?.school_id;
        if (schoolId) {
          data = await base44.entities.Announcement.filter({ school_id: schoolId }, '-created_date', 100);
        } else {
          data = await base44.entities.Announcement.list('-created_date', 100);
        }
        // Teachers only see their own + school-wide
        if (p?.user_type === 'teacher') {
          data = data.filter(a =>
            a.created_by === u.email ||
            a.scope_type === 'SCHOOL' ||
            a.status === 'sent'
          );
        }
      }
      setAnnouncements(data || []);
    } catch (e) {
      toast.error('Failed to load announcements');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (statusOverride) => {
    if (!form.title.trim() || !form.body.trim()) { toast.error('Title and body are required'); return; }
    if (statusOverride === 'scheduled' && !form.scheduled_at) { toast.error('Please select a scheduled date/time'); return; }

    const aud = form.audience;
    // Validate audience selection
    if (aud.scopeType === 'YEAR_GROUP' && !aud.yearGroupId) { toast.error('Please select a year group'); return; }
    if (aud.scopeType === 'CLASS' && !aud.classId) { toast.error('Please select a class'); return; }
    if (aud.scopeType === 'TEAM' && !aud.teamName) { toast.error('Please select a team'); return; }
    if (aud.scopeType === 'STUDENTS' && !(aud.studentEmails?.length > 0)) { toast.error('Please select at least one student'); return; }

    setSaving(true);
    try {
      await base44.entities.Announcement.create({
        title: form.title,
        body: form.body,
        body_short: form.body.slice(0, 200),
        scope_type: aud.scopeType,
        year_group_id: aud.yearGroupId || undefined,
        year_group_name: aud.yearGroupName || undefined,
        class_id: aud.classId || undefined,
        class_name: aud.className || undefined,
        team_name: aud.teamName || undefined,
        student_emails: aud.studentEmails || undefined,
        student_names: aud.studentNames || undefined,
        status: statusOverride,
        created_by: user?.email,
        school_id: profile?.school_id || undefined,
        sent_at: statusOverride === 'sent' ? new Date().toISOString() : undefined,
        scheduled_at: statusOverride === 'scheduled' ? form.scheduled_at : undefined,
      });
      toast.success(statusOverride === 'sent' ? 'Announcement sent!' : statusOverride === 'scheduled' ? 'Announcement scheduled!' : 'Draft saved!');
      setShowCreate(false);
      setForm({ title: '', body: '', audience: DEFAULT_AUDIENCE, scheduled_at: '' });
      loadData();
    } catch (e) {
      toast.error('Failed to save announcement');
    } finally {
      setSaving(false);
    }
  };

  const handleRead = async (announcement) => {
    setSelectedAnnouncement(announcement);
    if (profile?.user_type === 'student' && user?.email) {
      try {
        await base44.entities.AnnouncementReadReceipt.create({
          announcement_id: announcement.id,
          school_id: profile?.school_id,
          user_id: user.email,
          read_at: new Date().toISOString(),
        });
      } catch (_) {}
    }
  };

  const isAdmin = profile?.user_type === 'admin';
  const isTeacher = profile?.user_type === 'teacher';
  const canCreate = isAdmin || isTeacher;

  // Default audience based on role
  const openCreate = () => {
    setForm({ title: '', body: '', audience: isAdmin ? { scopeType: 'SCHOOL' } : { scopeType: 'CLASS' }, scheduled_at: '' });
    setShowCreate(true);
  };

  const filtered = announcements.filter(a =>
    a.title?.toLowerCase().includes(search.toLowerCase()) ||
    a.body?.toLowerCase().includes(search.toLowerCase())
  );
  const byStatus = (status) => filtered.filter(a => a.status === status);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-violet-600" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Announcements</h1>
          <p className="text-slate-500 mt-1">School communications hub</p>
        </div>
        {canCreate && (
          <Button onClick={openCreate} className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 gap-2">
            <Plus className="h-4 w-4" />
            New Announcement
          </Button>
        )}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search announcements..." className="pl-10" />
      </div>

      {profile?.user_type === 'student' ? (
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <Card><CardContent className="py-16 text-center">
              <Megaphone className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-semibold text-slate-700 mb-1">No announcements yet</h3>
              <p className="text-sm text-slate-500">Check back later for school news.</p>
            </CardContent></Card>
          ) : filtered.map(a => <AnnouncementCard key={a.id} announcement={a} onRead={handleRead} />)}
        </div>
      ) : (
        <Tabs defaultValue="inbox">
          <TabsList className="mb-4">
            <TabsTrigger value="inbox">Sent ({byStatus('sent').length})</TabsTrigger>
            <TabsTrigger value="drafts">Drafts ({byStatus('draft').length})</TabsTrigger>
            <TabsTrigger value="scheduled">Scheduled ({byStatus('scheduled').length})</TabsTrigger>
          </TabsList>
          <TabsContent value="inbox" className="space-y-3">
            {byStatus('sent').length === 0 ? <EmptyState icon={CheckCircle2} msg="No sent announcements yet." /> : byStatus('sent').map(a => <AnnouncementCard key={a.id} announcement={a} onRead={handleRead} />)}
          </TabsContent>
          <TabsContent value="drafts" className="space-y-3">
            {byStatus('draft').length === 0 ? <EmptyState icon={FileText} msg="No drafts saved." /> : byStatus('draft').map(a => <AnnouncementCard key={a.id} announcement={a} onRead={handleRead} />)}
          </TabsContent>
          <TabsContent value="scheduled" className="space-y-3">
            {byStatus('scheduled').length === 0 ? <EmptyState icon={CalendarClock} msg="No scheduled announcements." /> : byStatus('scheduled').map(a => <AnnouncementCard key={a.id} announcement={a} onRead={handleRead} />)}
          </TabsContent>
        </Tabs>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Announcement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Title *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Announcement title" className="mt-1.5" />
            </div>
            <div>
              <Label>Body *</Label>
              <Textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} placeholder="Write your announcement..." className="mt-1.5 min-h-[120px] resize-none" />
            </div>
            <AudienceSelector
              value={form.audience}
              onChange={aud => setForm(f => ({ ...f, audience: aud }))}
              userType={profile?.user_type}
              userEmail={user?.email}
              schoolId={profile?.school_id}
            />
            <div>
              <Label>Priority</Label>
              <div className="flex gap-2 mt-1.5">
                {[
                  { value: 'normal', label: 'Normal', color: 'border-slate-300 text-slate-700' },
                  { value: 'important', label: '📢 Important', color: 'border-amber-400 text-amber-700 bg-amber-50' },
                  { value: 'urgent', label: '🚨 Urgent', color: 'border-red-400 text-red-700 bg-red-50' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, priority: opt.value }))}
                    className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${opt.color} ${form.priority === opt.value ? 'ring-2 ring-offset-1 ring-violet-400' : 'opacity-70 hover:opacity-100'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {form.priority !== 'normal' && (
                <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1">
                  <Bell className="h-3 w-3" />
                  Opted-in users will receive an in-app notification for this announcement.
                </p>
              )}
            </div>
            <div>
              <Label>Schedule for later (optional)</Label>
              <Input type="datetime-local" value={form.scheduled_at} onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))} className="mt-1.5" />
            </div>
          </div>
          <DialogFooter className="flex-wrap gap-2">
            <Button variant="outline" onClick={() => handleCreate('draft')} disabled={saving}>
              <FileText className="h-4 w-4 mr-2" />Save Draft
            </Button>
            {form.scheduled_at && (
              <Button variant="outline" onClick={() => handleCreate('scheduled')} disabled={saving} className="border-amber-300 text-amber-700 hover:bg-amber-50">
                <CalendarClock className="h-4 w-4 mr-2" />Schedule
              </Button>
            )}
            <Button onClick={() => handleCreate('sent')} disabled={saving} className="bg-green-600 hover:bg-green-700">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Send Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!selectedAnnouncement} onOpenChange={() => setSelectedAnnouncement(null)}>
        <DialogContent className="sm:max-w-lg">
          {selectedAnnouncement && (
            <>
              <DialogHeader><DialogTitle>{selectedAnnouncement.title}</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2">
                <div className="flex gap-2 flex-wrap">
                  <Badge className={`${STATUS_CONFIG[selectedAnnouncement.status]?.color || ''} border-0`}>
                    {STATUS_CONFIG[selectedAnnouncement.status]?.label}
                  </Badge>
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {audienceLabel(selectedAnnouncement)}
                  </Badge>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{selectedAnnouncement.body}</p>
                <div className="text-xs text-slate-400 border-t pt-3 space-y-1">
                  <p>From: {selectedAnnouncement.created_by}</p>
                  {selectedAnnouncement.sent_at && <p>Sent: {format(new Date(selectedAnnouncement.sent_at), 'PPpp')}</p>}
                  {selectedAnnouncement.scheduled_at && selectedAnnouncement.status === 'scheduled' && (
                    <p>Scheduled: {format(new Date(selectedAnnouncement.scheduled_at), 'PPpp')}</p>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmptyState({ icon: Icon, msg }) {
  return (
    <Card><CardContent className="py-12 text-center">
      <Icon className="h-10 w-10 mx-auto text-slate-300 mb-3" />
      <p className="text-slate-500">{msg}</p>
    </CardContent></Card>
  );
}