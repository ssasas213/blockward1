/**
 * parentCommsSend — the tracked, authorised path for staff parent/student
 * messages (Parent Communications). Replaces the old untracked client-side
 * SendEmail call: every send now flows through the shared dispatcher
 * (EmailDeliveryLog) and is authorisation-checked — the recipient must be
 * the parent/guardian email or the account email of a student at the
 * caller's OWN school, so a staff member can never mail an arbitrary
 * address through this path.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { resolveEffectiveActor } from '../../shared/testMode.ts';
import { sendTrackedEmail } from '../../shared/emailDelivery.ts';

const bad = (msg: string, status = 400) => Response.json({ ok: false, error: msg }, { status });

const escapeHtml = (s: string) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export default async function (req: Request): Promise<Response> {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
    if (req.method !== 'POST') return bad('Method not allowed', 405);

    const base44 = createClientFromRequest(req);
    const actor = await resolveEffectiveActor(base44);
    if (!actor.authorized) return bad(actor.reason || 'Not authorised', actor.status || 401);
    if (actor.actor_role !== 'teacher' && actor.actor_role !== 'admin') {
      return bad('Only staff may send these messages', 403);
    }
    if (!actor.school_id) return bad('You are not associated with a school', 403);

    const body = await req.json().catch(() => ({})) || {};
    const to = String(body.to || '').trim().toLowerCase();
    const subject = String(body.subject || '').trim();
    const message = String(body.message || '').trim();
    if (!to || !subject || !message) return bad('Recipient, subject and message are required');

    const svc = base44.asServiceRole;
    // Recipient must be on the caller's school roster — a student at the
    // caller's own school, or that student's recorded parent/guardian email.
    const byStudent = await svc.entities.UserProfile.filter({ school_id: actor.school_id, user_email: to });
    const byParent = await svc.entities.UserProfile.filter({ school_id: actor.school_id, parent_email: to });
    const student = (byStudent && byStudent[0]) || (byParent && byParent[0]) || null;
    if (!student) return bad('This recipient is not on your school roster', 403);

    const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(message)}</div>`;
    const result = await sendTrackedEmail(svc, {
      to,
      subject,
      html,
      event_type: 'parent_comms',
      related_type: 'none',
      related_id: student.id,
      school_id: actor.school_id,
    });

    // A short-window duplicate (double click) is a success, not an error.
    if (result.duplicate) return Response.json({ ok: true, duplicate: true });
    if (!result.delivered) return bad(result.error || 'The email could not be sent just now', 502);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ ok: false, error: error?.message || 'Unexpected error' }, { status: 500 });
  }
}