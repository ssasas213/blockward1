// achievementAction — holder-only edits to their own achievement.
// SECURITY: content is ATTESTED once a verification is in flight or complete —
// a verified credential's content can only change through an approved
// correction, never a direct edit. Status is never client-writable.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveEffectiveActor } from '../../shared/testMode.ts';
import { pushEvent } from '../../shared/verificationFlow.ts';

const CATEGORIES = new Set(['certification', 'competition', 'academic', 'professional', 'course', 'training', 'award', 'challenge', 'other']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EDITABLE_STATUSES = new Set(['unverified', 'rejected']);
const CONTENT_FIELDS = ['title', 'issuer_org', 'issuer_contact_name', 'issuer_email', 'issuer_website', 'category', 'description', 'date_achieved', 'expires_at', 'external_credential_id', 'certificate_url', 'certificate_name', 'evidence'];

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const base44 = createClientFromRequest(req);
    const actor = await resolveEffectiveActor(base44);
    if (!actor.authorized) return Response.json({ error: actor.reason || 'Unauthorized' }, { status: actor.status || 401 });
    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const achievementId = String(body.achievement_id || '');
    const action = String(body.action || '');

    const rows = await svc.entities.Achievement.filter({ id: achievementId });
    const ach = rows?.[0];
    if (!ach) return Response.json({ error: 'Achievement not found' }, { status: 404 });
    if ((ach.holder_email || '').trim().toLowerCase() !== (actor.actor_email || '').trim().toLowerCase()) {
      return Response.json({ error: 'You can only manage your own achievements' }, { status: 403 });
    }

    if (action === 'set_visibility') {
      const updated = await svc.entities.Achievement.update(ach.id, {
        is_public: body.is_public === true,
        event_log: pushEvent(ach.event_log, 'edited', actor.actor_email, `Visibility set to ${body.is_public === true ? 'public' : 'private'}`),
      });
      return Response.json({ ok: true, achievement: updated });
    }

    if (action === 'delete') {
      if (!EDITABLE_STATUSES.has(ach.status)) {
        return Response.json({ error: 'A verified or in-verification achievement cannot be deleted — revoke it instead' }, { status: 409 });
      }
      await svc.entities.Achievement.delete(ach.id);
      return Response.json({ ok: true, deleted: true });
    }

    if (action === 'edit') {
      if (!EDITABLE_STATUSES.has(ach.status)) {
        return Response.json({ error: 'Once a verification is requested, the achievement details are locked while it is in review' }, { status: 409 });
      }
      const updates = body.updates || {};
      const clean: Record<string, unknown> = {};
      const title = String(updates.title ?? ach.title).trim();
      if (title.length < 3 || title.length > 200) return Response.json({ error: 'Achievement title must be 3–200 characters' }, { status: 400 });
      clean.title = title;
      clean.category = CATEGORIES.has(updates.category) ? updates.category : ach.category;
      clean.description = String(updates.description ?? ach.description ?? '').slice(0, 2000).trim();
      clean.issuer_org = String(updates.issuer_org ?? ach.issuer_org ?? '').slice(0, 200).trim() || null;
      clean.issuer_contact_name = String(updates.issuer_contact_name ?? ach.issuer_contact_name ?? '').slice(0, 120).trim() || null;
      clean.issuer_email = String(updates.issuer_email ?? ach.issuer_email ?? '').trim().toLowerCase() || null;
      const issuerWebsite = String(updates.issuer_website ?? ach.issuer_website ?? '').trim();
      if (issuerWebsite && !/^https:\/\//i.test(issuerWebsite)) return Response.json({ error: 'Issuer website must start with https://' }, { status: 400 });
      clean.issuer_website = issuerWebsite || null;
      clean.date_achieved = DATE_RE.test(String(updates.date_achieved || '')) ? updates.date_achieved : (DATE_RE.test(String(ach.date_achieved || '')) ? ach.date_achieved : null);
      clean.expires_at = DATE_RE.test(String(updates.expires_at || '')) ? updates.expires_at : null;
      clean.external_credential_id = String(updates.external_credential_id ?? ach.external_credential_id ?? '').slice(0, 100).trim() || null;
      clean.certificate_url = String(updates.certificate_url ?? ach.certificate_url ?? '').slice(0, 2000).trim() || null;
      clean.certificate_name = String(updates.certificate_name ?? ach.certificate_name ?? '').slice(0, 200).trim() || null;
      clean.evidence = Array.isArray(updates.evidence)
        ? updates.evidence.slice(0, 5).map((e: any) => ({ name: String(e?.name || 'Evidence').slice(0, 120), url: String(e?.url || '').slice(0, 2000) })).filter((e: any) => e.url)
        : ach.evidence;

      const updated = await svc.entities.Achievement.update(ach.id, {
        ...clean,
        event_log: pushEvent(ach.event_log, 'edited', actor.actor_email, 'Achievement details updated'),
      });
      return Response.json({ ok: true, achievement: updated });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to update achievement' }, { status: 500 });
  }
}