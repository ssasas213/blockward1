/**
 * classworkMaintenance — run hourly by the "Classwork Maintenance" workflow.
 *  1. Publishes scheduled posts whose time has come (same publish transition
 *     as publishing by hand: audience, submissions, notifications).
 *  2. Sends the "due in 24 hours" reminder once per post, to every student
 *     who hasn't turned the work in yet.
 *
 * Called by a scheduled workflow (no user session); a signed-in admin may also
 * invoke it directly for a manual sweep.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { loadClass, publishAssignment } from '../../shared/classwork.ts';
import { notifyEvent } from '../../shared/eventNotifications.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    // Workflow invocations carry no user. If a user IS present, require admin.
    try {
      const user = await base44.auth.me();
      if (user && user.role !== 'admin') {
        return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 });
      }
    } catch { /* workflow call — no user */ }

    const now = Date.now();
    const in24h = now + 24 * 60 * 60 * 1000;
    let publishedCount = 0;
    let remindersSent = 0;

    // ── 1. Scheduled posts that are due ──
    const scheduled = await svc.entities.Assignment.filter({ status: 'scheduled' }).catch(() => []);
    for (const post of scheduled || []) {
      if (!post.scheduled_at || new Date(post.scheduled_at).getTime() > now) continue;
      const klass = await loadClass(svc, post.class_id);
      if (!klass) continue;
      await publishAssignment(svc, { post, klass, actorName: klass.teacher_email });
      publishedCount++;
    }

    // ── 2. Due-in-24h reminders (once per post) ──
    const dueSoon = await svc.entities.Assignment.filter({ status: 'published' }).catch(() => []);
    for (const post of dueSoon || []) {
      if (post.due_reminder_sent || !post.due_at) continue;
      const dueMs = new Date(post.due_at).getTime();
      if (dueMs <= now || dueMs > in24h) continue;

      const rows = await svc.entities.Submission.filter({ assignment_id: post.id }).catch(() => []);
      const submitted = new Set(
        (rows || []).filter((s: any) => ['submitted', 'resubmitted'].includes(s.status))
          .map((s: any) => String(s.student_email).toLowerCase())
      );
      const dueDate = new Date(post.due_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      for (const studentEmail of post.visible_to || []) {
        if (submitted.has(String(studentEmail).toLowerCase())) continue;
        await notifyEvent(svc, {
          to_email: studentEmail,
          school_id: post.school_id || null,
          event_type: 'classwork_due_soon',
          title: `Due in 24 hours: \u201C${post.title}\u201D`,
          body: `${post.class_name || 'Your class'} — due ${dueDate}.`,
          related_id: post.id,
        });
        remindersSent++;
      }
      await svc.entities.Assignment.update(post.id, { due_reminder_sent: true });
    }

    return Response.json({ ok: true, published: publishedCount, reminders: remindersSent });
  } catch (error) {
    return Response.json({ ok: false, error: error?.message || 'Unexpected error' }, { status: 500 });
  }
}