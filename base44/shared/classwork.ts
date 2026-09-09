// Classwork domain helpers shared by classworkAction, submissionAction and
// classworkMaintenance. One place for class access checks, audience
// computation and the publish transition (visible_to + submissions + notify).

import { notifyEvent } from './eventNotifications.ts';

export const POST_TYPES = ['assignment', 'quiz', 'material', 'question'];
// Types that collect student work (materials are reference-only).
export const COLLECTING_TYPES = ['assignment', 'quiz', 'question'];

export async function loadClass(svc: any, classId: string): Promise<any | null> {
  const rows = await svc.entities.Class.filter({ id: classId }).catch(() => []);
  return rows?.[0] || null;
}

export function classTeachers(klass: any): string[] {
  const emails = [klass?.teacher_email, ...((klass?.co_teachers || []).map((e: any) => (typeof e === 'string' ? e : e?.email)))];
  return Array.from(new Set(emails.filter((e: any) => !!e).map((e: string) => e.toLowerCase())));
}

// Teachers of the class (or admins of the class's school) may manage its classwork.
export function canManageClass(actor: any, klass: any): boolean {
  if (!klass) return false;
  const email = (actor.actor_email || '').toLowerCase();
  if (classTeachers(klass).includes(email)) return true;
  return actor.actor_role === 'admin' && !!klass.school_id && klass.school_id === actor.school_id;
}

// Effective student audience: intersect assigned_to with the current roster.
export function audienceFor(post: any, klass: any): string[] {
  const roster = (klass?.student_emails || []).map((e: string) => String(e).toLowerCase());
  const assigned = post?.assigned_to;
  if (Array.isArray(assigned)) {
    const set = new Set(assigned.map((e: any) => String(e).toLowerCase()));
    return roster.filter((e) => set.has(e));
  }
  return roster; // 'all'
}

/**
 * publishAssignment — the ONE publish transition: flips status, computes the
 * student audience from the live roster, materialises 'assigned' submissions
 * for collecting post types, and notifies the audience. Used by classworkAction
 * (publish now) and classworkMaintenance (scheduled posts coming due).
 */
export async function publishAssignment(svc: any, opts: {
  post: any;
  klass: any;
  actorName?: string;
  notify?: boolean;
}): Promise<{ audience: string[] }> {
  const { post, klass } = opts;
  const audience = audienceFor(post, klass);
  const nowIso = new Date().toISOString();

  await svc.entities.Assignment.update(post.id, {
    status: 'published',
    published_at: post.published_at || nowIso,
    visible_to: audience,
  });

  if (COLLECTING_TYPES.includes(post.type)) {
    const existing = await svc.entities.Submission.filter({ assignment_id: post.id }).catch(() => []);
    const existingBy = new Map((existing || []).map((s: any) => [String(s.student_email).toLowerCase(), s]));
    const missing = audience.filter((e) => !existingBy.has(e));
    if (missing.length) {
      await svc.entities.Submission.bulkCreate(missing.map((email) => ({
        assignment_id: post.id,
        assignment_title: post.title,
        class_id: klass.id,
        class_name: klass.name,
        school_id: klass.school_id || null,
        teacher_emails: classTeachers(klass),
        student_email: email,
        status: 'assigned',
        attachments: [],
        private_comment_thread: [],
      })));
    }
  }

  if (opts.notify !== false) {
    const dueNote = post.due_at ? ` — due ${new Date(post.due_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : '';
    for (const email of audience) {
      await notifyEvent(svc, {
        to_email: email,
        school_id: klass.school_id || null,
        event_type: 'classwork_posted',
        title: `New ${post.type} in ${klass.name}`,
        body: `${opts.actorName || 'Your teacher'} posted \u201C${post.title}\u201D${dueNote}.`,
        related_id: post.id,
      });
    }
  }

  return { audience };
}