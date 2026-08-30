import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveEffectiveActor } from '../../shared/testMode.ts';
import { authorizeClassForActor, writeAudit } from '../../shared/seating.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'content-type': 'application/json',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: cors });
  try {
    const base44 = createClientFromRequest(req);
    const actor = await resolveEffectiveActor(base44);
    if (!actor.authorized) return new Response(JSON.stringify({ error: actor.reason || 'Unauthorized' }), { status: actor.status || 401, headers: cors });

    const body = await req.json();
    const { class_id, plan_id } = body;
    if (!class_id || !plan_id) return new Response(JSON.stringify({ error: 'class_id and plan_id are required' }), { status: 400, headers: cors });

    const svc = base44.asServiceRole;
    await authorizeClassForActor(svc, actor, class_id); // raises if not allowed
    const existing = await svc.entities.SeatingPlan.filter({ id: plan_id, school_id: actor.school_id });
    if (!existing[0]) return new Response(JSON.stringify({ error: 'Plan not found' }), { status: 404, headers: cors });
    await svc.entities.SeatingPlan.delete(plan_id);
    await writeAudit(svc, actor, { class_id, action: 'seating_plan_deleted' });
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: cors });
  } catch (e) {
    return new Response(JSON.stringify({ error: e?.message || 'Failed to delete seating plan' }), { status: e?.status || 500, headers: cors });
  }
});