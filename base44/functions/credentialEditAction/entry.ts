// credentialEditAction — the single endpoint for editing achievements and
// credentials without weakening verification integrity. The field split
// (attested vs presentation), state rules and correction flow all live in
// base44/shared/credentialEdits.ts; this is the auth + dispatch shell.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { resolveEffectiveActor } from '../../shared/testMode.ts';
import { runCredentialEditAction } from '../../shared/credentialEdits.ts';

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
    const base44 = createClientFromRequest(req);
    const actor = await resolveEffectiveActor(base44);
    if (!actor.authorized) {
      return Response.json({ ok: false, error: actor.reason || 'Unauthorized' }, { status: actor.status || 401, headers: CORS });
    }
    const r = await runCredentialEditAction(base44.asServiceRole, actor, body);
    return Response.json(r.payload, { status: r.status, headers: CORS });
  } catch (e) {
    return Response.json({ ok: false, error: e?.message || String(e) }, { status: 500, headers: CORS });
  }
});