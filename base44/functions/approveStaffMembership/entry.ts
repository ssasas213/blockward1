import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { requireRealIdentity } from '../../shared/testMode.ts';
import { reviewStaffMembership } from '../../shared/staffApprovals.ts';
import { normalizeEmail } from '../../shared/profileProvisioning.ts';

// approveStaffMembership — the admin approval endpoint for staff who joined
// with a code. Accepts { membership_id, action: 'approve' | 'reject', reason? }
// or { membership_ids: [...], action: 'approve' } for bulk approve.
//
// The on-chain TEACHER_ROLE grant is a DIFFERENT thing entirely — see
// grantTeacherOnChain. This endpoint never touches the blockchain.
//
// Authorization: the REAL caller identity (never a simulated test persona)
// must be an administrator OF THE MEMBERSHIP'S SCHOOL — via their profile's
// active school, school ownership, or an active AdminSchoolMembership.
export default async function(req: Request): Promise<Response> {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

    const base44 = createClientFromRequest(req);
    const real = await requireRealIdentity(base44);
    if (!real.authorized) {
      return Response.json({ error: real.reason || 'Unauthorized' }, { status: real.status || 401 });
    }
    const adminProfile = real.profile;
    if (!adminProfile || adminProfile.user_type !== 'admin') {
      return Response.json({ error: 'Forbidden: admin role required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const ids = Array.isArray(body.membership_ids)
      ? body.membership_ids
      : (body.membership_id ? [body.membership_id] : []);
    if (ids.length === 0 || !action) {
      return Response.json({ error: 'membership_id (or membership_ids) and action are required' }, { status: 400 });
    }
    if (ids.length > 1 && action !== 'approve') {
      return Response.json({ error: 'Bulk actions are approve-only — reject one at a time with a reason' }, { status: 400 });
    }

    const svc = base44.asServiceRole;
    const adminName = `${adminProfile.first_name || ''} ${adminProfile.last_name || ''}`.trim() || real.user.email;
    const adminEmail = normalizeEmail(real.user.email);

    const results = [];
    for (const id of ids) {
      try {
        const rows = await svc.entities.StaffMembership.filter({ id });
        const membership = rows[0];
        if (!membership) {
          results.push({ membership_id: id, ok: false, error: 'Membership not found' });
          continue;
        }

        // Admin OF THAT SCHOOL: profile school, ownership, or active membership.
        let authorized = (adminProfile.school_id || adminProfile.active_school_id) === membership.school_id;
        if (!authorized) {
          const schools = await svc.entities.School.filter({ id: membership.school_id });
          if (schools[0]?.admin_email && normalizeEmail(schools[0].admin_email) === adminEmail) {
            authorized = true;
          }
        }
        if (!authorized) {
          const memberships = await svc.entities.AdminSchoolMembership.filter({
            school_id: membership.school_id, admin_email: real.user.email, status: 'active',
          });
          if (memberships.length > 0) authorized = true;
        }
        if (!authorized) {
          results.push({ membership_id: id, ok: false, error: 'You are not an administrator of this school' });
          continue;
        }

        const result = await reviewStaffMembership(svc, {
          membership,
          action,
          reason: body.reason,
          approver: { email: real.user.email, name: adminName },
        });
        results.push({ membership_id: id, ...result });
      } catch (e) {
        results.push({ membership_id: id, ok: false, error: e?.message || 'Failed' });
      }
    }

    const failed = results.filter((r) => !r.ok);
    return Response.json(
      { ok: failed.length === 0, results, failed_count: failed.length },
      { status: 200 },
    );
  } catch (error) {
    console.error('approveStaffMembership error:', error);
    return Response.json({ error: error?.message || 'Failed to process request' }, { status: 500 });
  }
}