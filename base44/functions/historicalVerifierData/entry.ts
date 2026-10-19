// ============================================================================
// historicalVerifierData — public, token-authorised read for the APPROVED
// verifier's confirmation page. No account needed: the single-use expiring
// token IS the authorisation. The token is resolved ONLY through its
// server-only hashed capability record — never through the student-readable
// request record (P0/A02). Returns only what the verifier needs to review —
// the claim plus evidence via short-lived signed URLs. Never exposes the
// student's email, LinkedIn URL or any other private identity data.
// ============================================================================
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { findVerifierCapabilityByToken } from '../../shared/historicalVerification.ts';

const bad = (msg: string, status = 400) => Response.json({ ok: false, error: msg }, { status });

export default async function (req: Request): Promise<Response> {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
    if (req.method !== 'POST') return bad('Method not allowed', 405);
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({})) || {};
    const token = String(body.token || '').trim();
    // Deliberately public lookup: the long random token is the check, matched
    // exactly through its hash (never as a regex). A blank token is rejected
    // before the query.
    if (!token || token.length < 20) return bad('This verification link is not valid', 404);
    const svc = base44.asServiceRole;

    const cap = await findVerifierCapabilityByToken(svc, token);
    if (!cap) return bad('This verification link is not valid', 404);
    const rows = await svc.entities.HistoricalAchievementRequest.filter({ request_ref: cap.request_ref });
    const r = rows?.[0];
    if (!r) return bad('This verification link is not valid', 404);

    if (cap.token_used_at || !['verifier_authorized'].includes(r.status)) {
      return Response.json({ ok: false, error: 'This verification link has already been used or is no longer active', reason: 'used' }, { status: 410 });
    }
    if (cap.token_expires_at && new Date(cap.token_expires_at) <= new Date()) {
      return Response.json({ ok: false, error: 'This verification link has expired', reason: 'expired' }, { status: 410 });
    }

    const evidence = [];
    for (const e of (r.evidence || [])) {
      if (e.kind === 'link' || /^https:\/\//i.test(e.url || '')) {
        evidence.push({ name: e.name, kind: 'link', url: e.url });
      } else {
        try {
          const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: e.url, expires_in: 600 });
          evidence.push({ name: e.name, kind: 'file', signed_url });
        } catch { /* skip unreadable evidence — never leak an error */ }
      }
    }

    return Response.json({
      ok: true,
      request: {
        request_ref: r.request_ref,
        demo: !!r.demo,
        achievement: {
          title: r.title, category: r.category, description: r.description,
          original_date: r.original_date, issuing_org: r.issuing_org, country: r.country,
          certificate_ref: r.certificate_ref,
        },
        student_first_name: String(r.student_name || 'The student').split(' ')[0],
        verifier: { name: r.verifier_name, role: r.verifier_role, org: r.verifier_org },
        expected_name: r.verifier_name,
        authority_review_note: r.authority_review?.checks || null,
        evidence,
        expires_at: cap.token_expires_at,
      },
    });
  } catch (error) {
    return Response.json({ ok: false, error: error?.message || 'Unexpected error' }, { status: 500 });
  }
}