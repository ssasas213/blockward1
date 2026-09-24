/**
 * getFileAccess — permission-checked access to private submission files.
 *
 * Submission attachments are uploaded to PRIVATE storage (UploadPrivateFile),
 * so a copied file URI is worthless on its own: it is not a URL. This
 * function verifies the caller is the submission's owner, one of the class
 * teachers, or a school admin, that the requested file actually belongs to
 * that submission, and only then returns a short-lived signed URL.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { resolveEffectiveActor } from '../../shared/testMode.ts';

const bad = (msg: string, status = 400) => Response.json({ ok: false, error: msg }, { status });

export default async function (req: Request): Promise<Response> {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
    if (req.method !== 'POST') return bad('Method not allowed', 405);

    const base44 = createClientFromRequest(req);
    const actor = await resolveEffectiveActor(base44);
    if (!actor.authorized) return bad(actor.reason || 'Not authorised', actor.status || 401);

    const body = await req.json().catch(() => ({})) || {};
    const { submission_id, file_uri } = body;
    if (!submission_id || !file_uri) return bad('submission_id and file_uri are required');

    const svc = base44.asServiceRole;
    const rows = await svc.entities.Submission.filter({ id: submission_id }).catch(() => []);
    const submission = rows?.[0];
    if (!submission) return bad('Submission not found', 404);

    const email = String(actor.actor_email || '').toLowerCase();
    const isStudent = String(submission.student_email || '').toLowerCase() === email;
    const isTeacher = (submission.teacher_emails || [])
      .map((e: string) => String(e).toLowerCase())
      .includes(email);
    const isAdmin = actor.actor_role === 'admin' && !!submission.school_id && submission.school_id === actor.school_id;
    if (!isStudent && !isTeacher && !isAdmin) {
      return bad('You do not have access to this work', 403);
    }

    // The requested file must actually belong to this submission.
    const belongs = (submission.attachments || []).some((a: any) => a && a.url === file_uri);
    if (!belongs) return bad('File not found on this submission', 404);

    const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri, expires_in: 300 });
    return Response.json({ ok: true, signed_url });
  } catch (error) {
    return Response.json({ ok: false, error: error?.message || 'Unexpected error' }, { status: 500 });
  }
}