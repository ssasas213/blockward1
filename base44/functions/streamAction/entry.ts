import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { resolveEffectiveActor } from '../../shared/testMode.ts';

// streamAction — all Stream interactions, enforced server-side:
//   post_comment      students + staff (class member, not muted, comments open)
//   delete_comment    class teacher / admin only (any comment)
//   pin_post          class teacher / admin only
//   unpin_post        class teacher / admin only
//   set_post_comments class teacher / admin only (true | false | null=inherit class)
//   set_class_comments class teacher / admin only (Class.allow_student_comments)
//   mute_student      class teacher / admin only
//   unmute_student    class teacher / admin only
export default async function(req: Request): Promise<Response> {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

    const base44 = createClientFromRequest(req);
    const actor = await resolveEffectiveActor(base44);
    if (!actor.authorized) return Response.json({ error: actor.reason || 'Not authorised' }, { status: actor.status || 403 });

    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const svc = base44.asServiceRole;
    const role = actor.actor_role || 'student';
    const isStaff = role === 'teacher' || role === 'admin';

    const loadClass = async (classId) => {
      if (!classId) return null;
      const found = await svc.entities.Class.filter({ id: classId });
      const cls = found[0];
      if (!cls || cls.school_id !== actor.school_id) return null;
      return cls;
    };
    // Class teacher (or co-teacher) or school admin — the moderation bar.
    const isClassTeacher = (cls) =>
      role === 'admin' ||
      (role === 'teacher' && (cls.teacher_email === actor.actor_email || (cls.co_teachers || []).includes(actor.actor_email)));

    if (action === 'post_comment') {
      const classId = body.class_id;
      const annId = body.announcement_id;
      const text = (body.body || '').trim();
      if (!classId || !annId || !text) return Response.json({ error: 'Missing comment details' }, { status: 400 });
      if (text.length > 2000) return Response.json({ error: 'Comment is too long (2000 characters max)' }, { status: 400 });

      const cls = await loadClass(classId);
      if (!cls) return Response.json({ error: 'Class not found' }, { status: 404 });

      const anns = await svc.entities.Announcement.filter({ id: annId });
      const ann = anns[0];
      if (!ann || ann.class_id !== classId || ann.scope_type !== 'CLASS' || ann.status !== 'sent') {
        return Response.json({ error: 'Post not found' }, { status: 404 });
      }

      if (!isStaff) {
        if (!(cls.student_emails || []).includes(actor.actor_email)) {
          return Response.json({ error: 'You are not in this class' }, { status: 403 });
        }
        if ((cls.comment_muted_emails || []).includes(actor.actor_email)) {
          return Response.json({ error: 'You have been muted from commenting in this class. Speak to your teacher.' }, { status: 403 });
        }
        const classAllows = cls.allow_student_comments !== false;
        const open = ann.allow_comments === true ? true : ann.allow_comments === false ? false : classAllows;
        if (!open) return Response.json({ error: 'Comments are turned off for this post' }, { status: 403 });
      }

      const comment = await svc.entities.StreamComment.create({
        school_id: cls.school_id,
        class_id: classId,
        announcement_id: annId,
        author_email: actor.actor_email,
        author_name: `${actor.first_name || ''} ${actor.last_name || ''}`.trim() || actor.actor_email,
        author_role: role,
        body: text,
      });
      return Response.json({ ok: true, comment });
    }

    if (action === 'delete_comment') {
      const found = await svc.entities.StreamComment.filter({ id: body.comment_id });
      const comment = found[0];
      if (!comment) return Response.json({ error: 'Comment not found' }, { status: 404 });
      const cls = await loadClass(comment.class_id);
      if (!cls) return Response.json({ error: 'Not your class' }, { status: 403 });
      if (!isClassTeacher(cls)) return Response.json({ error: 'Only the class teacher can delete comments' }, { status: 403 });
      await svc.entities.StreamComment.delete(comment.id);
      return Response.json({ ok: true });
    }

    if (action === 'pin_post' || action === 'unpin_post') {
      const found = await svc.entities.Announcement.filter({ id: body.announcement_id });
      const ann = found[0];
      if (!ann || ann.scope_type !== 'CLASS') return Response.json({ error: 'Post not found' }, { status: 404 });
      const cls = await loadClass(ann.class_id);
      if (!cls) return Response.json({ error: 'Not your class' }, { status: 403 });
      if (!isClassTeacher(cls)) return Response.json({ error: 'Only the class teacher can pin posts' }, { status: 403 });
      await svc.entities.Announcement.update(ann.id, { pinned: action === 'pin_post' });
      return Response.json({ ok: true });
    }

    if (action === 'set_post_comments') {
      const found = await svc.entities.Announcement.filter({ id: body.announcement_id });
      const ann = found[0];
      if (!ann || ann.scope_type !== 'CLASS') return Response.json({ error: 'Post not found' }, { status: 404 });
      const cls = await loadClass(ann.class_id);
      if (!cls) return Response.json({ error: 'Not your class' }, { status: 403 });
      if (!isClassTeacher(cls)) return Response.json({ error: 'Only the class teacher can change post comments' }, { status: 403 });
      const value = body.allow_comments === true ? true : body.allow_comments === false ? false : null;
      await svc.entities.Announcement.update(ann.id, { allow_comments: value });
      return Response.json({ ok: true });
    }

    if (action === 'set_class_comments') {
      const cls = await loadClass(body.class_id);
      if (!cls) return Response.json({ error: 'Class not found' }, { status: 404 });
      if (!isClassTeacher(cls)) return Response.json({ error: 'Only the class teacher can change this setting' }, { status: 403 });
      await svc.entities.Class.update(cls.id, { allow_student_comments: !!body.allow_student_comments });
      return Response.json({ ok: true, allow_student_comments: !!body.allow_student_comments });
    }

    if (action === 'mute_student' || action === 'unmute_student') {
      const cls = await loadClass(body.class_id);
      if (!cls) return Response.json({ error: 'Class not found' }, { status: 404 });
      if (!isClassTeacher(cls)) return Response.json({ error: 'Only the class teacher can manage muting' }, { status: 403 });
      const email = (body.student_email || '').trim().toLowerCase();
      if (!email) return Response.json({ error: 'student_email is required' }, { status: 400 });
      if (!(cls.student_emails || []).includes(email)) {
        return Response.json({ error: 'That student is not in this class' }, { status: 400 });
      }
      const list = new Set((cls.comment_muted_emails || []).map(e => e.toLowerCase()));
      if (action === 'mute_student') list.add(email); else list.delete(email);
      const muted = Array.from(list);
      await svc.entities.Class.update(cls.id, { comment_muted_emails: muted });
      return Response.json({ ok: true, muted_emails: muted });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error?.message || 'Action failed' }, { status: 500 });
  }
}