/**
 * adminCredentialAction — organisation admin revokes (or supersedes) a
 * delivered credential. Server-authorised: the effective actor must be an
 * admin of the organisation that ISSUED the credential. All writes are
 * service-role (registry/entity RLS stays locked); authorisation is enforced
 * here, never by hiding UI.
 *
 * Revocation is permanent and fully audited:
 *   - registry.approval_status → 'revoked' + a revocation record (who, when, why)
 *   - the underlying BlockWard (if any) is marked revoked
 *   - an AuditLog entry is written
 *   - the student receives an in-app notification
 * The public verification page then shows the credential as revoked.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveEffectiveActor } from '../../shared/testMode.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'content-type': 'application/json',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  try {
    const base44 = createClientFromRequest(req);
    const actor = await resolveEffectiveActor(base44);
    if (!actor.authorized) {
      return Response.json({ ok: false, error: actor.reason || 'Unauthorized' }, { status: actor.status || 401, headers: CORS });
    }
    if (actor.actor_role !== 'admin') {
      return Response.json({ ok: false, error: 'Only organisation admins can revoke credentials' }, { status: 403, headers: CORS });
    }
    if (!actor.school_id) {
      return Response.json({ ok: false, error: 'You are not associated with an organisation' }, { status: 403, headers: CORS });
    }

    const body = await req.json().catch(() => ({}));
    const { action } = body;
    if (action !== 'revoke') {
      return Response.json({ ok: false, error: 'Unknown action' }, { status: 400, headers: CORS });
    }

    const verificationId = String(body.verification_id || '').trim();
    const reason = String(body.reason || '').trim();
    const supersededBy = String(body.superseded_by_verification_id || '').trim() || null;
    if (!verificationId) return Response.json({ ok: false, error: 'Missing verification_id' }, { status: 400, headers: CORS });
    if (!reason) return Response.json({ ok: false, error: 'A reason is required to revoke a credential' }, { status: 400, headers: CORS });
    if (supersededBy === verificationId) {
      return Response.json({ ok: false, error: 'A credential cannot supersede itself' }, { status: 400, headers: CORS });
    }

    const svc = base44.asServiceRole;
    const rows = await svc.entities.BlockWardVerificationRegistry.filter({ verification_id: verificationId });
    const reg = rows?.[0] || null;
    if (!reg) return Response.json({ ok: false, error: 'Credential not found' }, { status: 404, headers: CORS });

    // Own organisation ONLY — never another school's credentials.
    if (reg.school_id !== actor.school_id) {
      return Response.json({ ok: false, error: 'This credential belongs to a different organisation' }, { status: 403, headers: CORS });
    }
    if (reg.approval_status === 'revoked') {
      return Response.json({ ok: false, error: 'This credential is already revoked' }, { status: 400, headers: CORS });
    }

    const now = new Date().toISOString();
    const actorName = `${actor.first_name || ''} ${actor.last_name || ''}`.trim() || actor.actor_email;

    // 1. Registry — the public source of truth for the verification page.
    await svc.entities.BlockWardVerificationRegistry.update(reg.id, {
      approval_status: 'revoked',
      revocation: {
        reason,
        revoked_by: actor.actor_email,
        revoked_by_name: actorName,
        revoked_at: now,
        superseded_by_verification_id: supersededBy,
      },
    });

    // 2. Underlying BlockWard (legacy verification path checks this).
    if (reg.blockward_id) {
      try { await svc.entities.BlockWard.update(reg.blockward_id, { status: 'revoked' }); } catch (e) { /* best-effort */ }
    }

    // 3. Audit trail.
    try {
      await svc.entities.AuditLog.create({
        school_id: actor.school_id,
        actor_email: actor.actor_email,
        actor_name: actorName,
        actor_role: 'admin',
        action: 'status_changed',
        target_type: 'record',
        record_id: reg.student_record_id || reg.id,
        target_id: reg.student_record_id || reg.id,
        target_email: reg.student_email || null,
        target_label: reg.achievement_title || verificationId,
        old_status: 'approved',
        new_status: 'revoked',
        before_summary: `credential ${verificationId} approved`,
        after_summary: `credential ${verificationId} revoked${supersededBy ? ` (superseded by ${supersededBy})` : ''}`,
        notes: `Credential revoked by organisation admin ${actorName} (${actor.actor_email}). Reason: ${reason}${supersededBy ? `. Superseded by ${supersededBy}` : ''}`,
        timestamp: now,
      });
    } catch (e) { /* audit is best-effort but should not exist silently — log */ console.warn('audit write failed', e?.message); }

    // 4. Notify the student in-app.
    if (reg.student_email) {
      try {
        await svc.entities.Notification.create({
          user_email: reg.student_email,
          school_id: actor.school_id,
          title: 'A credential was revoked',
          body: `"${reg.achievement_title}" was revoked by ${actorName} on behalf of your organisation. Reason: ${reason}`,
          type: 'message',
          priority: 'important',
          related_id: reg.id,
        });
      } catch (e) { /* best-effort */ }
    }

    return Response.json({
      ok: true,
      verification_id: verificationId,
      approval_status: 'revoked',
      revocation: { reason, revoked_by: actor.actor_email, revoked_by_name: actorName, revoked_at: now, superseded_by_verification_id: supersededBy },
    }, { headers: CORS });
  } catch (e) {
    return Response.json({ ok: false, error: e?.message || String(e) }, { status: 500, headers: CORS });
  }
});