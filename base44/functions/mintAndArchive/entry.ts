/**
 * mintAndArchive — DEPRECATED: Admin override archive path.
 *
 * This function previously archived to Google Drive. It has been converted to
 * use the BlockWard Vault as the permanent storage location, consistent with
 * the standard sendToVault workflow.
 *
 * It now simply delegates to the same vault delivery logic: creates a BlockWard
 * record, generates NFT metadata, and marks the record as delivered_to_vault.
 * The override_reason is still audited.
 *
 * Security:
 * - Admin must be authenticated and belong to same school as the record
 * - Record must be 'approved' with both signatures
 * - override_reason is REQUIRED (audited)
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
    if (!profile) return Response.json({ ok: false, error: 'Profile not found' }, { status: 403, headers: CORS });
    if (profile.user_type !== 'admin') return Response.json({ ok: false, error: 'Admin only' }, { status: 403, headers: CORS });
    if (profile.status === 'inactive' || profile.status === 'suspended') {
      return Response.json({ ok: false, error: 'Account inactive' }, { status: 403, headers: CORS });
    }

    let body;
    try { body = await req.json(); } catch (e) {
      return Response.json({ ok: false, error: 'Invalid JSON body' }, { status: 400, headers: CORS });
    }
    const { recordId, override_reason } = body;
    if (!recordId) return Response.json({ ok: false, error: 'Missing recordId' }, { status: 400, headers: CORS });
    if (!override_reason || !override_reason.trim()) {
      return Response.json({ ok: false, error: 'A reason is required for admin override delivery' }, { status: 400, headers: CORS });
    }

    // Fetch record
    const records = await base44.asServiceRole.entities.StudentRecord.filter({ id: recordId });
    if (!records.length) return Response.json({ ok: false, error: 'Record not found' }, { status: 404, headers: CORS });
    const record = records[0];

    if (profile.school_id !== record.school_id) {
      return Response.json({ ok: false, error: 'Access denied: wrong school' }, { status: 403, headers: CORS });
    }
    if (record.status !== 'approved') {
      return Response.json({ ok: false, error: `Record must be 'approved'. Current: '${record.status}'` }, { status: 409, headers: CORS });
    }
    if (!record.admin_signed || !record.teacher_signed) {
      return Response.json({ ok: false, error: 'Both teacher and admin signatures required' }, { status: 409, headers: CORS });
    }

    // Delegate to the standard workflow's sendToVault logic via direct invocation
    const result = await base44.functions.invoke('recordWorkflow', {
      action: 'sendToVault',
      recordId,
    });

    if (!result.data?.ok) {
      return Response.json({ ok: false, error: result.data?.error || 'Vault delivery failed' }, { status: 500, headers: CORS });
    }

    // Audit the override reason
    const actorName = `${profile.first_name} ${profile.last_name}`;
    await base44.asServiceRole.entities.AuditLog.create({
      record_id: recordId,
      school_id: record.school_id,
      actor_email: user.email,
      actor_name: actorName,
      actor_role: 'admin',
      action: 'sent_to_student_vault',
      old_status: 'approved',
      new_status: 'delivered_to_vault',
      notes: `ADMIN OVERRIDE — ${override_reason}`,
      timestamp: new Date().toISOString()
    });

    return Response.json({
      ok: true,
      ...result.data,
      overrideReason: override_reason,
    }, { headers: CORS });

  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500, headers: CORS });
  }
});