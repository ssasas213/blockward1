/**
 * submitContactMessage — public contact form endpoint. Validates the message,
 * stores it in ContactMessage (service-role only) and forwards it to the
 * platform owner's Resend address so nothing is silently lost. Best-effort
 * email — the stored record is the source of truth.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { sendResendEmail } from '../../shared/resendEmail.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'content-type': 'application/json',
};

const TOPICS = ['organisations', 'student_support', 'verification_support', 'partnerships'];

function escapeHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const organisation = String(body.organisation || '').trim() || null;
    const topic = TOPICS.includes(body.topic) ? body.topic : 'organisations';
    const message = String(body.message || '').trim();

    if (!name) return Response.json({ ok: false, error: 'Please tell us your name.' }, { status: 400, headers: CORS });
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return Response.json({ ok: false, error: 'Please enter a valid email so we can reply.' }, { status: 400, headers: CORS });
    }
    if (message.length < 10) {
      return Response.json({ ok: false, error: 'Please add a little more detail to your message.' }, { status: 400, headers: CORS });
    }

    await base44.asServiceRole.entities.ContactMessage.create({
      name, email, organisation, topic, message, status: 'new',
    });

    const to = Deno.env.get('RESEND_FROM_EMAIL');
    if (to) {
      const html = `<p><strong>${escapeHtml(name)}</strong> &lt;${escapeHtml(email)}&gt;${organisation ? ' — ' + escapeHtml(organisation) : ''}</p>` +
        `<p>Topic: ${topic}</p><blockquote>${escapeHtml(message)}</blockquote>`;
      await sendResendEmail(to, `[BlockWard contact] ${topic} — ${name}`, html);
    }

    return Response.json({ ok: true }, { headers: CORS });
  } catch (error) {
    return Response.json({ ok: false, error: 'Something went wrong. Please try again.' }, { status: 500, headers: CORS });
  }
});