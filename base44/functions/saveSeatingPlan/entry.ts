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
    const { class_id, plan_id, name, layout_json, is_default } = body;
    if (!class_id) return new Response(JSON.stringify({ error: 'class_id is required' }), { status: 400, headers: cors });
    if (!name) return new Response(JSON.stringify({ error: 'name is required' }), { status: 400, headers: cors });
    if (!layout_json || typeof layout_json !== 'object') return new Response(JSON.stringify({ error: 'layout_json is required' }), { status: 400, headers: cors });

    const svc = base44.asServiceRole;
    const cls = await authorizeClassForActor(svc, actor, class_id);
    const now = new Date().toISOString();
    const payload = {
      school_id: actor.school_id,
      class_id,
      class_name: cls.name,
      teacher_email: actor.actor_email,
      name,
      layout_json,
      is_default: !!is_default,
      updated_at: now,
    };

    let plan;
    if (plan_id) {
      const existing = await svc.entities.SeatingPlan.filter({ id: plan_id, school_id: actor.school_id });
      if (!existing[0]) return new Response(JSON.stringify({ error: 'Plan not found' }), { status: 404, headers: cors });
      await svc.entities.SeatingPlan.update(plan_id, payload);
      plan = { id: plan_id, ...payload };
      await writeAudit(svc, actor, { class_id, action: 'seating_plan_updated' });
    } else {
      payload.created_at = now;
      plan = await svc.entities.SeatingPlan.create(payload);
      await writeAudit(svc, actor, { class_id, action: 'seating_plan_created' });
    }

    // Enforce single default: if this plan is default, unset others.
    if (payload.is_default) {
      const all = await svc.entities.SeatingPlan.filter({ class_id, school_id: actor.school_id });
      await Promise.all(all.filter(p => p.id !== plan.id && p.is_default).map(p => svc.entities.SeatingPlan.update(p.id, { is_default: false })));
    }
    return new Response(JSON.stringify({ ok: true, plan: { id: plan.id, name, is_default: payload.is_default } }), { status: 200, headers: cors });
  } catch (e) {
    return new Response(JSON.stringify({ error: e?.message || 'Failed to save seating plan' }), { status: e?.status || 500, headers: cors });
  }
});