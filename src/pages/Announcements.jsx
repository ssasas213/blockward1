import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Megaphone, Plus, Search, Clock, CheckCircle2, FileText,
  Send, Loader2, AlertCircle, CalendarClock, User, Sparkles
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const SCOPE_OPTIONS = [
  { value: 'whole_school', label: 'Whole School' },
  { value: 'year_7', label: 'Year 7' },
  { value: 'year_8', label: 'Year 8' },
  { value: 'year_9', label: 'Year 9' },
  { value: 'year_10', label: 'Year 10' },
  { value: 'year_11', label: 'Year 11' },
  { value: 'staff_only', label: 'Staff Only' },
  { value: 'custom', label: 'Specific Class' },
];

const STATUS_CONFIG = {
  draft: { label: 'Draft', color: 'bg-slate-100 text-slate-600', icon: FileText },
  scheduled: { label: 'Scheduled', color: 'bg-amber-100 text-amber-700', icon: CalendarClock },
  sent: { label: 'Sent', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
};

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
      <div className="flex items-center gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-1">
          <User className="h-3 w-3" />
          {announcement.created_by}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {format(new Date(announcement.created_date || announcement.sent_at || new Date()), 'd MMM yyyy')}
        </span>
        {announcement.audience && (
          <Badge variant="outline" className="text-xs capitalize">
            {announcement.audience.replace(/_/g, ' ')}
          </Badge>
        )}
      </div>
    </div>
  );
}

