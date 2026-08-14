import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { verifyTestSuperUser, PERSONAS, isValidPersona } from '../../shared/testMode.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const check = await verifyTestSuperUser(base44);
    if (!check.authorized) return Response.json({ error: check.reason || 'Unauthorized' }, { status: check.status || 403 });
    const user = check.user;

    const body = await req.json().catch(() => ({}));
    const persona = body.persona;
    if (!isValidPersona(persona)) return Response.json({ error: 'Invalid persona' }, { status: 400 });

    const personaName = PERSONAS[persona];
    const profiles = await base44.asServiceRole.entities.UserProfile.filter({ user_email: user.email });
    if (profiles.length === 0) return Response.json({ error: 'Profile not found' }, { status: 404 });
    const profile = profiles[0];

    const updated = await base44.asServiceRole.entities.UserProfile.update(profile.id, {
      active_test_persona: persona,
      first_name: personaName.first_name,
      last_name: personaName.last_name,
    });

    return Response.json({
      ok: true,
      active_persona: persona,
      profile: { first_name: updated.first_name, last_name: updated.last_name },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}