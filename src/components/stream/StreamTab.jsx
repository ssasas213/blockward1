import React, { useState, useCallback, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageSquare, Plus, Rss } from 'lucide-react';
import { toast } from 'sonner';
import StreamComposer from './StreamComposer';
import StreamPostCard from './StreamPostCard';

export default function StreamTab({ classId, classData, profile, isTeacher }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await base44.functions.invoke('classStreamData', { class_id: classId });
      const d = res.data || res;
      if (d?.error) throw new Error(d.error);
      setData(d);
    } catch (e) {
      toast.error(e?.message || 'Could not load the class stream');
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => { load(); }, [load]);

  const act = async (payload, okMsg) => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke('streamAction', payload);
      const d = res.data || res;
      if (d?.error) throw new Error(d.error);
      if (okMsg) toast.success(okMsg);
      await load();
      return true;
    } catch (e) {
      toast.error(e?.message || 'Action failed');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const me = {
    email: profile?.user_email,
    name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim(),
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[0, 1, 2].map(i => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
      </div>
    );
  }

  const events = data?.events || [];
  const settings = data?.settings || { allow_student_comments: true, i_am_muted: false, muted_emails: [] };

  return (
    <div className="space-y-4">
      {/* Teacher controls */}
      {isTeacher && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-4 w-4 text-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">Class comments</p>
              <p className="text-xs text-muted-foreground">
                {settings.allow_student_comments
                  ? 'Students can comment on Stream posts'
                  : 'Students cannot comment on Stream posts'}
              </p>
            </div>
            <Switch
              checked={settings.allow_student_comments}
              disabled={busy}
              onCheckedChange={(v) => act({ action: 'set_class_comments', class_id: classId, allow_student_comments: v }, v ? 'Class comments on' : 'Class comments off')}
              aria-label="Toggle class comments"
            />
          </div>
          <Button onClick={() => setComposerOpen(o => !o)}>
            <Plus className="h-4 w-4 mr-1.5" />
            {composerOpen ? 'Close composer' : 'Post to Stream'}
          </Button>
        </div>
      )}

      {isTeacher && composerOpen && (
        <StreamComposer
          classId={classId}
          classData={classData}
          onPosted={() => { setComposerOpen(false); load(); }}
        />
      )}

      {/* Feed */}
      {events.length === 0 ? (
        <div className="rounded-xl border border-border bg-card py-16 text-center">
          <Rss className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium text-foreground">Nothing in the Stream yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Announcements, assignments, materials and returned grades will all appear here, newest first.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map(ev => (
            <StreamPostCard
              key={ev.kind + ev.id}
              event={ev}
              classData={classData}
              isTeacher={isTeacher}
              me={me}
              settings={settings}
              busy={busy}
              onAction={act}
            />
          ))}
        </div>
      )}
    </div>
  );
}