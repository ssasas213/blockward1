/**
 * classRosterAction — teacher/admin management of a class roster. Keeps
 * Class.student_emails and Enrollment in sync (the two must never drift):
 *   add_student    — add a student by email. Idempotent: a student already on
 *                    the roster is a no-op. Creates their single Enrollment,
 *                    or reactivates the existing one after a removal.
 *   remove_student — take a student off the roster and deactivate their
 *                    Enrollment, so the class leaves My Classes too.
 * Only the class's teachers (or admins of the class's school) may act —
 * canManageClass, the same check used by classCodeAction.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { resolveEffectiveActor } from '../../shared/testMode.ts';
import { loadClass, canManageClass } from '../../shared/classwork.ts';

const bad = (msg: string, status = 400) => Response.json({ ok: false, error: msg }, { status });

export default async function (req: Request): Promise<Response> {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
    if (req.method !== 'POST') return bad('Method not allowed', 405);

    const base44 = createClientFromRequest(req);
    const actor = await resolveEffectiveActor(base44);
    if (!actor.authorized) return bad(actor.reason || 'Not authorised', actor.status || 401);
    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({})) || {};

    const klass = body.class_id ? await loadClass(svc, String(body.class_id)) : null;
    if (!klass) return bad('Class not found', 404);
    if (!canManageClass(actor, klass)) return bad('Only this class\u2019s teachers can manage its roster', 403);

    const email = String(body.student_email || '').trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad('A valid student email is required');

    // Original stored case preserved — membership is compared case-insensitively.
    const roster = Array.isArray(klass.student_emails) ? klass.student_emails : [];
    const inRoster = roster.some((e: string) => String(e).toLowerCase() === email);

    if (body.action === 'add_student') {
      if (!inRoster) {
        await svc.entities.Class.update(klass.id, { student_emails: [...roster, email] });
      }

      // Exactly one Enrollment per student per class — create or reactivate.
      const enrollments = await svc.entities.Enrollment.filter({ class_id: klass.id, student_email: email }).catch(() => []);
      const enrollment = enrollments[0];
      if (!enrollment) {
        const profiles = await svc.entities.UserProfile.filter({ user_email: email }).catch(() => []);
        const p = profiles[0] || null;
        await svc.entities.Enrollment.create({
          school_id: klass.school_id || null,
          class_id: klass.id,
          class_name: klass.name,
          student_email: email,
          student_name: p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() || email : email,
          status: 'active',
        });

        // First class join links a school-less student to the class's school
        // (mirrors joinClassByCode). A student who already has a school keeps
        // it — staff can never move a student between schools via a roster.
        if (p && !p.school_id && klass.school_id) {
          const patch: any = { school_id: klass.school_id, active_school_id: klass.school_id };
          if (klass.teacher_email) patch.primary_teacher_email = klass.teacher_email;
          try {
            const schools = await svc.entities.School.filter({ id: klass.school_id }).catch(() => []);
            if (schools[0]?.admin_email) patch.admin_email = schools[0].admin_email;
          } catch { /* best-effort */ }
          await svc.entities.UserProfile.update(p.id, patch);
        }
      } else if (enrollment.status !== 'active') {
        await svc.entities.Enrollment.update(enrollment.id, { status: 'active' });
      }

      return Response.json({ ok: true, student_count: roster.length + (inRoster ? 0 : 1) });
    }

    if (body.action === 'remove_student') {
      if (inRoster) {
        await svc.entities.Class.update(klass.id, { student_emails: roster.filter((e: string) => String(e).toLowerCase() !== email) });
      }
      const enrollments = await svc.entities.Enrollment.filter({ class_id: klass.id, student_email: email }).catch(() => []);
      for (const en of enrollments) {
        if (en.status === 'active') await svc.entities.Enrollment.update(en.id, { status: 'inactive' });
      }
      return Response.json({ ok: true, student_count: Math.max(0, roster.length - (inRoster ? 1 : 0)) });
    }

    return bad('Unknown action');
  } catch (error) {
    console.error('classRosterAction error:', error);
    return Response.json({ ok: false, error: error?.message || 'Failed to update the roster' }, { status: 500 });
  }
}