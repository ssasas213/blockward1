// ============================================================================
// historicalAdminData — Blockward SUPER ADMIN review queue. Separate from
// ordinary organisation-administrator permissions: requireInternalAdmin is the
// sole server-side authority (internal-admin allowlist + test super user).
// Demo records are only ever returned to the test super user, in test mode.
// Verifier tokens never leave the server except as demo simulation links.
// ============================================================================
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { requireInternalAdmin } from '../../shared/internalAdmin.ts';
import { isTestModeEnabled, getTestSuperUserEmail } from '../../shared/testMode.ts';
import { OPEN_STATUSES, lower, appUrl, findVerifierCapabilityByRef } from '../../shared/historicalVerification.ts';

const bad = (msg: string, status = 400) => Response.json({ ok: false, error: msg }, { status });
const stripToken = (r: any) => {
  const { verifier_token, ...rest } = r;
  return rest;
};

export default async function (req: Request): Promise<Response> {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
    if (req.method !== 'POST') return bad('Method not allowed', 405);
    const base44 = createClientFromRequest(req);
    const { me, error } = await requireInternalAdmin(base44);
    if (error) return error;
    const body = await req.json().catch(() => ({})) || {};
    const svc = base44.asServiceRole;

    // ── Single-request detail (review page) ──
    if (body.action === 'detail') {
      if (!body.request_id || !/^[a-f0-9]{24}$/i.test(String(body.request_id))) return bad('Request not found', 404);
      const rows = await svc.entities.HistoricalAchievementRequest.filter({ id: body.request_id });
      const r = rows?.[0];
      if (!r) return bad('Request not found', 404);
      if (r.demo && !(isTestModeEnabled() && lower(me.email) === lower(getTestSuperUserEmail()))) {
        return bad('Demo records are only available in test mode', 403);
      }

      const evidence = await Promise.allSettled((r.evidence || []).map(async (e: any) => {
        if (e.kind === 'link' || /^https:\/\//i.test(e.url || '')) return { ...e, kind: 'link' };
        try {
          const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: e.url, expires_in: 600 });
          return { ...e, signed_url, kind: 'file' };
        } catch { return { ...e, signed_url: null, kind: 'file' }; }
      }));

      const all = await svc.entities.HistoricalAchievementRequest.filter({}).catch(() => []);
      const sameStudent = all.filter((x: any) => lower(x.student_email) === lower(r.student_email) && x.id !== r.id);
      const sameVerifier = all.filter((x: any) => lower(x.verifier_email) === lower(r.verifier_email) && x.id !== r.id);
      const sameOrg = all.filter((x: any) => lower(x.issuing_org) === lower(r.issuing_org) && x.id !== r.id);
      let verifiedCredentials = 0;
      try {
        const creds = await svc.entities.Credential.filter({ holder_email: lower(r.student_email) });
        verifiedCredentials = (creds || []).length;
      } catch { /* best-effort */ }

      return Response.json({
        ok: true,
        request: stripToken(r),
        evidence: evidence.filter((x: any) => x.status === 'fulfilled').map((x: any) => x.value),
        context: {
          student_other_requests: sameStudent.length,
          student_open_requests: sameStudent.filter((x: any) => OPEN_STATUSES.includes(x.status)).length,
          student_verified_credentials: verifiedCredentials,
          verifier_other_requests: sameVerifier.map((x: any) => ({
            request_ref: x.request_ref, title: x.title, status: x.status, created_date: x.created_date,
          })).slice(0, 10),
          org_other_requests: sameOrg.length,
          potential_flags: [
            ...(sameVerifier.length > 0 ? ['This verifier email appears on other historical requests'] : []),
            ...(lower(r.verifier_relationship || '').includes('parent') || lower(r.verifier_relationship || '').includes('family') ? ['Verifier relationship mentions family'] : []),
            ...(lower(r.verifier_org) === lower(r.issuing_org) ? [] : ['Verifier organisation differs from the issuing organisation']),
          ],
        },
      });
    }

    // ── Queue ──
    const all = await svc.entities.HistoricalAchievementRequest.filter({}, '-created_date', 200);
    const real = (all || []).filter((x: any) => !x.demo).map(stripToken);
    const testSuper = isTestModeEnabled() && lower(me?.email) === lower(getTestSuperUserEmail());
    // Demo records NEVER leave the server outside test mode, and only to the
    // test super user — enforced here, not in the UI.
    const demoRequests: any[] = [];
    if (testSuper) {
      for (const x of (all || []).filter((y: any) => y.demo)) {
        const cleanRec: any = { ...x };
        if (x.status === 'verifier_authorized') {
          // Demo simulation link — rebuilt from the raw token kept only on the
          // server-only capability record (demo records only).
          const cap = await findVerifierCapabilityByRef(svc, x.request_ref);
          if (cap?.raw_token) cleanRec.demo_verifier_url = `${appUrl()}/historical-verify/${cap.raw_token}`;
        }
        demoRequests.push(cleanRec);
      }
    }
    const stats = {
      pending: real.filter((x: any) => ['pending_review', 'info_requested'].includes(x.status)).length,
      with_verifier: real.filter((x: any) => ['verifier_authorized', 'decision_processing', 'verifier_confirmed'].includes(x.status)).length,
      issued: real.filter((x: any) => x.status === 'issued').length,
      declined: real.filter((x: any) => ['verifier_rejected', 'verifier_declined', 'rejected'].includes(x.status)).length,
    };
    return Response.json({ ok: true, admin: { email: me.email }, requests: real, demo_requests: demoRequests, stats, test_mode: testSuper });
  } catch (error) {
    return Response.json({ ok: false, error: error?.message || 'Unexpected error' }, { status: 500 });
  }
}