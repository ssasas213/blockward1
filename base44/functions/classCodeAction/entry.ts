/**
 * classCodeAction — the ONLY writer of ClassCode records (all entity writes
 * are service-role only; RLS read is denied for everyone). Teachers of a
 * class (and school admins) generate expiring, revocable join codes and
 * links/QR invitations. Codes never grant a role — joining a class only adds
 * the student to that class's roster (joinClassByCode).
 *
 * Actions:
 *   list       — every code for a class, newest first
 *   generate   — create a new active code (optional expiry + max uses)
 *   revoke     — set a code's status to 'disabled' (stops working immediately)
 *   regenerate — disable a code and issue a fresh active replacement
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { resolveEffectiveActor } from '../../shared/testMode.ts';
import { loadClass, canManageClass } from '../../shared/classwork.ts';

const bad = (msg: string, status = 400) => Response.json({ ok: false, error: msg }, { status });

export default async function (req: Request): Promise<Response> {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
    if (req.method !== 'POST') return bad('Method not allowed', 405);

    const base44 = createClientFromRequest(req);
    const actor = await resolveEffectiveActor(base44);
    if (!actor.authorized) return bad(actor.reason || 'Not authorised', actor.status || 401);
    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({})) || {};

    // Resolve the class — directly, or through the code being revoked/regenerated.
    let classId = body.class_id ? String(body.class_id) : null;
    if (!classId && body.code_id) {
      const rows = await svc.entities.ClassCode.filter({ id: body.code_id }).catch(() => []);
      classId = rows?.[0]?.class_id || null;
    }
    const klass = classId ? await loadClass(svc, classId) : null;
    if (!klass) return bad('Class not found', 404);
    if (!canManageClass(actor, klass)) return bad('Only this class\u2019s teachers can manage its invite codes', 403);

    const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const makeCode = () => {
      let c = '';
      for (let i = 0; i < 6; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
      return c;
    };

    if (body.action === 'list') {
      const codes = await svc.entities.ClassCode.filter({ class_id: klass.id }).catch(() => []);
      const sorted = (codes || []).sort((a, b) =>
        String(b.created_date || '').localeCompare(String(a.created_date || '')));
      return Response.json({ ok: true, codes: sorted });
    }

    if (body.action === 'generate') {
      let expires_at: string | null = null;
      if (body.expires_at) {
        const ms = new Date(body.expires_at).getTime();
        if (Number.isNaN(ms) || ms <= Date.now()) return bad('Expiry must be in the future');
        expires_at = new Date(body.expires_at).toISOString();
      }
      const max_uses = body.max_uses != null && Number(body.max_uses) > 0 ? Number(body.max_uses) : null;
      const active = (await svc.entities.ClassCode.filter({ class_id: klass.id, status: 'active' }).catch(() => [])) || [];
      if (active.length >= 10) return bad('Too many active codes for this class — revoke one first');
      const code = await svc.entities.ClassCode.create({
        school_id: klass.school_id || null,
        class_id: klass.id,
        class_name: klass.name,
        code: makeCode(),
        status: 'active',
        expires_at,
        max_uses,
        use_count: 0,
        created_by: actor.actor_email,
        label: String(body.label || '').slice(0, 60) || null,
      });
      return Response.json({ ok: true, code });
    }

    if (body.action === 'revoke' || body.action === 'regenerate') {
      if (!body.code_id) return bad('code_id is required');
      const rows = await svc.entities.ClassCode.filter({ id: body.code_id }).catch(() => []);
      const code = rows?.[0];
      if (!code || code.class_id !== klass.id) return bad('Code not found for this class', 404);
      await svc.entities.ClassCode.update(code.id, { status: 'disabled' });
      if (body.action === 'revoke') return Response.json({ ok: true });
      const created = await svc.entities.ClassCode.create({
        school_id: code.school_id || null,
        class_id: code.class_id,
        class_name: code.class_name || klass.name,
        code: makeCode(),
        status: 'active',
        expires_at: code.expires_at || null,
        max_uses: code.max_uses ?? null,
        use_count: 0,
        created_by: actor.actor_email,
        label: code.label || null,
      });
      return Response.json({ ok: true, code: created });
    }

    return bad('Unknown action');
  } catch (error) {
    return Response.json({ ok: false, error: error?.message || 'Unexpected error' }, { status: 500 });
  }
}