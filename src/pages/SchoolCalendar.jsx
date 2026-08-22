import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/ui/page-header';
import EmptyState from '@/components/ui/empty-state';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, MapPin, BookOpen, Users } from 'lucide-react';
import { format, isToday, isTomorrow, isThisWeek, parseISO } from 'date-fns';
import { useSchool } from '@/lib/SchoolContext';

const TYPE_META = {
  assembly: { label: 'Assembly', color: 'bg-primary/10 text-primary' },
  event: { label: 'Event', color: 'bg-info/10 text-info' },
  holiday: { label: 'Holiday', color: 'bg-success/10 text-success' },
  exam_period: { label: 'Exams', color: 'bg-warning/15 text-warning' },
  deadline: { label: 'Deadline', color: 'bg-destructive/15 text-destructive' },
  assignment: { label: 'Assignment Due', color: 'bg-accent/15 text-accent' },
};

export default function SchoolCalendar() {
  const { profile, user } = useSchool();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [assignments, setAssignments] = useState([]);

  useEffect(() => {
    const schoolId = profile?.school_id;
    if (!schoolId) { setLoading(false); return; }
    Promise.all([
      base44.entities.Event.filter({ school_id: schoolId }, '-start_time', 100).catch(() => []),
      base44.functions.invoke('assignmentData', {}).catch(() => ({ data: { ok: false } })),
    ]).then(([ev, aRes]) => {
      setEvents(ev || []);
      if (aRes.data?.ok) setAssignments(aRes.data.data?.assignments || []);
    }).finally(() => setLoading(false));
  }, [profile?.school_id]);

  const items = useMemo(() => {
    const now = new Date();
    const evItems = events.filter(e => e.start_time && new Date(e.start_time) >= now && e.status !== 'cancelled').map(e => ({
      id: e.id, title: e.title, date: new Date(e.start_time), type: e.event_type || 'event', location: e.location, audience: e.audience, organiser: e.organiser,
    }));
    const aItems = (assignments || []).filter(a => a.due_date && a.status === 'published' && new Date(a.due_date) >= now).map(a => ({
      id: `a-${a.id}`, title: a.title, date: parseISO(a.due_date), type: 'assignment', subject: a.subject, class_name: a.class_name,
    }));
    return [...evItems, ...aItems].sort((a, b) => a.date - b.date);
  }, [events, assignments]);

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader title="School Calendar" description="Assemblies, events, and assignment deadlines in one view" />
      {items.length === 0 ? (
        <EmptyState icon={Calendar} title="Nothing scheduled" description="Upcoming assemblies, events, and assignment deadlines will appear here." />
      ) : (
        <div className="space-y-2">
          {items.map(item => <CalendarRow key={item.id} item={item} />)}
        </div>
      )}
    </div>
  );
}

function CalendarRow({ item }) {
  const meta = TYPE_META[item.type] || TYPE_META.event;
  const dateLabel = isToday(item.date) ? 'Today' : isTomorrow(item.date) ? 'Tomorrow' : format(item.date, 'EEE d MMM');
  return (
    <Card className="surface-card card-hover">
      <CardContent className="pt-4 pb-4 flex items-center gap-4">
        <div className="text-center min-w-[64px]">
          <p className="text-xs text-muted-foreground">{dateLabel}</p>
          <p className="text-lg font-bold text-foreground leading-tight">{format(item.date, 'HH:mm' === format(item.date, 'HH:mm') && item.type !== 'assignment' ? 'HH:mm' : 'd')}</p>
        </div>
        <div className="w-px h-10 bg-border" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge className={`text-[10px] ${meta.color}`}>{meta.label}</Badge>
          </div>
          <p className="font-medium text-foreground text-sm truncate">{item.title}</p>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-1">
            {item.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{item.location}</span>}
            {item.subject && <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" />{item.subject}</span>}
            {item.class_name && <span className="flex items-center gap-1"><Users className="h-3 w-3" />{item.class_name}</span>}
            {item.organiser && <span className="flex items-center gap-1">· {item.organiser}</span>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}