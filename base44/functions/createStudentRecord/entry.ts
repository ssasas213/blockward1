import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveEffectiveActor } from '../../shared/testMode.ts';

// Creates a StudentRecord (achievement) as a 'draft'. This is the ONLY sanctioned
// creation path — the StudentRecord entity create is locked to __service_role_only__
// because RLS cannot distinguish a teacher from an admin (both platform "user"/
// "admin" map ambiguously here), so an admin could otherwise create a record by
// setting teacher_email to their own email.
//
// Only a teacher or student may create an achievement record. Admins are
// rejected — they review and sign, they never create. Test Mode: the effective
// actor is the active persona, so a test-super-user impersonating a teacher or
// student creates as that persona (and an admin persona is still blocked).
export default async function(req: Request): Promise<Response> {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

    const base44 = createClientFromRequest(req);
    const actor = await resolveEffectiveActor(base44);
    if (!actor.authorized) return Response.json({ error: actor.reason || 'Unauthorized' }, { status: actor.status || 401 });
    if (actor.actor_role === 'admin') {
      return Response.json({ error: 'Administrators review and sign achievements — only teachers or students may create one' }, { status: 403 });
    }
    if (!actor.school_id) return Response.json({ error: 'You are not associated with a school' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    if (!body.title) return Response.json({ error: 'title is required' }, { status: 400 });
    if (!body.category) return Response.json({ error: 'category is required' }, { status: 400 });

    const record = { school_id: actor.school_id, status: 'draft', origin: actor.actor_role };

    if (actor.actor_role === 'teacher') {
      // Teacher issues an achievement on behalf of a student — look the student up
      // and validate they belong to the same school.
      const studentEmail = String(body.student_email || '').trim().toLowerCase();
      if (!studentEmail) return Response.json({ error: 'student_email is required' }, { status: 400 });
      const sp = await base44.asServiceRole.entities.UserProfile.filter({ user_email: studentEmail });
      const student = sp[0];
      if (!student) return Response.json({ error: 'Student not found' }, { status: 404 });
      if (student.school_id !== actor.school_id) return Response.json({ error: 'Student is not in your school' }, { status: 403 });
      record.student_email = student.user_email;
      record.student_name = `${student.first_name} ${student.last_name}`;
      record.student_id = student.id;
      record.owner_student_id = student.id;
      record.owner_student_email = student.user_email;
      record.owner_school_id = actor.school_id;
      record.teacher_email = actor.actor_email;
      record.teacher_name = `${actor.first_name} ${actor.last_name}`;
      record.teacher_id = actor.actor_id;
    } else {
      // Student submits their own achievement — a validating teacher is chosen.
      record.student_email = actor.actor_email;
      record.student_name = `${actor.first_name} ${actor.last_name}`;
      record.student_id = actor.actor_id;
      record.owner_student_id = actor.actor_id;
      record.owner_student_email = actor.actor_email;
      record.owner_school_id = actor.school_id;
      const teacherEmail = String(body.teacher_email || '').trim().toLowerCase();
      if (!teacherEmail) return Response.json({ error: 'teacher_email is required' }, { status: 400 });
      const tp = await base44.asServiceRole.entities.UserProfile.filter({ user_email: teacherEmail });
      const teacher = tp[0];
      if (!teacher || teacher.school_id !== actor.school_id || teacher.user_type !== 'teacher') {
        return Response.json({ error: 'Invalid validating teacher' }, { status: 400 });
      }
      record.teacher_email = teacher.user_email;
      record.teacher_name = `${teacher.first_name} ${teacher.last_name}`;
    }

    // Content fields (common to both origins).
    record.title = body.title;
    record.category = body.category;
    record.description = body.description || null;
    record.date_achieved = body.date_achieved || null;
    record.file_url = body.file_url || null;
    record.file_type = body.file_type || null;
    record.certificate_url = body.certificate_url || null;
    record.teacher_notes = body.teacher_notes || null;
    record.teacher_signature_url = body.teacher_signature_url || null;
    if (body.class_id) record.class_id = body.class_id;
    if (body.class_name) record.class_name = body.class_name;

    if (body.is_custom_award) {
      record.is_custom_award = true;
      record.custom_award_icon = body.custom_award_icon || null;
      record.custom_award_color = body.custom_award_color || null;
      record.points = body.points || 0;
      record.custom_nft_image_url = body.custom_nft_image_url || null;
    } else {
      record.award_type_id = body.award_type_id || null;
      record.award_type_title = body.award_type_title || null;
      record.is_custom_award = false;
    }

    const created = await base44.asServiceRole.entities.StudentRecord.create(record);
    return Response.json({ ok: true, record: created });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to create record' }, { status: 500 });
  }
}