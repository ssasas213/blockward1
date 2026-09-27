/**
 * getEvidenceAccess — permission-checked access to achievement evidence
 * files stored in PRIVATE storage (the evidence counterpart of getFileAccess,
 * which does the same for classwork submissions).
 *
 * Authorised viewers of REQUEST evidence: the student owner, the nominated
 * verifier, a same-school organisation admin, or the holder of a valid
 * unexpired external-verification token (Tier 3 / independent verifiers
 * have no BlockWard account). Authorised viewers of a DELIVERED record's
 * evidence: the owning student, the issuing teacher, or a same-school admin.
 *
 * Private evidence is NEVER exposed publicly: the registry's public
 * evidence field is only ever populated with legacy public URLs, and the
 * public verification endpoints drop non-http values.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { resolveEffectiveActor } from '../../shared/testMode.ts';

const bad = (msg: string, status = 400) => Response.json({ ok: false, error: msg }, { status });
const lower = (v: any) => String(v || '').toLowerCase();

export default async function (req: Request): Promise<Response> {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
    if (req.method !== 'POST') return bad('Method not allowed', 405);

    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({})) || {};
    const { request_id, record_id, file_uri, token } = body;
    if (!file_uri) return bad('file_uri is required');
    const svc = base44.asServiceRole;

    if (request_id) {
      const rows = await svc.entities.AchievementRequest.filter({ id: request_id });
      const request = rows?.[0];
      if (!request) return bad('Request not found', 404);

      if (token) {
        // Account-free external verifier — the one-time link IS the authorisation.
        const valid = request.external_token
          && token === request.external_token
          && (!request.external_token_expires_at || new Date(request.external_token_expires_at) > new Date());
        if (!valid) return bad('This verification link has expired', 403);
      } else {
        const actor = await resolveEffectiveActor(base44);
        if (!actor.authorized) return bad(actor.reason || 'Not authorised', actor.status || 401);
        const email = lower(actor.actor_email);
        const isOwner = lower(request.student_email) === email;
        const isVerifier = lower(request.nominated_verifier_email) === email;
        const isAdmin = actor.actor_role === 'admin' && !!request.school_id && request.school_id === actor.school_id;
        if (!isOwner && !isVerifier && !isAdmin) return bad('You do not have access to this evidence', 403);
      }
      // The requested file must actually belong to this request.
      const belongs = (request.evidence || []).some((e: any) => e && e.url === file_uri);
      if (!belongs) return bad('File not found on this request', 404);
    } else if (record_id) {
      const actor = await resolveEffectiveActor(base44);
      if (!actor.authorized) return bad(actor.reason || 'Not authorised', actor.status || 401);
      const rows = await svc.entities.StudentRecord.filter({ id: record_id });
      const record = rows?.[0];
      if (!record) return bad('Record not found', 404);
      const email = lower(actor.actor_email);
      const isOwner = lower(record.student_email) === email || lower(record.owner_student_email) === email;
      const isTeacher = lower(record.teacher_email) === email;
      const isAdmin = actor.actor_role === 'admin' && !!record.school_id && record.school_id === actor.school_id;
      if (!isOwner && !isTeacher && !isAdmin) return bad('You do not have access to this evidence', 403);
      if (record.file_url !== file_uri) return bad('File not found on this record', 404);
    } else {
      return bad('request_id or record_id is required');
    }

    const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri, expires_in: 300 });
    return Response.json({ ok: true, signed_url });
  } catch (error) {
    return Response.json({ ok: false, error: error?.message || 'Unexpected error' }, { status: 500 });
  }
}