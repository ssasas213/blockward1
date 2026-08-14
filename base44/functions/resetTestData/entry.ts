import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { verifyTestSuperUser, TEST_SCHOOL_CODE } from '../../shared/testMode.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const check = await verifyTestSuperUser(base44);
    if (!check.authorized) return Response.json({ error: check.reason || 'Unauthorized' }, { status: check.status || 403 });

    const body = await req.json().catch(() => ({}));
    if (body.confirm !== true) return Response.json({ error: 'Confirmation required' }, { status: 400 });

    const svc = base44.asServiceRole;
    const schools = await svc.entities.School.filter({ code: TEST_SCHOOL_CODE });
    if (schools.length === 0) return Response.json({ error: 'Test school not found' }, { status: 404 });
    const schoolId = schools[0].id;

    // Reset ONLY workflow/scenario data in the test school.
    // KEEP: school, persona profiles, memberships, test class, signature profiles, test config.
    const entitiesToReset = ['StudentRecord', 'BlockWard', 'BlockWardVerificationRegistry', 'DigitalSignature', 'DriveVault', 'AuditLog', 'PointEntry'];
    const counts: any = {};
    for (const name of entitiesToReset) {
      try {
        const items = await svc.entities[name].filter({ school_id: schoolId });
        if (items.length > 0) {
          await svc.entities[name].deleteMany({ school_id: schoolId });
        }
        counts[name] = items.length;
      } catch (e) {
        counts[name] = -1;
      }
    }

    return Response.json({ ok: true, school_id: schoolId, deleted: counts });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}