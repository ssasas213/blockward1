/**
 * platformStats — public, unauthenticated platform counters for the marketing
 * footer: active organisations, credentials issued, and verifications
 * performed. The `show` flag is false until every number is large enough to
 * be persuasive — the footer hides the whole block otherwise.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'content-type': 'application/json',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    let events = [];
    try {
      events = await svc.entities.VerificationEvent.filter({}, '-created_date', 5000);
    } catch (e) { /* entity may not exist yet */ }

    const [schools, registry] = await Promise.all([
      svc.entities.School.filter({ status: 'active' }),
      svc.entities.BlockWardVerificationRegistry.filter({}, '-created_date', 5000),
    ]);

    const orgs = schools.length;
    const credentials = registry.filter((r: any) => (r.approval_status || 'approved') === 'approved').length;
    const verifications = events.length;

    return Response.json({
      ok: true,
      orgs,
      credentials,
      verifications,
      show: orgs >= 5 && credentials >= 25 && verifications >= 50,
    }, { headers: CORS });
  } catch (error) {
    return Response.json({ ok: false }, { status: 500, headers: CORS });
  }
});