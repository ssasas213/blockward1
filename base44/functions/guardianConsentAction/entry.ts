import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { sendResendEmail } from '../../shared/resendEmail.ts';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function appUrl() {
  return Deno.env.get('APP_URL') || 'https://blockward.base44.app';
}

function guardianEmailHtml(firstName, link) {
  return `<div style="font-family:Inter,system-ui,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
    <p style="font-size:20px;font-weight:700;margin:0 0 16px;">Confirm ${firstName}'s BlockWard account</p>
    <p style="margin:0 0 12px;">${firstName} used this email address to sign up for <strong>BlockWard</strong> — a platform where students collect verified school achievements that are permanently recorded.</p>
    <p style="margin:0 0 24px;">Because they are under 13, the account stays inactive until a parent or guardian consents. If you are ${firstName}'s parent or guardian, please confirm:</p>
    <p style="margin:0 0 24px;">
      <a href="${link}" style="background:#7c3aed;color:#ffffff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600;display:inline-block;">I consent to ${firstName} using BlockWard</a>
    </p>
    <p style="color:#64748b;font-size:13px;margin:0 0 8px;">If you did not expect this email, you can ignore it — nothing is activated without your confirmation.</p>
    <p style="color:#64748b;font-size:13px;margin:0;">Your consent is recorded with the date and time you confirm.</p>
  </div>`;
}

// guardianConsentAction — the under-13 consent flow.
//   { action: 'status', token }  → public lookup for the consent page (no auth)
//   { action: 'redeem', token }   → record consent with a timestamp and activate
//   { action: 'resend' }          → authed student awaiting consent: re-send the
//                                   link, optionally to a corrected guardian email
//                                   (updates the same parent_email field the
//                                   student dashboard manages)
export default async function(req: Request): Promise<Response> {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'redeem';

    // ── Public: look up / redeem a consent token ──
    if (action === 'status' || action === 'redeem') {
      const token = (body.token || '').trim();
      if (!token) return Response.json({ error: 'Missing consent token' }, { status: 400 });

      const rows = await svc.entities.UserProfile.filter({ guardian_consent_token: token });
      const p = rows[0];
      if (!p) return Response.json({ found: false, status: 'unknown' }, { status: 404 });

      const alreadyGranted = p.guardian_consent?.status === 'granted' || p.status !== 'awaiting_guardian_consent';

      if (action === 'status') {
        return Response.json({
          ok: true,
          found: true,
          status: alreadyGranted ? 'granted' : 'pending',
          student_first_name: p.first_name || null,
        });
      }

      if (alreadyGranted) {
        return Response.json({ ok: true, already_granted: true, student_first_name: p.first_name || null });
      }

      const now = new Date().toISOString();
      const newStatus = p.user_type === 'teacher' ? 'pending_approval' : 'active';
      await svc.entities.UserProfile.update(p.id, {
        status: newStatus,
        guardian_consent: {
          ...(p.guardian_consent || {}),
          status: 'granted',
          granted_at: now,
          granted_via: 'consent_link',
        },
        guardian_consent_token: null,
      });

      // The compliance record: who consented, for whom, and exactly when.
      await svc.entities.AuditLog.create({
        record_id: p.id,
        school_id: p.school_id || 'unassigned',
        actor_email: p.guardian_consent?.guardian_email || p.parent_email || 'guardian',
        actor_name: 'Parent/Guardian',
        actor_role: 'guardian',
        action: 'guardian_consent_granted',
        old_status: 'awaiting_guardian_consent',
        new_status: newStatus,
        notes: `Guardian consent recorded for ${p.user_email} at ${now} via consent link`,
        timestamp: now,
      });

      return Response.json({ ok: true, student_first_name: p.first_name || null, consented_at: now });
    }

    // ── Authed: resend (optionally to a corrected guardian email) ──
    if (action === 'resend') {
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

      const rows = await svc.entities.UserProfile.filter({ user_email: user.email });
      const p = rows[0];
      if (!p) return Response.json({ error: 'Profile not found' }, { status: 404 });
      if (p.status !== 'awaiting_guardian_consent' || p.guardian_consent?.status !== 'pending') {
        return Response.json({ error: 'This account is not waiting for guardian consent' }, { status: 400 });
      }

      const guardian = ((body.guardian_email || p.guardian_consent?.guardian_email || p.parent_email || '')).trim().toLowerCase();
      if (!EMAIL_RE.test(guardian)) {
        return Response.json({ error: 'Enter a valid parent or guardian email' }, { status: 400 });
      }

      const token = crypto.randomUUID().replace(/-/g, '');
      const now = new Date().toISOString();
      await svc.entities.UserProfile.update(p.id, {
        parent_email: guardian,
        guardian_consent: {
          ...(p.guardian_consent || {}),
          guardian_email: guardian,
          token,
          requested_at: now,
        },
        guardian_consent_token: token,
      });

      const link = `${appUrl()}/guardian-consent/${token}`;
      const mail = await sendResendEmail(guardian, `Confirm ${p.first_name}'s BlockWard account`, guardianEmailHtml(p.first_name, link));
      if (!mail.delivered) {
        return Response.json({ error: 'Could not send the consent email. ' + (mail.error || 'Please try again.') }, { status: 502 });
      }
      return Response.json({ ok: true, guardian_email: guardian });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed' }, { status: 500 });
  }
}