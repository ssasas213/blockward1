/**
 * academicSettingsAction — server-authorised mutations for an organisation's
 * academic settings: credential (award) types and year groups.
 *
 * Why this exists: the AwardTypes/YearGroup entity RLS gates writes on the
 * PLATFORM user role, but BlockWard authorises staff on UserProfile.user_type
 * (see shared/staffAuth.ts). A legitimate BlockWard school admin whose
 * platform role is 'user' was therefore silently unable to save academic
 * settings. Mutations now run here, authorised the same way as every other
 * staff write: resolveEffectiveActor → admin role → the actor's OWN active
 * school. The client never supplies a school_id — the target record's
 * school_id must match the admin's school, so a manipulated ID can never
 * mutate another organisation's settings. Reads stay on the existing
 * school-scoped entity reads and are unchanged.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { resolveEffectiveActor } from '../../shared/testMode.ts';

const bad = (msg: string, status = 400) => Response.json({ ok: false, error: msg }, { status });

const AWARD_CATEGORIES = ['academic', 'sports', 'arts', 'leadership', 'community', 'special'];

export default async function (req: Request): Promise<Response> {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
    if (req.method !== 'POST') return bad('Method not allowed', 405);

    const base44 = createClientFromRequest(req);
    const actor = await resolveEffectiveActor(base44);
    if (!actor.authorized) return bad(actor.reason || 'Not authorised', actor.status || 401);
    if (actor.actor_role !== 'admin' || !actor.school_id) {
      return bad('Only organisation admins may change academic settings', 403);
    }
    const schoolId = actor.school_id;
    const svc = base44.asServiceRole;

    const body = await req.json().catch(() => ({})) || {};
    const { entity, action } = body;

    // ── Credential (award) types ──────────────────────────────────────────
    if (entity === 'award_type') {
      if (action === 'create') {
        const code = String(body.code || '').trim().toUpperCase().replace(/\s+/g, '_');
        const title = String(body.title || '').trim();
        const category = String(body.category || 'academic');
        const tier = Number(body.verification_tier || 1);
        if (!code || !title) return bad('Code and title are required');
        if (!AWARD_CATEGORIES.includes(category)) return bad('Unknown category');
        if (![1, 2, 3].includes(tier)) return bad('Approval tier must be 1, 2 or 3');
        // Duplicate / double-submit protection — the code is unique per school.
        const dupe = await svc.entities.AwardTypes.filter({ school_id: schoolId, code });
        if (dupe && dupe.length) return bad(`A credential type with the code ${code} already exists`, 409);
        await svc.entities.AwardTypes.create({
          school_id: schoolId,
          code,
          title,
          category,
          verification_tier: tier,
          requires_evidence: body.requires_evidence === true,
          is_active: true,
        });
        return Response.json({ ok: true });
      }

      if (action === 'update') {
        const rows = await svc.entities.AwardTypes.filter({ id: body.id });
        const row = rows?.[0];
        // Cross-school protection — the record must belong to the admin's own school.
        if (!row || row.school_id !== schoolId) return bad('Credential type not found', 404);
        const updates: any = {};
        if (body.title !== undefined) {
          const t = String(body.title).trim();
          if (!t) return bad('Title is required');
          updates.title = t;
        }
        if (body.category !== undefined) {
          if (!AWARD_CATEGORIES.includes(body.category)) return bad('Unknown category');
          updates.category = body.category;
        }
        if (body.verification_tier !== undefined) {
          const t = Number(body.verification_tier);
          if (![1, 2, 3].includes(t)) return bad('Approval tier must be 1, 2 or 3');
          updates.verification_tier = t;
        }
        if (body.requires_evidence !== undefined) updates.requires_evidence = body.requires_evidence === true;
        if (body.is_active !== undefined) updates.is_active = body.is_active === true;
        await svc.entities.AwardTypes.update(row.id, updates);
        return Response.json({ ok: true });
      }

      if (action === 'delete') {
        const rows = await svc.entities.AwardTypes.filter({ id: body.id });
        const row = rows?.[0];
        if (!row || row.school_id !== schoolId) return bad('Credential type not found', 404);
        await svc.entities.AwardTypes.delete(row.id);
        return Response.json({ ok: true });
      }
      return bad('Unknown action');
    }

    // ── Year groups ───────────────────────────────────────────────────────
    if (entity === 'year_group') {
      if (action === 'create') {
        const name = String(body.name || '').trim();
        if (!name) return bad('A name is required');
        const existing = await svc.entities.YearGroup.filter({ school_id: schoolId });
        if ((existing || []).some((g: any) => String(g.name || '').toLowerCase() === name.toLowerCase())) {
          return bad(`A year group named "${name}" already exists`, 409);
        }
        await svc.entities.YearGroup.create({ school_id: schoolId, name, status: 'active' });
        return Response.json({ ok: true });
      }

      if (action === 'update') {
        const rows = await svc.entities.YearGroup.filter({ id: body.id });
        const row = rows?.[0];
        if (!row || row.school_id !== schoolId) return bad('Year group not found', 404);
        const updates: any = {};
        if (body.status !== undefined) {
          if (!['active', 'archived'].includes(body.status)) return bad('Unknown status');
          updates.status = body.status;
        }
        if (body.name !== undefined) {
          const n = String(body.name).trim();
          if (!n) return bad('A name is required');
          updates.name = n;
        }
        await svc.entities.YearGroup.update(row.id, updates);
        return Response.json({ ok: true });
      }
      return bad('Unknown action');
    }

    return bad('Unknown entity');
  } catch (error) {
    return Response.json({ ok: false, error: error?.message || 'Unexpected error' }, { status: 500 });
  }
}