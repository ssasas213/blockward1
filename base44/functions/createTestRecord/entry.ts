import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { verifyTestSuperUser } from '../../shared/testMode.ts';

/**
 * createTestRecord — Test Mode only. Creates a StudentRecord as the active test
 * persona (service role), because RLS would block a create whose student_email /
 * teacher_email is the persona's email (it won't match the controller's email).
 *
 * Student persona → creates a record owned by the student persona.
 * Teacher persona → creates a record issued by the teacher persona for a chosen student.
 * Admin persona → 403 (admins don't create student records).
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const check = await verifyTestSuperUser(base44);
    if (!check.authorized) return Response.json({ error: check.reason || 'Unauthorized' }, { status: check.status || 403 });

    const body = await req.json().catch(() => ({}));

    // Resolve the effective actor (active persona) server-side.
    const actorRes = await base44.functions.invoke('getTestModeStatus');
    const status = actorRes.data;
    if (!status?.is_test_super_user) return Response.json({ error: 'Not a test super user' }, { status: 403 });
    const persona = status.active_persona;
    const personas = status.personas;
    const actor = personas[persona];
    if (!actor) return Response.json({ error: 'Active persona not found' }, { status: 404 });
    const schoolId = status.test_school.id;

    const svc = base44.asServiceRole;

    if (persona === 'student') {
      const record = await svc.entities.StudentRecord.create({
        school_id: schoolId,
        student_id: actor.id,
        student_email: actor.email,
        student_name: actor.name,
        owner_student_id: actor.id,
        owner_student_email: actor.email,
        owner_school_id: schoolId,
        title: body.title,
        category: body.category || 'academic',
        description: body.description || null,
        date_achieved: body.date_achieved || null,
        file_url: body.file_url || null,
        teacher_email: body.teacher_email || null,
        teacher_name: body.teacher_name || null,
        status: 'draft',
        origin: 'student',
      });
      return Response.json({ ok: true, record });
    }

    if (persona === 'teacher') {
      if (!body.student_email) return Response.json({ error: 'student_email is required' }, { status: 400 });
      const studentPersona = personas.student;
      const record = await svc.entities.StudentRecord.create({
        school_id: schoolId,
        student_id: studentPersona.id,
        student_email: body.student_email,
        student_name: body.student_name || studentPersona.name,
        owner_student_id: studentPersona.id,
        owner_student_email: body.student_email,
        owner_school_id: schoolId,
        teacher_id: actor.id,
        teacher_email: actor.email,
        teacher_name: actor.name,
        title: body.title,
        category: body.category || 'academic',
        description: body.description || null,
        date_achieved: body.date_achieved || null,
        file_url: body.file_url || null,
        status: 'draft',
        origin: 'teacher',
      });
      return Response.json({ ok: true, record });
    }

    return Response.json({ error: 'Admins do not create student records' }, { status: 403 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}