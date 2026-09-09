import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Megaphone, Pin, PinOff, CalendarClock, Paperclip, FileText,
  ClipboardList, Award, ExternalLink, MessageSquare,
} from 'lucide-react';
import { format } from 'date-fns';
import CommentSection from './CommentSection';

const KIND_META = {
  announcement: { icon: Megaphone, label: 'Announcement', tone: 'bg-primary/10 text-primary' },
  assignment: { icon: ClipboardList, label: 'Assignment', tone: 'bg-info/10 text-info' },
  material: { icon: FileText, label: 'Material', tone: 'bg-secondary text-secondary-foreground' },
  grade: { icon: Award, label: 'Grades returned', tone: 'bg-success/10 text-success' },
};

const ATTACHMENT_ICONS = { pdf: FileText, image: FileText, video: FileText, document: FileText, link: ExternalLink };

export default function StreamPostCard({ event, classData, isTeacher, me, settings, busy, onAction }) {
  const meta = KIND_META[event.kind] || KIND_META.announcement;
  const Icon = meta.icon;
  const ts = event.ts ? format(new Date(event.ts), 'PPp') : '';
  const isAnnouncement = event.kind === 'announcement';

  return (
    <div className={`rounded-xl border bg-card p-5 ${event.pinned ? 'border-primary/40' : 'border-border'}`}>
      <div className="flex items-start gap-4">
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.tone}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-xs text-muted-foreground">{meta.label}</Badge>
            {event.pinned && (
              <Badge className="bg-primary text-primary-foreground gap-1 text-xs">
                <Pin className="h-3 w-3" /> Pinned
              </Badge>
            )}
            {isAnnouncement && event.priority && event.priority !== 'normal' && (
              <Badge variant={event.priority === 'urgent' ? 'destructive' : 'default'} className="text-xs capitalize">
                {event.priority}
              </Badge>
            )}
            {isAnnouncement && event.status === 'scheduled' && (
              <Badge variant="secondary" className="text-xs gap-1">
                <CalendarClock className="h-3 w-3" />
                Scheduled {event.scheduled_at ? `for ${format(new Date(event.scheduled_at), 'PPp')}` : ''}
              </Badge>
            )}
          </div>

          <h3 className="mt-2 font-semibold text-foreground">{event.title}</h3>

          {event.kind === 'grade' ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Grades have been returned for this assessment{event.count > 0 && ` (${event.count} students)`}.
              {event.my && (
                <span className="ml-1 font-medium text-foreground">
                  You scored {event.my.percentage != null ? `${Math.round(event.my.percentage)}%` : `${event.my.raw_score}/${event.my.max_score}`}
                  {event.my.grade_value ? ` (${event.my.grade_value})` : ''}.
                </span>
              )}
            </p>
          ) : (
            event.body ? (
              <p className="mt-1 text-sm text-foreground/90 whitespace-pre-wrap">{event.body}</p>
            ) : event.description ? (
              <p className="mt-1 text-sm text-foreground/90 whitespace-pre-wrap">{event.description}</p>
            ) : null
          )}

          {event.kind === 'assignment' && event.due_date && (
            <p className="mt-2 text-xs font-medium text-warning">Due {format(new Date(event.due_date), 'PPP')}</p>
          )}

          {event.kind === 'assignment' && event.attachment_url && (
            <a href={event.attachment_url} target="_blank" rel="noopener noreferrer"
               className="mt-2 inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
              <Paperclip className="h-3.5 w-3.5" /> Attached instructions
            </a>
          )}

          {isAnnouncement && event.attachments?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {event.attachments.map(att => {
                const AttIcon = ATTACHMENT_ICONS[att.file_type] || FileText;
                return (
                  <a key={att.url} href={att.url} target="_blank" rel="noopener noreferrer"
                     className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground hover:bg-hover transition-colors">
                    <AttIcon className="h-4 w-4 text-primary" />
                    <span className="max-w-[220px] truncate">{att.name}</span>
                  </a>
                );
              })}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {ts && <span>{ts}</span>}
            {isAnnouncement && event.author && <span>by {event.author}</span>}
          </div>
        </div>

        {/* Teacher moderation */}
        {isTeacher && isAnnouncement && event.status === 'sent' && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant="ghost" size="icon" disabled={busy}
              onClick={() => onAction(
                { action: event.pinned ? 'unpin_post' : 'pin_post', announcement_id: event.id },
                event.pinned ? 'Unpinned' : 'Pinned to the top',
              )}
              title={event.pinned ? 'Unpin post' : 'Pin to the top'}
            >
              {event.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
            </Button>
          </div>
        )}
      </div>

      {/* Comments — announcement posts only. Class-visible by design. */}
      {isAnnouncement && event.status === 'sent' && (
        <CommentSection
          post={event}
          classData={classData}
          isTeacher={isTeacher}
          me={me}
          settings={settings}
          busy={busy}
          onAction={onAction}
        />
      )}
    </div>
  );
}