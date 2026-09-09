/**
 * classworkAction — teacher actions on classwork posts and topics.
 * Every write is service-role, taken only after resolving the effective actor
 * and verifying they teach the class (or administer its school).
 *
 * save_post      create/update a post; publish now, schedule, or keep as draft
 * archive_post   hide a published post from students (kept for teachers)
 * delete_post    remove a post and its submissions entirely
 * reuse_post     copy a previous post (any owned class) into a target class as a draft
 * topic_create / topic_rename / topic_reorder / topic_delete
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { resolveEffectiveActor } from '../../shared/testMode.ts';
import {
  POST_TYPES, loadClass, classTeachers, canManageClass, audienceFor, publishAssignment,
} from '../../shared/classwork.ts';

const bad = (msg: string, status = 400) => Response.json({ ok: false, error: msg }, { status });

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const actor = await resolveEffectiveActor(base44);
    if (!actor.authorized) return bad(actor.reason || 'Not authorised', actor.status || 401);
    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({})) || {};
    const actorName = [actor.first_name, actor.last_name].filter(Boolean).join(' ') || actor.actor_email;

    switch (body.action) {
      case 'save_post': {
        if (!body.class_id || !body.title || !String(body.title).trim()) return bad('A title is required');
        const type = POST_TYPES.includes(body.type) ? body.type : 'assignment';
        const klass = await loadClass(svc, body.class_id);
        if (!klass) return bad('Class not found', 404);
        if (!canManageClass(actor, klass)) return bad('Only this class\u2019s teachers can manage its classwork', 403);

        let topicTitle: string | null = null;
        if (body.topic_id) {
          const topics = await svc.entities.Topic.filter({ id: body.topic_id }).catch(() => []);
          const t = topics?.[0];
          if (!t || t.class_id !== klass.id) return bad('Topic not found in this class');
          topicTitle = t.title;
        }

        const roster = (klass.student_emails || []).map((e: string) => String(e).toLowerCase());
        let assignedTo: any = 'all';
        if (Array.isArray(body.assigned_to)) {
          const picked = new Set((body.assigned_to).map((e: any) => String(e).toLowerCase()));
          assignedTo = roster.filter((e) => picked.has(e));
        }

        const mode = body.publish || 'draft'; // draft | now | schedule
        if (mode === 'schedule' && !body.scheduled_at) return bad('Pick a date and time to schedule this post');
        if (mode === 'schedule' && new Date(body.scheduled_at).getTime() <= Date.now()) return bad('Schedule time must be in the future');

        const payload: any = {
          school_id: klass.school_id || null,
          class_id: klass.id,
          class_name: klass.name,
          teacher_email: klass.teacher_email,
          teacher_emails: classTeachers(klass),
          type,
          title: String(body.title).trim(),
          instructions: body.instructions || '',
          topic_id: body.topic_id || null,
          topic_title: topicTitle,
          attachments: Array.isArray(body.attachments) ? body.attachments : [],
          links: Array.isArray(body.links) ? body.links : [],
          points_possible: body.points_possible === null || body.points_possible === undefined || body.points_possible === ''
            ? null : Number(body.points_possible),
          due_at: body.due_at ? new Date(body.due_at).toISOString() : null,
          scheduled_at: mode === 'schedule' ? new Date(body.scheduled_at).toISOString() : null,
          allow_late: !!body.allow_late,
          assigned_to: assignedTo,
          due_reminder_sent: false,
          reused_from_id: body.reused_from_id || null,
        };

        if (body.id) {
          // ── Update an existing post ──
          const rows = await svc.entities.Assignment.filter({ id: body.id }).catch(() => []);
          const existing = rows?.[0];
          if (!existing || existing.class_id !== klass.id) return bad('Post not found in this class', 404);

          const wasPublished = existing.status === 'published';
          const targetStatus = mode === 'now' ? 'published' : mode === 'schedule' ? 'scheduled' : (wasPublished ? 'published' : 'draft');

          const updated = await svc.entities.Assignment.update(existing.id, {
            ...payload,
            status: targetStatus,
            visible_to: wasPublished || targetStatus === 'published' ? undefined : [],
          });
          // visible_to undefined above means "keep current" on republish below.

          let post = { ...existing, ...payload, status: targetStatus };
          if (targetStatus === 'published') {
            // (Re)publish: recompute audience from the live roster, resync
            // submissions. Notify only when this is the first publish.
            const res = await publishAssignment(svc, { post: updated, klass, actorName, notify: !wasPublished });
            post = { ...post, visible_to: res.audience };
          }
          return Response.json({ ok: true, post });
        }

        // ── Create a new post ──
        const status = mode === 'now' ? 'published' : mode === 'schedule' ? 'scheduled' : 'draft';
        const created = await svc.entities.Assignment.create({ ...payload, status, visible_to: [] });
        let post = created;
        if (status === 'published') {
          const res = await publishAssignment(svc, { post: created, klass, actorName });
          post = { ...created, status: 'published', visible_to: res.audience };
        }
        return Response.json({ ok: true, post });
      }

      case 'archive_post': {
        const rows = await svc.entities.Assignment.filter({ id: body.post_id }).catch(() => []);
        const post = rows?.[0];
        if (!post) return bad('Post not found', 404);
        const klass = await loadClass(svc, post.class_id);
        if (!canManageClass(actor, klass)) return bad('Only this class\u2019s teachers can manage its classwork', 403);
        await svc.entities.Assignment.update(post.id, { status: 'archived' });
        return Response.json({ ok: true });
      }

      case 'delete_post': {
        const rows = await svc.entities.Assignment.filter({ id: body.post_id }).catch(() => []);
        const post = rows?.[0];
        if (!post) return bad('Post not found', 404);
        const klass = await loadClass(svc, post.class_id);
        if (!canManageClass(actor, klass)) return bad('Only this class\u2019s teachers can manage its classwork', 403);
        await svc.entities.Submission.deleteMany({ assignment_id: post.id }).catch(() => {});
        await svc.entities.Assignment.delete(post.id);
        return Response.json({ ok: true });
      }

      case 'reuse_post': {
        if (!body.post_id || !body.target_class_id) return bad('Pick a post and a class');
        const srcRows = await svc.entities.Assignment.filter({ id: body.post_id }).catch(() => []);
        const src = srcRows?.[0];
        if (!src) return bad('Post not found', 404);
        const srcClass = await loadClass(svc, src.class_id);
        const target = await loadClass(svc, body.target_class_id);
        if (!canManageClass(actor, srcClass) || !canManageClass(actor, target)) {
          return bad('You can only reuse your own posts into classes you teach', 403);
        }
        const created = await svc.entities.Assignment.create({
          school_id: target.school_id || null,
          class_id: target.id,
          class_name: target.name,
          teacher_email: target.teacher_email,
          teacher_emails: classTeachers(target),
          type: src.type,
          title: src.title,
          instructions: src.instructions || '',
          topic_id: null,
          topic_title: null,
          attachments: src.attachments || [],
          links: src.links || [],
          points_possible: src.points_possible ?? null,
          due_at: null,
          scheduled_at: null,
          allow_late: !!src.allow_late,
          status: 'draft',
          assigned_to: 'all',
          visible_to: [],
          reused_from_id: src.id,
        });
        return Response.json({ ok: true, post: created });
      }

      case 'topic_create': {
        const klass = await loadClass(svc, body.class_id);
        if (!klass) return bad('Class not found', 404);
        if (!canManageClass(actor, klass)) return bad('Only this class\u2019s teachers can manage topics', 403);
        const title = String(body.title || '').trim();
        if (!title) return bad('Topic name is required');
        const existing = await svc.entities.Topic.filter({ class_id: klass.id }).catch(() => []);
        const topic = await svc.entities.Topic.create({
          school_id: klass.school_id || null,
          class_id: klass.id,
          teacher_emails: classTeachers(klass),
          title,
          position: (existing || []).length,
        });
        return Response.json({ ok: true, topic });
      }

      case 'topic_rename': {
        const rows = await svc.entities.Topic.filter({ id: body.topic_id }).catch(() => []);
        const topic = rows?.[0];
        if (!topic) return bad('Topic not found', 404);
        const klass = await loadClass(svc, topic.class_id);
        if (!canManageClass(actor, klass)) return bad('Only this class\u2019s teachers can manage topics', 403);
        const title = String(body.title || '').trim();
        if (!title) return bad('Topic name is required');
        await svc.entities.Topic.update(topic.id, { title });
        // Keep the denormalised title on posts in sync.
        await svc.entities.Assignment.updateMany({ topic_id: topic.id }, { $set: { topic_title: title } }).catch(() => {});
        return Response.json({ ok: true });
      }

      case 'topic_reorder': {
        const orderedIds: string[] = Array.isArray(body.ordered_ids) ? body.ordered_ids : [];
        if (!orderedIds.length) return bad('Nothing to reorder');
        const first = await svc.entities.Topic.filter({ id: orderedIds[0] }).catch(() => []);
        const topic = first?.[0];
        if (!topic) return bad('Topic not found', 404);
        const klass = await loadClass(svc, topic.class_id);
        if (!canManageClass(actor, klass)) return bad('Only this class\u2019s teachers can manage topics', 403);
        const updates = orderedIds.map((id, i) => ({ id, position: i }));
        await svc.entities.Topic.bulkUpdate(updates);
        return Response.json({ ok: true });
      }

      case 'topic_delete': {
        const rows = await svc.entities.Topic.filter({ id: body.topic_id }).catch(() => []);
        const topic = rows?.[0];
        if (!topic) return bad('Topic not found', 404);
        const klass = await loadClass(svc, topic.class_id);
        if (!canManageClass(actor, klass)) return bad('Only this class\u2019s teachers can manage topics', 403);
        // Posts fall back to ungrouped; then remove the topic.
        await svc.entities.Assignment.updateMany({ topic_id: topic.id }, { $set: { topic_id: null, topic_title: null } }).catch(() => {});
        await svc.entities.Topic.delete(topic.id);
        return Response.json({ ok: true });
      }

      default:
        return bad('Unknown action');
    }
  } catch (error) {
    return Response.json({ ok: false, error: error?.message || 'Unexpected error' }, { status: 500 });
  }
}