/**
 * sendMessage — Create a direct message using the EFFECTIVE actor as sender.
 *
 * Uses resolveEffectiveActor so Test Mode sends as the active persona
 * (e.g. test.teacher@blockward.test), never the controller. Enforces
 * same-school + no-self + non-empty body. Creates a persona-aware
 * notification for the recipient.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { resolveEffectiveActor } from '../../shared/testMode.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'content-type': 'application/json'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  const base44 = createClientFromRequest(req);

  try {
    const actor = await resolveEffectiveActor(base44);
    if (!actor.authorized) return Response.json({ ok: false, error: actor.reason || 'Unauthorized' }, { status: actor.status || 401, headers: CORS });

    let body; try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'Invalid request' }, { status: 400, headers: CORS }); }
    const { recipient_profile_id, subject, content } = body || {};
    const subjectTrim = (subject || '').trim();
    const contentTrim = (content || '').trim();

    if (!contentTrim) return Response.json({ ok: false, error: 'Please enter a message.' }, { status: 400, headers: CORS });
    if (!recipient_profile_id) return Response.json({ ok: false, error: 'Recipient could not be found.' }, { status: 400, headers: CORS });

    // Resolve recipient profile
    const recRows = await base44.asServiceRole.entities.UserProfile.filter({ id: recipient_profile_id });
    const recipient = recRows[0];
    if (!recipient) return Response.json({ ok: false, error: 'Recipient could not be found.' }, { status: 404, headers: CORS });
    if (recipient.status === 'inactive' || recipient.status === 'suspended') {
      return Response.json({ ok: false, error: 'This user is no longer active.' }, { status: 403, headers: CORS });
    }

    // Same-school enforcement (server-side)
    if (!actor.school_id || !recipient.school_id || actor.school_id !== recipient.school_id) {
      return Response.json({ ok: false, error: 'You and this user are not in the same school.' }, { status: 403, headers: CORS });
    }
    // No self-messaging (compare effective persona IDs, not the controller email)
    if (recipient.id === actor.actor_id) {
      return Response.json({ ok: false, error: 'You cannot message yourself.' }, { status: 400, headers: CORS });
    }

    const senderName = `${actor.first_name} ${actor.last_name}`.trim();
    const recipientName = `${recipient.first_name} ${recipient.last_name}`.trim();
    const conversationId = `${actor.school_id}:${[actor.actor_id, recipient.id].sort().join('|')}`;
    const now = new Date().toISOString();

    const message = await base44.asServiceRole.entities.Message.create({
      school_id: actor.school_id,
      type: 'direct',
      conversation_id: conversationId,
      sender_profile_id: actor.actor_id,
      sender_email: actor.actor_email,
      sender_name: senderName,
      sender_type: actor.actor_role,
      sender_role: actor.actor_role,
      recipient_profile_id: recipient.id,
      recipient_email: recipient.user_email,
      recipient_name: recipientName,
      recipient_role: recipient.user_type,
      subject: subjectTrim || '(No subject)',
      content: contentTrim,
      status: 'sent',
      read: false,
    });

    // Persona-aware notification: addressed to the recipient's persona email.
    try {
      await base44.asServiceRole.entities.Notification.create({
        user_email: recipient.user_email,
        school_id: actor.school_id,
        title: `New message from ${senderName}`,
        body: subjectTrim || contentTrim.slice(0, 100),
        type: 'message',
        priority: 'normal',
        related_id: message.id,
        read: false,
      });
    } catch (e) {
      console.error('[sendMessage] notification failed:', e?.message || e);
    }

    return Response.json({ ok: true, message, conversation_id: conversationId }, { headers: CORS });
  } catch (error) {
    console.error('[sendMessage] fatal:', error?.message || error);
    return Response.json({ ok: false, error: 'Your message could not be saved. Please try again.' }, { status: 500, headers: CORS });
  }
});