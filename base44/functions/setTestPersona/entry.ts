import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { verifyTestSuperUser, isValidPersona } from '../../shared/testMode.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const check = await verifyTestSuperUser(base44);
    if (!check.authorized) return Response.json({ error: check.reason || 'Unauthorized' }, { status: check.status || 403 });
    const user = check.user;

    const body = await req.json().catch(() => ({}));
    const persona = body.persona;
    if (!isValidPersona(persona)) return Response.json({ error: 'Invalid persona' }, { status: 400 });

    // Only the active persona pointer on the CONTROLLER profile changes.
    // The persona's own identity (name/email/role) lives on its dedicated profile,
    // set once by getTestModeStatus — so switching never mutates a "permanent role".
    const profiles = await base44.asServiceRole.entities.UserProfile.filter({ user_email: user.email });
    if (profiles.length === 0) return Response.json({ error: 'Controller profile not found' }, { status: 404 });
    const controller = profiles[0];

    await base44.asServiceRole.entities.UserProfile.update(controller.id, {
      active_test_persona: persona,
    });

    return Response.json({ ok: true, active_persona: persona });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}