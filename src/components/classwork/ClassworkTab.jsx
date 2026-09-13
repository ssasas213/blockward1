import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import EmptyState from '@/components/ui/empty-state';
import { Plus, ClipboardList, Pencil, Archive, Trash2, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import PostFormDialog from './PostFormDialog';

function StatusBadge({ post }) {
  if (post.status === 'draft') return <Badge variant="secondary" className="text-[10px]">Draft</Badge>;
  if (post.status === 'scheduled') return <Badge className="bg-warning/15 text-warning text-[10px]">Scheduled</Badge>;
  if (post.status === 'archived') return <Badge variant="outline" className="text-[10px]">Archived</Badge>;
  return null;
}

function PostRow({ post, canManage, onEdit, onArchive, onDelete, confirmingDelete }) {
  const typeLabel = post.type?.charAt(0).toUpperCase() + post.type?.slice(1);
  return (
    <Card className="surface-card">
      <CardContent className="p-4 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-foreground">{post.title}</p>
            <Badge variant="secondary" className="text-[10px]">{typeLabel}</Badge>
            <StatusBadge post={post} />
            {post.points_possible != null && (
              <Badge variant="outline" className="text-[10px]">{post.points_possible} pts</Badge>
            )}
          </div>
          {post.instructions && (
            <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2">{post.instructions}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs text-tertiary">
            {post.due_at && <span>Due {format(new Date(post.due_at), "d MMM, HH:mm")}</span>}
            {post.due_at && post.allow_late && <span>Late allowed</span>}
            {post.scheduled_at && post.status === 'scheduled' && (
              <span>Goes out {format(new Date(post.scheduled_at), "d MMM, HH:mm")}</span>
            )}
          </div>
        </div>
        {canManage && (
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" onClick={() => onEdit(post)} title="Edit">
              <Pencil className="h-4 w-4" />
            </Button>
            {post.status !== 'archived' && (
              <Button variant="ghost" size="icon" onClick={() => onArchive(post)} title="Archive">
                <Archive className="h-4 w-4" />
              </Button>
            )}
            {confirmingDelete === post.id ? (
              <Button variant="destructive" size="sm" onClick={() => onDelete(post)}>Confirm</Button>
            ) : (
              <Button variant="ghost" size="icon" onClick={() => onDelete(post)} title="Delete">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ClassworkTab({ classId, canManage }) {
  const [posts, setPosts] = useState([]);
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null); // null = create, object = edit
  const [confirmingDelete, setConfirmingDelete] = useState(null);
  const [topicInput, setTopicInput] = useState('');
  const [showTopicInput, setShowTopicInput] = useState(false);

  const load = async () => {
    try {
      const [p, t] = await Promise.all([
        base44.entities.Assignment.filter({ class_id: classId }),
        base44.entities.Topic.filter({ class_id: classId }).catch(() => []),
      ]);
      setPosts(p || []);
      setTopics((t || []).sort((a, b) => (a.position || 0) - (b.position || 0)));
    } catch (e) {
      console.error('Failed to load classwork', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [classId]);

  const act = async (payload, successMsg) => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke('classworkAction', payload);
      if (res.data?.ok) {
        toast.success(successMsg);
        await load();
      } else {
        toast.error(res.data?.error || 'Action failed');
      }
    } catch (e) {
      toast.error('Action failed');
    } finally {
      setBusy(false);
      setConfirmingDelete(null);
    }
  };

  const addTopic = async () => {
    if (!topicInput.trim()) return;
    await act({ action: 'topic_create', class_id: classId, title: topicInput.trim() }, 'Topic created');
    setTopicInput('');
    setShowTopicInput(false);
  };

  if (loading) {
    return (
      <Card className="surface-card">
        <CardContent className="py-16 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Students only ever see published posts (archived ones are teacher-only).
  const visible = canManage ? posts : posts.filter((p) => p.status === 'published');
  const ungrouped = visible.filter((p) => !p.topic_id);

  // Topic groups: teachers read Topic records directly; students group by the
  // denormalised topic_title on each post (Topic reads are staff-scoped).
  const topicGroups = topics
    .map((t) => ({ title: t.title, items: visible.filter((p) => p.topic_id === t.id) }))
    .filter((g) => g.items.length > 0 || canManage);

  const denormTitles = Array.from(new Set(
    visible.filter((p) => p.topic_id && !topics.some((t) => t.id === p.topic_id)).map((p) => p.topic_title)
  )).filter(Boolean);
  const extraGroups = denormTitles
    .map((title) => ({ title, items: visible.filter((p) => p.topic_title === title && !topics.some((t) => t.id === p.topic_id)) }))
    .filter((g) => g.items.length > 0);

  const groups = [...topicGroups, ...extraGroups];
  const nothing = ungrouped.length === 0 && groups.every((g) => g.items.length === 0);

  return (
    <div className="space-y-6">
      {canManage && (
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }} disabled={busy}>
            <Plus className="h-4 w-4 mr-2" />
            Create post
          </Button>
          {showTopicInput ? (
            <div className="flex items-center gap-2">
              <Input
                autoFocus
                value={topicInput}
                onChange={(e) => setTopicInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTopic()}
                placeholder="Topic name"
                className="h-9 w-48"
              />
              <Button variant="secondary" size="sm" onClick={addTopic} disabled={busy}>Add</Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setShowTopicInput(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Topic
            </Button>
          )}
        </div>
      )}

      {nothing ? (
        <EmptyState
          icon={ClipboardList}
          title={canManage ? 'No classwork yet' : 'Nothing posted yet'}
          description={canManage
            ? 'Post an assignment, quiz, question or material for this class.'
            : 'Your teacher hasn\'t posted any classwork here yet.'}
        />
      ) : (
        <>
          {ungrouped.length > 0 && (
            <div className="space-y-3">
              {canManage && <p className="text-xs font-semibold text-tertiary uppercase tracking-wider px-1">No topic</p>}
              {ungrouped.map((p) => (
                <PostRow
                  key={p.id}
                  post={p}
                  canManage={canManage}
                  confirmingDelete={confirmingDelete}
                  onEdit={(post) => { setEditing(post); setDialogOpen(true); }}
                  onArchive={(post) => act({ action: 'archive_post', post_id: post.id }, 'Post archived')}
                  onDelete={(post) => {
                    if (confirmingDelete === post.id) {
                      act({ action: 'delete_post', post_id: post.id }, 'Post deleted');
                    } else {
                      setConfirmingDelete(post.id);
                    }
                  }}
                />
              ))}
            </div>
          )}

          {groups.map((g) => (
            <div key={g.title} className="space-y-3">
              <p className="text-xs font-semibold text-tertiary uppercase tracking-wider px-1">{g.title}</p>
              {g.items.map((p) => (
                <PostRow
                  key={p.id}
                  post={p}
                  canManage={canManage}
                  confirmingDelete={confirmingDelete}
                  onEdit={(post) => { setEditing(post); setDialogOpen(true); }}
                  onArchive={(post) => act({ action: 'archive_post', post_id: post.id }, 'Post archived')}
                  onDelete={(post) => {
                    if (confirmingDelete === post.id) {
                      act({ action: 'delete_post', post_id: post.id }, 'Post deleted');
                    } else {
                      setConfirmingDelete(post.id);
                    }
                  }}
                />
              ))}
            </div>
          ))}
        </>
      )}

      <PostFormDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditing(null); }}
        classId={classId}
        topics={topics}
        post={editing}
        onSaved={load}
      />
    </div>
  );
}