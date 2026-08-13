import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { waitUntil } from 'base44:runtime';

function makeToken() {
  // Two UUIDs concatenated (hyphens stripped) = ~64 random hex chars
  const a = crypto.randomUUID().replace(/-/g, '');
  const b = crypto.randomUUID().replace(/-/g, '');
  return a + b;
}

function normalizeEmail(e) {
  return (e || '').trim().toLowerCase();
}

function parseEmails(input) {
  return String(input || '')
    .split(/[\s,;]+/)
    .map(e => e.trim())
    .filter(e => e.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
    .map(normalizeEmail);
}

export default async function(req: Request): Promise<Response> {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Admin-only
    const profiles = await base44.asServiceRole.entities.UserProfile.filter({ user_email: user.email });
    const profile = profiles[0];
    if (!profile || profile.user_type !== 'admin') {
      return Response.json({ error: 'Only administrators can send invitations' }, { status: 403 });
    }

    const body = await req.json();
    const role = body.role; // 'teacher' | 'student' | 'admin'
    const rawEmails = body.emails;
    const schoolId = body.school_id || profile.active_school_id || profile.school_id;

    if (!['teacher', 'student', 'admin'].includes(role)) {
      return Response.json({ error: 'Invalid role' }, { status: 400 });
    }
    const emails = parseEmails(rawEmails);
    if (emails.length === 0) {
      return Response.json({ error: 'Please enter at least one valid email address' }, { status: 400 });
    }
    if (!schoolId) {
      return Response.json({ error: 'No school linked to your account' }, { status: 400 });
    }

    const schools = await base44.asServiceRole.entities.School.filter({ id: schoolId });
    const school = schools[0];
    if (!school) return Response.json({ error: 'School not found' }, { status: 404 });

    const appUrl = (typeof globalThis !== 'undefined' && (globalThis as any).process?.env?.APP_URL)
      || `https://${(req.headers.get('host') || 'blockward.me')}`;
    const inviterName = profile.first_name
      ? `${profile.first_name} ${profile.last_name || ''}`.trim()
      : user.email;

    const created = [];
    const skipped = [];
    for (const email of emails) {
      // Don't duplicate a pending invitation to the same email+school+role
      const existing = await base44.asServiceRole.entities.SchoolInvitation.filter({
        school_id: schoolId, invited_email: email, role, status: 'pending'
      });
      if (existing.length > 0) {
        skipped.push({ email, reason: 'already invited (pending)' });
        continue;
      }

      const token = makeToken();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const inviteUrl = `${appUrl.replace(/\/$/, '')}/invite/${token}`;

      const invitation = await base44.asServiceRole.entities.SchoolInvitation.create({
        school_id: schoolId,
        school_name: school.name,
        invited_email: email,
        role,
        invited_by: user.email,
        invited_by_name: inviterName,
        status: 'pending',
        token,
        invited_at: now.toISOString(),
        expires_at: expiresAt,
      });

      // Send the email in the background (registered users always; non-registered requires plan)
      const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
      const bodyHtml = `
        <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;">
          <div style="text-align:center;margin-bottom:28px;">
            <div style="display:inline-block;width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#8B5CF6,#EC4899);margin-bottom:14px;"></div>
            <h2 style="color:#0B0A10;margin:0;font-size:20px;">You're invited to BlockWard</h2>
          </div>
          <p style="color:#333;font-size:15px;line-height:1.6;">
            <strong>${inviterName}</strong> has invited you to join <strong>${school.name}</strong> as a ${roleLabel} on BlockWard — the blockchain-secured achievement platform.
          </p>
          <div style="text-align:center;margin:32px 0;">
            <a href="${inviteUrl}" style="display:inline-block;background:linear-gradient(135deg,#8B5CF6,#EC4899);color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:13px 32px;border-radius:10px;">Join School</a>
          </div>
          <p style="color:#888;font-size:13px;line-height:1.5;">
            This invitation is linked to <strong>${email}</strong>. You must sign in with this Google account to accept it.<br/>
            The link expires in 7 days. If you didn't expect this invitation, you can ignore this email.
          </p>
          <hr style="border:none;border-top:1px solid #eee;margin:28px 0;"/>
          <p style="color:#aaa;font-size:12px;text-align:center;">© 2026 BlockWard · Blockchain-Secured Achievements</p>
        </div>`;

      waitUntil(
        base44.asServiceRole.integrations.Core.SendEmail({
          to: email,
          subject: `You've been invited to join ${school.name} on BlockWard`,
          body: bodyHtml,
        }).catch((e) => console.log('invite email send failed', email, e?.message))
      );

      created.push({ id: invitation.id, email, invite_url: inviteUrl });
    }

    return Response.json({
      success: true,
      sent_count: created.length,
      skipped_count: skipped.length,
      created,
      skipped,
    });
  } catch (error) {
    console.error('createInvitations error:', error);
    return Response.json({ error: error.message || 'Failed to send invitations' }, { status: 500 });
  }
}