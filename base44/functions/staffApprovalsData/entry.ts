import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { requireRealIdentity } from '../../shared/testMode.ts';
import { listPendingStaff } from '../../shared/staffApprovals.ts';

// staffApprovalsData — the admin-side queue read for the Staff approvals
// surface. Runs service-role because a pending teacher's profile carries no
// school_id, so school-admin RLS cannot read it — enrichment (department,
// subjects) must happen here after the caller is verified.
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
    const schoolId = adminProfile.school_id || adminProfile.active_school_id;
    if (!schoolId) {
      return Response.json({ error: 'No active school found' }, { status: 400 });
    }

    const requests = await listPendingStaff(base44.asServiceRole, schoolId);
    return Response.json({ ok: true, school_id: schoolId, requests });
  } catch (error) {
    console.error('staffApprovalsData error:', error);
    return Response.json({ error: error?.message || 'Failed to load requests' }, { status: 500 });
  }
}