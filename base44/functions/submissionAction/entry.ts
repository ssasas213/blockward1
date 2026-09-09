/**
 * submissionAction — the ONLY writer of Submission records (entity writes are
 * service-role only). This is where the feature's core boundary lives:
 *
 *  - Students may act ONLY on their own submission (turn_in / unsubmit) and
 *    those actions touch only their own work fields — never grade,
 *    draft_grade, graded_by or the comment thread.
 *  - Teachers of the class (denormalised teacher_emails) may grade, leave
 *    private comments, and return work. Returning promotes the draft grade,
 *    writes the grade to StudentGrade (the Gradebook stays the single grade
 *    store) and notifies the student.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { resolveEffectiveActor } from '../../shared/testMode.ts';
import { classTeachers } from '../../shared/classwork.ts';
import { notifyEvent } from '../../shared/eventNotifications.ts';

const bad = (msg: string, status = 400) => Response.json({ ok: false, error: msg }, { status });

async function loadPost(svc: any, id: string) {
  const rows = await svc.entities.Assignment.filter({ id }).catch(() => []);
  return rows?.[0] || null;
}

async function loadSubmission(svc: any, id: string) {
  const rows = await svc.entities.Submission.filter({ id }).catch(() => []);
  return rows?.[0] || null;
}

function isTeacherOf(submission: any, email: string): boolean {
  return (submission?.teacher_emails || []).map((e: string) => e.toLowerCase()).includes(email.toLowerCase());
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const actor = await resolveEffectiveActor(base44);
    if (!actor.authorized) return bad(actor.reason || 'Not authorised', actor.status || 401);
    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({})) || {};
    const email = (actor.actor_email || '').toLowerCase();
    const actorName = [actor.first_name, actor.last_name].filter(Boolean).join(' ') || actor.actor_email;

    switch (body.action) {
      // ─────────────────────── Student actions ───────────────────────
      case 'turn_in': {
        const post = await loadPost(svc, body.assignment_id);
        if (!post) return bad('This post no longer exists', 404);
        if (post.status !== 'published') return bad('This post is not open for work');
        if (post.type === 'material') return bad('Materials don\u2019t collect work');
        const audience = (post.visible_to || []).map((e: string) => e.toLowerCase());
        if (!audience.includes(email)) return bad('This work wasn\u2019t assigned to you', 403);

        const attachments = Array.isArray(body.attachments) ? body.attachments : [];
        const textResponse = String(body.text_response || '').trim();
        if (!attachments.length && !textResponse) return bad('Attach a file or write a response first');

        const now = Date.now();
        const dueMs = post.due_at ? new Date(post.due_at).getTime() : null;
        const isLate = dueMs !== null && now > dueMs;
        if (isLate && !post.allow_late) return bad('The due date for this work has passed');

        const rows = await svc.entities.Submission.filter({ assignment_id: post.id }).catch(() => []);
        const existing = (rows || []).find((s: any) => String(s.student_email).toLowerCase() === email);
        const status = existing?.status === 'returned' ? 'resubmitted' : 'submitted';
        const nowIso = new Date().toISOString();

        if (existing) {
          const updated = await svc.entities.Submission.update(existing.id, {
            status,
            attachments,
            text_response: textResponse,
            submitted_at: nowIso,
            is_late: isLate,
          });
          return Response.json({ ok: true, submission: { ...updated, draft_grade: null } });
        }
        // Lazy upsert — for students added to the roster after publish.
        const created = await svc.entities.Submission.create({
          assignment_id: post.id,
          assignment_title: post.title,
          class_id: post.class_id,
          class_name: post.class_name,
          school_id: post.school_id || null,
          teacher_emails: post.teacher_emails || [],
          student_email: email,
          student_name: actorName,
          status,
          attachments,
          text_response: textResponse,
          submitted_at: nowIso,
          is_late: isLate,
          private_comment_thread: [],
        });
        return Response.json({ ok: true, submission: created });
      }

      case 'unsubmit': {
        const submission = await loadSubmission(svc, body.submission_id);
        if (!submission) return bad('Submission not found', 404);
        if (submission.student_email.toLowerCase() !== email) return bad('This is not your submission', 403);
        if (!['submitted', 'resubmitted'].includes(submission.status)) return bad('Nothing to unsubmit');

        const post = await loadPost(svc, submission.assignment_id);
        if (post?.due_at && Date.now() > new Date(post.due_at).getTime()) {
          return bad('Unsubmitting is only available before the due date');
        }
        const updated = await svc.entities.Submission.update(submission.id, {
          status: 'assigned',
          attachments: [],
          text_response: '',
          submitted_at: null,
          is_late: false,
        });
        return Response.json({ ok: true, submission: { ...updated, draft_grade: null } });
      }

      // ─────────────────────── Shared: comments ───────────────────────
      case 'comment': {
        const submission = await loadSubmission(svc, body.submission_id);
        if (!submission) return bad('Submission not found', 404);
        const isStudent = submission.student_email.toLowerCase() === email;
        if (!isStudent && !isTeacherOf(submission, email)) return bad('Not part of this submission', 403);
        const text = String(body.body || '').trim();
        if (!text) return bad('Write a comment first');

        const thread = submission.private_comment_thread || [];
        thread.push({ author_email: email, author_name: actorName, body: text, created_at: new Date().toISOString() });
        const updated = await svc.entities.Submission.update(submission.id, { private_comment_thread: thread });

        // The other party gets an in-app notification (teacher comment → student,
        // student reply → the class teachers).
        if (isStudent) {
          return Response.json({ ok: true, submission: updated });
        }
        await notifyEvent(svc, {
          to_email: submission.student_email,
          school_id: submission.school_id || null,
          event_type: 'classwork_returned',
          title: `Private comment on \u201C${submission.assignment_title}\u201D`,
          body: `${actorName} commented on your work.`,
          related_id: submission.assignment_id,
        });
        return Response.json({ ok: true, submission: updated });
      }

      // ─────────────────────── Teacher actions ───────────────────────
      case 'save_draft_grade': {
        const submission = await loadSubmission(svc, body.submission_id);
        if (!submission) return bad('Submission not found', 404);
        if (!isTeacherOf(submission, email) && actor.actor_role !== 'admin') return bad('Only this class\u2019s teachers can grade', 403);
        const post = await loadPost(svc, submission.assignment_id);
        const val = body.grade === null || body.grade === undefined || body.grade === '' ? null : Number(body.grade);
        if (val !== null && post?.points_possible != null && val > post.points_possible) {
          return bad(`Grade can\u2019t exceed ${post.points_possible} points`);
        }
        const updated = await svc.entities.Submission.update(submission.id, { draft_grade: val });
        return Response.json({ ok: true, submission: updated });
      }

      case 'return_grades': {
        const post = await loadPost(svc, body.assignment_id);
        if (!post) return bad('Post not found', 404);
        if (!(post.teacher_emails || []).map((e: string) => e.toLowerCase()).includes(email) && actor.actor_role !== 'admin') {
          return bad('Only this class\u2019s teachers can return work', 403);
        }

        const rows = await svc.entities.Submission.filter({ assignment_id: post.id }).catch(() => []);
        const all: any[] = rows || [];
        const inline = new Map<string, number | null>(
          (Array.isArray(body.grades) ? body.grades : [])
            .filter((g: any) => g && g.submission_id)
            .map((g: any) => [g.submission_id, g.grade === null || g.grade === undefined || g.grade === '' ? null : Number(g.grade)])
        );

        // Bulk mode: every submission that has a draft grade. Explicit mode: the
        // submissions provided (using their inline grade, falling back to draft).
        const targets = all.filter((s) => {
          if (inline.has(s.id)) return true;
          if (body.send_all) return s.draft_grade !== null && s.draft_grade !== undefined;
          return false;
        });
        if (!targets.length) {
          return bad(body.send_all ? 'No draft grades to return yet — enter grades first' : 'Nothing selected to return');
        }

        const nowIso = new Date().toISOString();
        const returned: any[] = [];
        for (const s of targets) {
          const grade = inline.has(s.id) ? inline.get(s.id) : s.draft_grade;
          if (grade === null || grade === undefined) continue;
          if (post.points_possible != null && grade > post.points_possible) {
            return bad(`Grade for ${s.student_name || s.student_email} can\u2019t exceed ${post.points_possible} points`);
          }
          const updated = await svc.entities.Submission.update(s.id, {
            grade,
            draft_grade: null,
            graded_by: email,
            graded_at: nowIso,
            returned_at: nowIso,
            status: 'returned',
          });
          returned.push(updated);

          // StudentGrade is the single grade store — keep the Gradebook fed.
          if (post.points_possible != null) {
            const percentage = Math.round((grade / post.points_possible) * 1000) / 10;
            const existing = await svc.entities.StudentGrade.filter({ assessment_id: post.id, student_email: s.student_email }).catch(() => []);
            const fields = {
              student_email: s.student_email,
              student_id: null,
              student_name: s.student_name || null,
              assessment_id: post.id,
              assessment_title: post.title,
              assessment_type: post.type === 'quiz' ? 'quiz' : 'assignment',
              class_id: post.class_id,
              class_name: post.class_name,
              teacher_email: post.teacher_email,
              teacher_name: actorName,
              raw_score: grade,
              max_score: post.points_possible,
              percentage,
              status: 'published',
              published_at: nowIso,
              published_by: email,
            };
            if (existing?.[0]) await svc.entities.StudentGrade.update(existing[0].id, fields);
            else await svc.entities.StudentGrade.create({ ...fields, school_id: post.school_id || actor.school_id || null });
          }

          await notifyEvent(svc, {
            to_email: s.student_email,
            school_id: post.school_id || null,
            event_type: 'classwork_returned',
            title: `Graded: \u201C${post.title}\u201D`,
            body: post.points_possible != null
              ? `${actorName} returned your work — ${grade}/${post.points_possible}.`
              : `${actorName} returned your work.`,
            related_id: post.id,
          });
        }

        return Response.json({ ok: true, returned: returned.length, submissions: returned });
      }

      default:
        return bad('Unknown action');
    }
  } catch (error) {
    return Response.json({ ok: false, error: error?.message || 'Unexpected error' }, { status: 500 });
  }
}