/**
 * anchorRetry — admin maintenance endpoint: (re)trigger on-chain anchoring for
 * a delivered credential whose anchor is pending or failed (e.g. after a
 * chain outage or an organisation becoming verified). Anchoring itself is
 * idempotent — a credential that is already anchored is returned as-is.
 *
 * Auth: logged-in organisation admin; the credential must belong to their
 * organisation (school-less independent credentials may be retriggered by any
 * admin — anchoring is platform-side).
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { resolveEffectiveActor } from '../../shared/testMode.ts';
import { anchorCredential } from '../../shared/chainAnchor.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'content-type': 'application/json'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  try {
    const base44 = createClientFromRequest(req);
    const actor = await resolveEffectiveActor(base44);
    if (!actor.authorized) {
      return Response.json({ ok: false, error: actor.reason || 'Unauthorized' }, { status: actor.status || 401, headers: CORS });
    }
    if (actor.actor_role !== 'admin') {
      return Response.json({ ok: false, error: 'Only organisation admins can re-trigger anchoring' }, { status: 403, headers: CORS });
    }

    const body = await req.json().catch(() => ({}));
    const { verification_id } = body;
    if (!verification_id) return Response.json({ ok: false, error: 'Missing verification_id' }, { status: 400, headers: CORS });

    const rows = await base44.asServiceRole.entities.BlockWardVerificationRegistry.filter({ verification_id });
    const reg = rows?.[0] || null;
    if (!reg) return Response.json({ ok: false, error: 'Credential not found' }, { status: 404, headers: CORS });
    if (reg.school_id && reg.school_id !== actor.school_id) {
      return Response.json({ ok: false, error: 'This credential belongs to a different organisation' }, { status: 403, headers: CORS });
    }

    const result = await anchorCredential(base44.asServiceRole, reg.id);
    return Response.json({ ok: !!result.ok, verification_id, ...result }, { headers: CORS });
  } catch (e) {
    return Response.json({ ok: false, error: e?.message || String(e) }, { status: 500, headers: CORS });
  }
});