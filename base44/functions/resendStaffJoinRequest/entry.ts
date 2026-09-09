import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { resolveEffectiveActor } from '../../shared/testMode.ts';
import { notifyAdminsOfTeacherRequest, normalizeEmail } from '../../shared/profileProvisioning.ts';
import { findProfileByEmail } from '../../shared/profileLookup.ts';

// resendStaffJoinRequest — the teacher-side "nudge" for a pending staff join
// request. Re-notifies the school's administrators. Rate-limited to once per
// 48 hours (measured from the last reminder, or the original request time).
export default async function(req: Request): Promise<Response> {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

    const base44 = createClientFromRequest(req);
    const actor = await resolveEffectiveActor(base44);
    if (!actor.authorized) {
      return Response.json({ error: actor.reason || 'Unauthorized' }, { status: actor.status || 401 });
    }

    const svc = base44.asServiceRole;
    const rows = await svc.entities.StaffMembership.filter({ user_email: normalizeEmail(actor.actor_email) });
    const pending = rows.filter((m) => m.status === 'pending');
    if (pending.length === 0) {
      return Response.json({ error: 'You have no pending join request' }, { status: 404 });
    }
    const membership = pending[0];

    // 48-hour cooldown, measured from the last reminder or the original request.
    const cooldownMs = 48 * 60 * 60 * 1000;
    const lastMs = new Date(membership.last_reminder_at || membership.requested_at || 0).getTime();
    const waited = Date.now() - lastMs;
    if (waited < cooldownMs) {
      const hoursRemaining = Math.ceil((cooldownMs - waited) / (60 * 60 * 1000));
      return Response.json(
        { error: `You can resend your request in ${hoursRemaining} hour${hoursRemaining === 1 ? '' : 's'}` },
        { status: 429 },
      );
    }

    const now = new Date().toISOString();
    await svc.entities.StaffMembership.update(membership.id, { last_reminder_at: now });

    // Re-notify every active admin of the school (best-effort).
    const schools = await svc.entities.School.filter({ id: membership.school_id });
    const school = schools[0] || { id: membership.school_id, name: membership.school_name };
    const profile = await findProfileByEmail(svc, membership.user_email).catch(() => null);
    await notifyAdminsOfTeacherRequest(svc, {
      profile: profile || {
        id: actor.actor_id,
        first_name: actor.first_name || membership.teacher_name || '',
        last_name: actor.last_name || '',
      },
      school,
    });

    await svc.entities.AuditLog.create({
      record_id: membership.id,
      school_id: membership.school_id,
      actor_email: actor.actor_email,
      actor_name: membership.teacher_name || membership.user_email,
      actor_role: 'teacher',
      action: 'join_request_resent',
      old_status: 'pending',
      new_status: 'pending',
      notes: `Teacher re-sent their pending join request to ${membership.school_name}`,
      timestamp: now,
    });

    return Response.json({ ok: true, school_name: membership.school_name, resent_at: now });
  } catch (error) {
    console.error('resendStaffJoinRequest error:', error);
    return Response.json({ error: error?.message || 'Failed to resend request' }, { status: 500 });
  }
}