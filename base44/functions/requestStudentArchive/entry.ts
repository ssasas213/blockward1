/**
 * requestStudentArchive — Called by ADMIN to set a record to 'pending_student_drive'.
 * 
 * This tells the system: "This record is approved but the student must connect
 * their Google Drive and archive it themselves."
 * 
 * The student will see the record in their Portfolio Vault page with a
 * "Save to My Drive" button.
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

  const user = await base44.auth.me();
  if (!user) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: CORS });

  const profiles = await base44.asServiceRole.entities.UserProfile.filter({ user_email: user.email });
  const profile = profiles[0];
  if (!profile) return Response.json({ ok: false, error: 'Profile not found' }, { status: 403, headers: CORS });
  if (profile.user_type !== 'admin') return Response.json({ ok: false, error: 'Admin only' }, { status: 403, headers: CORS });

  const body = await req.json();
  const { recordId } = body;
  if (!recordId) return Response.json({ ok: false, error: 'Missing recordId' }, { headers: CORS });

  let record;
  try {
    const records = await base44.asServiceRole.entities.StudentRecord.filter({ id: recordId });
    if (!records.length) return Response.json({ ok: false, error: 'Record not found' }, { status: 404, headers: CORS });
    record = records[0];
  } catch (e) {
    return Response.json({ ok: false, error: 'Record not found' }, { status: 404, headers: CORS });
  }

  if (profile.school_id !== record.school_id) {
    return Response.json({ ok: false, error: 'Access denied: wrong school' }, { status: 403, headers: CORS });
  }

  if (record.status !== 'approved') {
    return Response.json({ ok: false, error: `Record must be 'approved'. Current: '${record.status}'` }, { status: 409, headers: CORS });
  }

  if (!record.admin_signed || !record.teacher_signed) {
    return Response.json({ ok: false, error: 'Both teacher and admin signatures required' }, { status: 409, headers: CORS });
  }

  const now = new Date().toISOString();
  const actorName = `${profile.first_name} ${profile.last_name}`;

  // Set status to pending_student_drive
  await base44.asServiceRole.entities.StudentRecord.update(recordId, {
    status: 'pending_student_drive',
  });

  // Audit log
  await base44.asServiceRole.entities.AuditLog.create({
    record_id: recordId,
    school_id: record.school_id,
    actor_email: user.email,
    actor_name: actorName,
    actor_role: 'admin',
    action: 'status_changed',
    old_status: 'approved',
    new_status: 'pending_student_drive',
    notes: 'Record set to pending student drive connection. Student must connect Google Drive and archive from Portfolio Vault.',
    timestamp: now
  });

  return Response.json({ ok: true, status: 'pending_student_drive' }, { headers: CORS });
});