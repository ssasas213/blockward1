import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveEffectiveActor } from '../../shared/testMode.ts';
import { authorizeClassForActor, buildClassRoster } from '../../shared/seating.ts';

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
    const { class_id } = body;
    if (!class_id) return new Response(JSON.stringify({ error: 'class_id is required' }), { status: 400, headers: cors });

    const svc = base44.asServiceRole;
    const cls = await authorizeClassForActor(svc, actor, class_id);
    const [plans, roster] = await Promise.all([
      svc.entities.SeatingPlan.filter({ class_id, school_id: actor.school_id }, 'is_default', 100),
      buildClassRoster(svc, actor.school_id, class_id),
    ]);
    // Ensure exactly one default; pick the first if none flagged.
    let defaultPlan = plans.find(p => p.is_default) || plans[0] || null;
    const safePlans = plans.map(p => ({ id: p.id, name: p.name, is_default: p.is_default, updated_at: p.updated_at }));
    return new Response(JSON.stringify({
      class: { id: cls.id, name: cls.name, room: cls.room || '' },
      roster,
      plans: safePlans,
      active_plan: defaultPlan,
      active_layout: defaultPlan?.layout_json || null,
      can_edit: actor.actor_role === 'admin' || actor.actor_role === 'teacher',
    }), { status: 200, headers: cors });
  } catch (e) {
    return new Response(JSON.stringify({ error: e?.message || 'Failed to load seating plan' }), { status: e?.status || 500, headers: cors });
  }
});