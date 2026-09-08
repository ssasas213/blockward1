import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { requireRealIdentity } from '../../shared/testMode.ts';

// removeAchievementCover — lets an organisation admin remove the public cover
// image from any credential their organisation issued (moderation backstop).
// Clears the registry's public image and the source StudentRecord cover, and
// ALWAYS writes an audit log entry so removals are attributable.
export default async function(req: Request): Promise<Response> {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

    const base44 = createClientFromRequest(req);

    // PRIVILEGED — moderation authorises against the REAL controller identity,
    // never the active test persona.
    const real = await requireRealIdentity(base44);
    if (!real.authorized) return Response.json({ error: real.reason || 'Unauthorized' }, { status: real.status || 401 });
    const caller = real.profile;
    if (!caller || caller.user_type !== 'admin' || !caller.school_id) {
      return Response.json({ error: 'Only an organisation administrator can remove cover images' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const svc = base44.asServiceRole;
    const rows = body.verification_id
      ? await svc.entities.BlockWardVerificationRegistry.filter({ verification_id: body.verification_id })
      : await svc.entities.BlockWardVerificationRegistry.filter({ id: body.registry_id || 'none' });
    const registry = rows?.[0];
    if (!registry) return Response.json({ error: 'Credential not found' }, { status: 404 });

    // Only the issuing organisation may remove its own credentials' covers.
    if (registry.school_id !== caller.school_id) {
      return Response.json({ error: 'Your organisation did not issue this credential' }, { status: 403 });
    }
    if (!registry.achievement_image) {
      return Response.json({ ok: true, already_removed: true });
    }

    await svc.entities.BlockWardVerificationRegistry.update(registry.id, { achievement_image: null });
    // Source-of-truth record: clear the cover so re-delivery can't restore it.
    if (registry.student_record_id) {
      try {
        await svc.entities.StudentRecord.update(registry.student_record_id, { custom_nft_image_url: null });
      } catch { /* best-effort — the public registry entry is the gate */ }
    }

    const now = new Date().toISOString();
    await svc.entities.AuditLog.create({
      record_id: registry.id,
      school_id: registry.school_id,
      actor_email: real.user.email,
      actor_name: `${caller.first_name || ''} ${caller.last_name || ''}`.trim() || real.user.email,
      actor_role: 'admin',
      action: 'cover_image_removed',
      notes: `Public cover image removed from "${registry.achievement_title}" (${registry.verification_id})${body.reason ? ` — ${body.reason}` : ''}`,
      timestamp: now,
    });

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to remove cover image' }, { status: 500 });
  }
}