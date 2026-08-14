/**
 * getRecordDetail — Fetches a single StudentRecord with all related data
 * (signatures, audit logs) for the RecordDetail page.
 *
 * Uses resolveEffectiveActor so that in Test Mode the effective persona's
 * role/email/id drive permission checks and the signature profile loaded —
 * the frontend receives the persona's profile + email, so RecordDetail's
 * role-dependent UI renders exactly as it would for a real user of that role.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { resolveEffectiveActor } from '../../shared/testMode.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'content-type': 'application/json'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const base44 = createClientFromRequest(req);

  try {
    const actor = await resolveEffectiveActor(base44);
    if (!actor.authorized) return Response.json({ ok: false, error: actor.reason || 'Unauthorized' }, { status: actor.status || 401, headers: CORS });

    // Map the effective actor onto profile/user objects the frontend expects.
    const profile = {
      id: actor.actor_id, user_type: actor.actor_role,
      first_name: actor.first_name, last_name: actor.last_name,
      school_id: actor.school_id, status: 'active',
    };
    const user = { email: actor.actor_email, id: actor.controller_user_id };

    let body;
    try { body = await req.json(); } catch (e) {
      return Response.json({ ok: false, error: 'Invalid JSON body' }, { status: 400, headers: CORS });
    }
    const { recordId } = body;
    if (!recordId) return Response.json({ ok: false, error: 'Missing recordId' }, { status: 400, headers: CORS });

    // Fetch record using service role (bypasses RLS)
    let records;
    try {
      records = await base44.asServiceRole.entities.StudentRecord.filter({ id: recordId });
    } catch (e) {
      return Response.json({ ok: false, error: 'not_found', message: 'This achievement record does not exist. It may have been deleted.' }, { status: 404, headers: CORS });
    }
    if (!records.length) {
      return Response.json({ ok: false, error: 'not_found', message: 'This achievement record does not exist. It may have been deleted.' }, { status: 404, headers: CORS });
    }
    const record = records[0];

    // Permission check — driven by the effective persona (role + email).
    const isAdmin = profile.user_type === 'admin';
    const isTeacher = profile.user_type === 'teacher' && record.teacher_email === user.email;
    const isStudent = profile.user_type === 'student' && record.student_email === user.email;
    const sameSchool = profile.school_id && record.school_id && profile.school_id === record.school_id;

    if (!sameSchool) {
      return Response.json({ ok: false, error: 'wrong_school', message: 'This record belongs to a different organisation.' }, { status: 403, headers: CORS });
    }
    if (!isAdmin && !isTeacher && !isStudent) {
      return Response.json({ ok: false, error: 'access_denied', message: 'You do not have permission to view this record.' }, { status: 403, headers: CORS });
    }

    // Fetch related data. Signature profile is loaded by the effective actor's email
    // (the persona's email in Test Mode), never the controller's.
    const [auditLogs, signatures, sigProfile] = await Promise.all([
      base44.asServiceRole.entities.AuditLog.filter({ record_id: recordId }),
      base44.asServiceRole.entities.DigitalSignature.filter({ record_id: recordId }),
      (profile.user_type === 'teacher' || profile.user_type === 'admin')
        ? base44.asServiceRole.entities.SignatureProfile.filter({ user_email: user.email, school_id: record.school_id })
        : Promise.resolve([]),
    ]);

    return Response.json({
      ok: true,
      record,
      profile,
      user,
      auditLogs: auditLogs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)),
      teacherSig: signatures.find(s => s.signer_role === 'teacher') || null,
      adminSig: signatures.find(s => s.signer_role === 'admin') || null,
      sigProfile: sigProfile[0] || null,
    }, { headers: CORS });

  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500, headers: CORS });
  }
});