/**
 * getRecordDetail — Fetches a single StudentRecord with all related data
 * (signatures, audit logs) for the RecordDetail page.
 *
 * Bypasses RLS by using asServiceRole, but enforces permissions server-side:
 *   - Admin: can see any record in their school
 *   - Teacher: can see records where they are the assigned teacher
 *   - Student: can see their own records only
 *
 * Returns a structured error message when access is denied or record not found,
 * so the frontend can show a helpful message instead of "Record not found."
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

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
    const user = await base44.auth.me();
    if (!user) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: CORS });

    const profiles = await base44.asServiceRole.entities.UserProfile.filter({ user_email: user.email });
    const profile = profiles[0];
    if (!profile) return Response.json({ ok: false, error: 'User profile not found' }, { status: 403, headers: CORS });
    if (profile.status === 'inactive' || profile.status === 'suspended') {
      return Response.json({ ok: false, error: 'Your account is inactive. Contact your administrator.' }, { status: 403, headers: CORS });
    }

    let body;
    try { body = await req.json(); } catch (e) {
      return Response.json({ ok: false, error: 'Invalid JSON body' }, { status: 400, headers: CORS });
    }
    const { recordId } = body;
    if (!recordId) return Response.json({ ok: false, error: 'Missing recordId' }, { status: 400, headers: CORS });

    // Fetch record using service role (bypasses RLS)
    const records = await base44.asServiceRole.entities.StudentRecord.filter({ id: recordId });
    if (!records.length) {
      return Response.json({ ok: false, error: 'not_found', message: 'This achievement record does not exist. It may have been deleted.' }, { status: 404, headers: CORS });
    }
    const record = records[0];

    // Permission check (server-side, since we bypassed RLS)
    const isAdmin = profile.user_type === 'admin';
    const isTeacher = profile.user_type === 'teacher' && record.teacher_email === user.email;
    const isStudent = profile.user_type === 'student' && record.student_email === user.email;

    // School check — all roles must be in the same school
    const sameSchool = profile.school_id && record.school_id && profile.school_id === record.school_id;

    if (!sameSchool) {
      return Response.json({ ok: false, error: 'wrong_school', message: 'This record belongs to a different organisation.' }, { status: 403, headers: CORS });
    }

    if (!isAdmin && !isTeacher && !isStudent) {
      return Response.json({ ok: false, error: 'access_denied', message: 'You do not have permission to view this record.' }, { status: 403, headers: CORS });
    }

    // Fetch related data
    const [auditLogs, signatures, sigProfile] = await Promise.all([
      base44.asServiceRole.entities.AuditLog.filter({ record_id: recordId }),
      base44.asServiceRole.entities.DigitalSignature.filter({ record_id: recordId }),
      (profile.user_type === 'teacher' || profile.user_type === 'admin')
        ? base44.asServiceRole.entities.SignatureProfile.filter({ user_email: user.email })
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