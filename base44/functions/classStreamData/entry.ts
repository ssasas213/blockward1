import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { resolveEffectiveActor } from '../../shared/testMode.ts';

// classStreamData — the chronological feed of one class's Stream:
// CLASS-scoped announcements (sent, plus scheduled for staff), published
// assignments, materials, and returned-grade events — newest first, pinned
// announcement posts on top. Also returns the class's comment settings and,
// for the requesting student, whether they are muted.
// Students cannot read Assessment/StudentGrade rows directly (RLS), so the
// feed is assembled under the service role and only after membership checks.
const ASSIGNMENT_TYPES = ['homework', 'assignment', 'revision', 'coursework', 'project'];

export default async function(req: Request): Promise<Response> {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

    const base44 = createClientFromRequest(req);
    const actor = await resolveEffectiveActor(base44);
    if (!actor.authorized) return Response.json({ error: actor.reason || 'Not authorised' }, { status: actor.status || 403 });

    const body = await req.json().catch(() => ({}));
    const classId = body.class_id;
    if (!classId) return Response.json({ error: 'class_id is required' }, { status: 400 });

    const svc = base44.asServiceRole;
    const classes = await svc.entities.Class.filter({ id: classId });
    const cls = classes[0];
    if (!cls) return Response.json({ error: 'Class not found' }, { status: 404 });
    if (cls.school_id !== actor.school_id) return Response.json({ error: 'Not your class' }, { status: 403 });

    const role = actor.actor_role || 'student';
    const isTeacherOfClass = cls.teacher_email === actor.actor_email || (cls.co_teachers || []).includes(actor.actor_email);
    const isMember = (cls.student_emails || []).includes(actor.actor_email);
    if (!(role === 'admin' || isTeacherOfClass || isMember)) {
      return Response.json({ error: 'Not your class' }, { status: 403 });
    }
    const isStaff = role === 'teacher' || role === 'admin';

    const [announcements, assessments, resources, grades, comments] = await Promise.all([
      svc.entities.Announcement.filter({ school_id: actor.school_id, class_id: classId, scope_type: 'CLASS' }).catch(() => []),
      svc.entities.Assessment.filter({ school_id: actor.school_id, class_id: classId, status: 'published' }).catch(() => []),
      svc.entities.Resource.filter({ class_id: classId }).catch(() => []),
      svc.entities.StudentGrade.filter({ school_id: actor.school_id, class_id: classId, status: 'published' }).catch(() => []),
      svc.entities.StreamComment.filter({ class_id: classId }).catch(() => []),
    ]);

    // Announcement posts (scheduled ones only surface to staff — they are
    // not public until the scheduled-time workflow flips them to 'sent').
    const annEvents = announcements
      .filter(a => a.status === 'sent' || (isStaff && a.status === 'scheduled'))
      .map(a => ({
        kind: 'announcement',
        id: a.id,
        ts: a.status === 'sent' ? (a.sent_at || a.created_date) : (a.scheduled_at || a.created_date),
        title: a.title,
        body: a.body,
        priority: a.priority || 'normal',
        status: a.status,
        scheduled_at: a.scheduled_at,
        author: a.created_by,
        attachments: a.attachments || [],
        pinned: !!a.pinned,
        allow_comments: a.allow_comments === undefined ? null : a.allow_comments,
        comments: comments
          .filter(c => c.announcement_id === a.id)
          .sort((x, y) => (x.created_date || '').localeCompare(y.created_date || ''))
          .map(c => ({
            id: c.id,
            author_email: c.author_email,
            author_name: c.author_name,
            author_role: c.author_role,
            body: c.body,
            created_date: c.created_date,
          })),
      }));

    // Published assignments (Phase 1 classwork)
    const assignmentEvents = assessments
      .filter(a => ASSIGNMENT_TYPES.includes(a.assessment_type))
      .map(a => ({
        kind: 'assignment',
        id: a.id,
        ts: a.published_at || a.created_date,
        title: a.title,
        description: a.description,
        assessment_type: a.assessment_type,
        due_date: a.due_date,
        attachment_url: a.attachment_url,
        max_score: a.max_score,
      }));

    // Materials
    const materialEvents = resources.map(r => ({
      kind: 'material',
      id: r.id,
      ts: r.created_date,
      title: r.title,
      description: r.description,
      file_url: r.file_url,
      file_type: r.file_type,
    }));

    // Returned-grade events — one per assessment, aggregate only
    // (count + date); individual scores are never exposed to the class.
    // The requesting student sees their own published grade alongside.
    const grouped = {};
    for (const g of grades) {
      const key = g.assessment_id || g.assessment_title;
      if (!grouped[key]) grouped[key] = { id: key, title: g.assessment_title || 'Assessment', count: 0, latest: '', my: null };
      grouped[key].count += 1;
      if ((g.published_at || '') > grouped[key].latest) grouped[key].latest = g.published_at;
      if (!isStaff && g.student_email === actor.actor_email) {
        grouped[key].my = { raw_score: g.raw_score, max_score: g.max_score, percentage: g.percentage, grade_value: g.grade_value };
      }
    }
    const gradeEvents = Object.values(grouped).map(v => ({
      kind: 'grade',
      id: `grade-${v.id}`,
      ts: v.latest,
      title: v.title,
      count: v.count,
      my: v.my,
    }));

    const events = [...annEvents, ...assignmentEvents, ...materialEvents, ...gradeEvents]
      .sort((a, b) => (b.pinned === true) - (a.pinned === true) || (b.ts || '').localeCompare(a.ts || ''));

    return Response.json({
      ok: true,
      role,
      settings: {
        allow_student_comments: cls.allow_student_comments !== false,
        muted_emails: isStaff ? (cls.comment_muted_emails || []) : undefined,
        i_am_muted: (cls.comment_muted_emails || []).includes(actor.actor_email),
      },
      events,
    });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to load stream' }, { status: 500 });
  }
}