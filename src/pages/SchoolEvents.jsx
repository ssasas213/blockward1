import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Calendar, Plus, MapPin, Clock, Search, Trash2, Loader2, Upload } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import ImportCalendarDialog from '@/components/events/ImportCalendarDialog';

const AUDIENCE_OPTIONS = [
  { value: 'whole_school', label: 'Whole School' },
  { value: 'year_7', label: 'Year 7' },
  { value: 'year_8', label: 'Year 8' },
  { value: 'year_9', label: 'Year 9' },
  { value: 'year_10', label: 'Year 10' },
  { value: 'year_11', label: 'Year 11' },
  { value: 'staff_only', label: 'Staff Only' },
];

export default function SchoolEvents() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [form, setForm] = useState({
    title: '',
    start_time: '',
    end_time: '',
    location: '',
    audience: 'whole_school',
    notes: '',
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

      const schoolId = p?.school_id;
      let eventsData;
      if (schoolId) {
        eventsData = await base44.entities.Event.filter({ school_id: schoolId }, '-start_time', 100);
      } else {
        eventsData = await base44.entities.Event.list('-start_time', 100);
      }
      setEvents(eventsData || []);
    } catch (e) {
      toast.error('Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!form.title || !form.start_time) {
      toast.error('Title and start time are required');
      return;
    }
    setSaving(true);
    try {
      await base44.entities.Event.create({
        ...form,
        school_id: profile?.school_id,
        created_by: user?.email,
      });
      toast.success('Event added to school calendar!');
      setShowCreate(false);
      setForm({ title: '', start_time: '', end_time: '', location: '', audience: 'whole_school', notes: '' });
      loadData();
    } catch (e) {
      toast.error('Failed to create event');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (eventId) => {
    try {
      await base44.entities.Event.delete(eventId);
      setEvents(prev => prev.filter(e => e.id !== eventId));
      toast.success('Event deleted');
    } catch (e) {
      toast.error('Failed to delete event');
    }
  };

  const canCreate = profile?.user_type === 'admin' || profile?.user_type === 'teacher';
  const canDelete = profile?.user_type === 'admin';

  const filtered = events.filter(e =>
    e.title?.toLowerCase().includes(search.toLowerCase()) ||
    e.location?.toLowerCase().includes(search.toLowerCase())
  );

  const upcoming = filtered.filter(e => new Date(e.start_time) >= new Date());
  const past = filtered.filter(e => new Date(e.start_time) < new Date());

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
          <h1 className="text-3xl font-bold text-slate-900">School Events</h1>
          <p className="text-slate-500 mt-1">School calendar & events — visible to BlockWard AI</p>
        </div>
        {canCreate && (
          <Button onClick={() => setShowCreate(true)} className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 gap-2">
            <Plus className="h-4 w-4" />
            Add Event
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search events..." className="pl-10" />
      </div>

      {/* Upcoming */}
      <div>
        <h2 className="text-lg font-semibold text-slate-700 mb-3">Upcoming ({upcoming.length})</h2>
        {upcoming.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Calendar className="h-10 w-10 mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500">No upcoming events. Add some to let BlockWard AI know about them!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {upcoming.map(ev => (
              <EventCard key={ev.id} event={ev} onDelete={canDelete ? handleDelete : null} />
            ))}
          </div>
        )}
      </div>

      {/* Past */}
      {past.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-500 mb-3">Past ({past.length})</h2>
          <div className="space-y-3 opacity-60">
            {past.slice(0, 5).map(ev => (
              <EventCard key={ev.id} event={ev} onDelete={canDelete ? handleDelete : null} />
            ))}
          </div>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add School Event</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Event Title *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Year 9 Sports Day" className="mt-1.5" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start Date & Time *</Label>
                <Input type="datetime-local" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} className="mt-1.5" />
              </div>
              <div>
                <Label>End Time (optional)</Label>
                <Input type="datetime-local" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} className="mt-1.5" />
              </div>
            </div>
            <div>
              <Label>Location</Label>
              <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Main Hall" className="mt-1.5" />
            </div>
            <div>
              <Label>Audience</Label>
              <Select value={form.audience} onValueChange={v => setForm(f => ({ ...f, audience: v }))}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AUDIENCE_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Additional details..." className="mt-1.5 resize-none" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving} className="bg-violet-600 hover:bg-violet-700">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Add Event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EventCard({ event, onDelete }) {
  const audienceLabel = event.audience?.replace(/_/g, ' ') || 'Whole School';
  return (
    <div className="p-4 bg-white border border-slate-200 rounded-xl hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h3 className="font-semibold text-slate-900 mb-2">{event.title}</h3>
          <div className="flex flex-wrap gap-3 text-sm text-slate-500">
            {event.start_time && (
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {format(new Date(event.start_time), 'EEE d MMM yyyy, HH:mm')}
                {event.end_time && ` – ${format(new Date(event.end_time), 'HH:mm')}`}
              </span>
            )}
            {event.location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                {event.location}
              </span>
            )}
          </div>
          {event.notes && <p className="text-sm text-slate-500 mt-2">{event.notes}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="outline" className="text-xs capitalize">{audienceLabel}</Badge>
          {onDelete && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500" onClick={() => onDelete(event.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}