// achievementRequestAction — the full lifecycle of a student achievement
// request: save draft, submit (with anti-abuse caps), resubmit, verifier
// sign-off, admin second approval, Tier 3 external verification via a
// one-time expiring link, request changes, reject (with rejection-rate
// flagging), bulk Tier 1 sign-off, withdraw/republish, and minting to the
// canonical credential pipeline on final approval.
//
// Thin dispatch layer: the actual flow logic lives in
// base44/shared/achievementRequestFlow.ts — the same implementation the demo
// seeder drives, so seeded credentials are produced through the real pipeline.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { resolveEffectiveActor } from '../../shared/testMode.ts';
import {
  ipCountry, requestIp,
  submitRequest, withdrawRequest, retryMint, runReviewerAction, runExternalAction,
} from '../../shared/achievementRequestFlow.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'content-type': 'application/json',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    // ── Public, token-authenticated external verifier actions ──
    if (['external_get', 'external_confirm', 'external_decline', 'external_report_false'].includes(action)) {
      const r = await runExternalAction(svc, body, { ip: requestIp(req), country: ipCountry(req) });
      return Response.json(r.payload, { status: r.status, headers: CORS });
    }

    const actor = await resolveEffectiveActor(base44);
    if (!actor.authorized) {
      return Response.json({ ok: false, error: actor.reason || 'Unauthorized' }, { status: actor.status || 401, headers: CORS });
    }

    const ctx = { ip: requestIp(req), country: ipCountry(req) };
    let r;
    if (['save_draft', 'submit', 'resubmit'].includes(action)) {
      r = await submitRequest(svc, actor, body, ctx);
    } else if (action === 'withdraw') {
      r = await withdrawRequest(svc, actor, body);
    } else if (action === 'retry_mint') {
      r = await retryMint(svc, actor, body);
    } else {
      r = await runReviewerAction(svc, actor, body, ctx);
    }
    return Response.json(r.payload, { status: r.status, headers: CORS });
  } catch (e) {
    return Response.json({ ok: false, error: e?.message || String(e) }, { status: 500, headers: CORS });
  }
});