export default function Announcements() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [processingScheduled, setProcessingScheduled] = useState(false);

  const [form, setForm] = useState({
    title: '',
    body: '',
    audience: 'whole_school',
    status: 'draft',
    scheduled_at: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const u = await base44.auth.me();
      setUser(u);
      const profiles = await base44.entities.UserProfile.filter({ user_email: u.email });
      const p = profiles[0] || null;
      setProfile(p);

      // Process scheduled announcements (admin only, silently)
      if (p?.user_type === 'admin') {
        processScheduled();
      }

      // Load announcements based on role
      let data = [];
      if (p?.user_type === 'student') {
        // Students see sent announcements for whole school or their year/class
        data = await base44.entities.Announcement.filter({ status: 'sent' }, '-created_date', 50);
      } else {
        // Teachers and admins see all
        const schoolId = p?.school_id;
        if (schoolId) {
          data = await base44.entities.Announcement.filter({ school_id: schoolId }, '-created_date', 100);
        } else {
          data = await base44.entities.Announcement.list('-created_date', 100);
        }
      }
      setAnnouncements(data || []);
    } catch (e) {
      console.error('Announcements load error:', e);
      toast.error('Failed to load announcements');
    } finally {
      setLoading(false);
    }
  };

  const processScheduled = async () => {
    try {
      setProcessingScheduled(true);
      await base44.functions.invoke('processScheduledAnnouncements', {});
      // Reload after processing
    } catch (_) {} finally {
      setProcessingScheduled(false);
    }
  };

  const handleCreate = async (statusOverride) => {
    if (!form.title.trim() || !form.body.trim()) {
      toast.error('Title and body are required');
      return;
    }
    if (statusOverride === 'scheduled' && !form.scheduled_at) {
      toast.error('Please select a scheduled date/time');
      return;
    }
    setSaving(true);
    try {
      await base44.entities.Announcement.create({
        title: form.title,
        body: form.body,
        body_short: form.body.slice(0, 200),
        audience: form.audience,
        status: statusOverride || form.status,
        created_by: user?.email,
        school_id: profile?.school_id || undefined,
        sent_at: statusOverride === 'sent' ? new Date().toISOString() : undefined,
        scheduled_at: statusOverride === 'scheduled' ? form.scheduled_at : undefined,
      });
      toast.success(
        statusOverride === 'sent' ? 'Announcement sent!' :
        statusOverride === 'scheduled' ? 'Announcement scheduled!' :
        'Draft saved!'
      );
      setShowCreate(false);
      setForm({ title: '', body: '', audience: 'whole_school', status: 'draft', scheduled_at: '' });
      loadData();
    } catch (e) {
      toast.error('Failed to save announcement');
    } finally {
      setSaving(false);
    }
  };

  const handleRead = async (announcement) => {
    setSelectedAnnouncement(announcement);
    // Mark as read (create receipt if student)
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

  const filtered = announcements.filter(a =>
    a.title?.toLowerCase().includes(search.toLowerCase()) ||
    a.body?.toLowerCase().includes(search.toLowerCase())
  );

  const byStatus = (status) => filtered.filter(a => a.status === status);
  const received = filtered.filter(a => a.status === 'sent');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-slate-900">Announcements</h1>
          </div>
          <p className="text-slate-500 mt-1">School communications hub</p>
        </div>
        {canCreate && (
          <Button onClick={() => setShowCreate(true)} className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 gap-2">
            <Plus className="h-4 w-4" />
            New Announcement
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search announcements..."
          className="pl-10"
        />
      </div>

      {/* Tabs */}
      {profile?.user_type === 'student' ? (
        // Students: simple list of received
        <div className="space-y-3">
          {received.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <Megaphone className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-semibold text-slate-700 mb-1">No announcements yet</h3>
                <p className="text-sm text-slate-500">Check back later for school news.</p>
              </CardContent>
            </Card>
          ) : (
            received.map(a => <AnnouncementCard key={a.id} announcement={a} onRead={handleRead} />)
          )}
        </div>
      ) : (
        <Tabs defaultValue="inbox">
          <TabsList className="mb-4">
            <TabsTrigger value="inbox">Inbox ({byStatus('sent').length})</TabsTrigger>
            <TabsTrigger value="drafts">Drafts ({byStatus('draft').length})</TabsTrigger>
            <TabsTrigger value="scheduled">Scheduled ({byStatus('scheduled').length})</TabsTrigger>
          </TabsList>

          <TabsContent value="inbox" className="space-y-3">
            {byStatus('sent').length === 0 ? (
              <Card><CardContent className="py-12 text-center">
                <CheckCircle2 className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                <p className="text-slate-500">No sent announcements yet.</p>
              </CardContent></Card>
            ) : byStatus('sent').map(a => <AnnouncementCard key={a.id} announcement={a} onRead={handleRead} />)}
          </TabsContent>

          <TabsContent value="drafts" className="space-y-3">
            {byStatus('draft').length === 0 ? (
              <Card><CardContent className="py-12 text-center">
                <FileText className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                <p className="text-slate-500">No drafts saved.</p>
              </CardContent></Card>
            ) : byStatus('draft').map(a => <AnnouncementCard key={a.id} announcement={a} onRead={handleRead} />)}
          </TabsContent>

          <TabsContent value="scheduled" className="space-y-3">
            {byStatus('scheduled').length === 0 ? (
              <Card><CardContent className="py-12 text-center">
                <CalendarClock className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                <p className="text-slate-500">No scheduled announcements.</p>
              </CardContent></Card>
            ) : byStatus('scheduled').map(a => <AnnouncementCard key={a.id} announcement={a} onRead={handleRead} />)}
          </TabsContent>
        </Tabs>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Announcement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Title *</Label>
              <Input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Announcement title"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Body *</Label>
              <Textarea
                value={form.body}
                onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                placeholder="Write your announcement..."
                className="mt-1.5 min-h-[120px] resize-none"
              />
            </div>
            <div>
              <Label>Audience</Label>
              <Select value={form.audience} onValueChange={v => setForm(f => ({ ...f, audience: v }))}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCOPE_OPTIONS.filter(o => isAdmin || o.value !== 'whole_school').map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Schedule for later (optional)</Label>
              <Input
                type="datetime-local"
                value={form.scheduled_at}
                onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))}
                className="mt-1.5"
              />
            </div>
          </div>
          <DialogFooter className="flex-wrap gap-2">
            <Button variant="outline" onClick={() => handleCreate('draft')} disabled={saving}>
              <FileText className="h-4 w-4 mr-2" />
              Save Draft
            </Button>
            {form.scheduled_at && (
              <Button variant="outline" onClick={() => handleCreate('scheduled')} disabled={saving} className="border-amber-300 text-amber-700 hover:bg-amber-50">
                <CalendarClock className="h-4 w-4 mr-2" />
                Schedule
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
              <DialogHeader>
                <DialogTitle>{selectedAnnouncement.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="flex gap-2 flex-wrap">
                  <Badge className={`${STATUS_CONFIG[selectedAnnouncement.status]?.color || ''} border-0`}>
                    {STATUS_CONFIG[selectedAnnouncement.status]?.label}
                  </Badge>
                  {selectedAnnouncement.audience && (
                    <Badge variant="outline" className="capitalize">
                      {selectedAnnouncement.audience.replace(/_/g, ' ')}
                    </Badge>
                  )}
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