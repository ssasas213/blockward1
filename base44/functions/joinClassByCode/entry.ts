/**
 * joinClassByCode — Student class self-enrollment by join code.
 *
 * The frontend (Classes.jsx) previously tried to add the joining student
 * directly to Class.student_emails via a client-side base44.entities.Class.update()
 * call. Class's RLS only allows the class's teacher or an admin to update a Class
 * record, so that call was silently rejected for every student — "join class"
 * never actually worked. This function does the same work server-side via the
 * service-role client (mirrors the existing joinSchoolByCode pattern), so the
 * student never needs write access to the Class record themselves.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { resolveEffectiveActor } from '../../shared/testMode.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'content-type': 'application/json',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return Response.json({ ok: false, error: 'Method not allowed' }, { status: 405, headers: CORS });

  const base44 = createClientFromRequest(req);

  try {
    const actor = await resolveEffectiveActor(base44);
    if (!actor.authorized) {
      return Response.json({ ok: false, error: actor.reason || 'Unauthorized' }, { status: actor.status || 401, headers: CORS });
    }
    if (actor.actor_role !== 'student') {
      return Response.json({ ok: false, error: 'Only students can join a class by code.' }, { status: 403, headers: CORS });
    }

    let body;
    try { body = await req.json(); } catch (e) {
      return Response.json({ ok: false, error: 'Invalid JSON body' }, { status: 400, headers: CORS });
    }
    const code = (body.code || '').trim().toUpperCase();
    if (!code) return Response.json({ ok: false, error: 'A class code is required.' }, { status: 400, headers: CORS });

    const svc = base44.asServiceRole;

    // Look up the class by code (case-insensitive).
    let matches = await svc.entities.Class.filter({ join_code: code }).catch(() => []);
    let cls = matches[0] || null;
    if (!cls) {
      const all = await svc.entities.Class.filter({}).catch(() => []);
      cls = all.find(c => (c.join_code || '').toUpperCase() === code) || null;
    }
    if (!cls) {
      return Response.json({ ok: false, error: 'Invalid class code. No class found with that code.' }, { status: 404, headers: CORS });
    }
    if (cls.status && cls.status !== 'active') {
      return Response.json({ ok: false, error: 'This class is no longer active.' }, { status: 403, headers: CORS });
    }

    const studentEmail = actor.actor_email;
    const alreadyIn = (cls.student_emails || []).includes(studentEmail);
    if (alreadyIn) {
      return Response.json({ ok: false, error: 'You are already in this class.' }, { status: 409, headers: CORS });
    }

    // Add the student to the class roster.
    const updatedEmails = [...(cls.student_emails || []), studentEmail];
    await svc.entities.Class.update(cls.id, { student_emails: updatedEmails });

    // Create the Enrollment record if one doesn't already exist.
    const existingEnrollments = await svc.entities.Enrollment.filter({ class_id: cls.id, student_email: studentEmail }).catch(() => []);
    if (!existingEnrollments.length) {
      await svc.entities.Enrollment.create({
        school_id: cls.school_id || actor.school_id || null,
        class_id: cls.id,
        class_name: cls.name,
        student_email: studentEmail,
        student_name: `${actor.first_name || ''} ${actor.last_name || ''}`.trim() || studentEmail,
        status: 'active',
      });
    }

    // Bootstrap the student's school/teacher/admin hierarchy fields if unset —
    // mirrors the prior client-side behaviour so first-time joins still link
    // the student to the class's school.
    const profiles = await svc.entities.UserProfile.filter({ user_email: studentEmail }).catch(() => []);
    const profile = profiles[0] || null;
    if (profile) {
      const patch = {};
      if (!profile.school_id && cls.school_id) patch.school_id = cls.school_id;
      if (!profile.active_school_id && cls.school_id) patch.active_school_id = cls.school_id;
      if (!profile.primary_teacher_email && cls.teacher_email) patch.primary_teacher_email = cls.teacher_email;
      if (!profile.admin_email && cls.school_id) {
        try {
          const schools = await svc.entities.School.filter({ id: cls.school_id }).catch(() => []);
          if (schools[0]?.admin_email) patch.admin_email = schools[0].admin_email;
        } catch { /* best-effort */ }
      }
      if (Object.keys(patch).length) {
        await svc.entities.UserProfile.update(profile.id, patch);
      }
    }

    return Response.json({ ok: true, class: { id: cls.id, name: cls.name, subject: cls.subject || null } }, { headers: CORS });
  } catch (error) {
    console.error('joinClassByCode error:', error);
    return Response.json({ ok: false, error: error.message || 'Failed to join class' }, { status: 500, headers: CORS });
  }
});
