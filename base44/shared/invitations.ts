// Shared helpers + flow for the invitation code path, used by both
// createInvitations and sendSchoolInvitations so the token/email/dedupe
// logic lives in one place.

export function makeToken(): string {
  const a = crypto.randomUUID().replace(/-/g, '');
  const b = crypto.randomUUID().replace(/-/g, '');
  return a + b;
}

export function normalizeEmail(e: string): string {
  return (e || '').trim().toLowerCase();
}

export function parseEmails(input: string): string[] {
  return String(input || '')
    .split(/[\s,;]+/)
    .map(e => e.trim())
    .filter(e => e.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
    .map(normalizeEmail);
}

export function resolveAppUrl(req: Request): string {
  const env = (typeof globalThis !== 'undefined' && (globalThis as any).process?.env?.APP_URL);
  if (env) return env.replace(/\/$/, '');
  return `https://${req.headers.get('host') || 'blockward.base44.app'}`;
}

// Renders the BlockWard invite email. Returns { subject, body }.
export function renderInviteEmail(schoolName: string, inviterName: string, email: string, inviteUrl: string, roleLabel: string) {
  const bodyHtml = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;">
      <div style="text-align:center;margin-bottom:28px;">
        <div style="display:inline-block;width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#8B5CF6,#EC4899);margin-bottom:14px;"></div>
        <h2 style="color:#0B0A10;margin:0;font-size:20px;">You're invited to BlockWard</h2>
      </div>
      <p style="color:#333;font-size:15px;line-height:1.6;">
        <strong>${inviterName}</strong> has invited you to join <strong>${schoolName}</strong> as a ${roleLabel} on BlockWard — the blockchain-secured achievement platform.
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
  return { subject: `You've been invited to join ${schoolName} on BlockWard`, body: bodyHtml };
}

// Sends the invite via Resend (delivers to non-registered recipients reliably).
// Reads RESEND_API_KEY + RESEND_FROM_EMAIL from the backend runtime env.
export async function sendInviteEmail(svc, to: string, subject: string, body: string): Promise<{ delivered: boolean; error?: string }> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM_EMAIL");
  console.log("[invite-email] RESEND path active", {
    apiKeyPresent: !!apiKey, apiKeyLen: apiKey ? apiKey.length : 0,
    from: from || null, to,
  });
  if (!apiKey || !from) {
    console.log("[invite-email] MISSING_SECRET — Resend not configured");
    return { delivered: false, error: "Resend not configured (RESEND_API_KEY / RESEND_FROM_EMAIL missing)" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html: body }),
    });
    const data = await res.json().catch(() => null);
    console.log("[invite-email] Resend response", {
      status: res.status, ok: res.ok, from, to,
      resendId: data?.id || null, resendError: data?.message || null,
    });
    if (res.ok) return { delivered: true };
    return { delivered: false, error: data?.message || res.statusText || `Resend error ${res.status}` };
  } catch (e) {
    console.log("[invite-email] Resend fetch threw", { error: e?.message });
    return { delivered: false, error: e?.message || String(e) };
  }
}

// Core invitation flow shared by both function entries.
//
// Outcomes (distinct):
//   sent    — invitation created/refreshed AND email delivered (email_status 'sent')
//   failed  — invitation created/refreshed but email delivery failed (email_status 'failed')
//   skipped — a pending invitation already exists and resend is false (dedupe)
//
// resend=true bypasses dedupe: refreshes the existing pending invite's token + expiry
// and re-sends, or creates a fresh one if none exists.
export async function runInvitationFlow(svc, opts: {
  user: any; schoolId: string; schoolName: string; inviterName: string;
  role: string; emails: string[]; resend?: boolean; appUrl: string;
}) {
  const { user, schoolId, schoolName, inviterName, role, emails, resend, appUrl } = opts;
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
  const sent: any[] = [];
  const skipped: any[] = [];
  const failed: any[] = [];
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const base = appUrl.replace(/\/$/, '');

  for (const email of emails) {
    const existing = await svc.entities.SchoolInvitation.filter({
      school_id: schoolId, invited_email: email, role, status: 'pending',
    });
    let invitation;

    if (resend) {
      if (existing.length > 0) {
        const inv = existing[0];
        const token = makeToken();
        await svc.entities.SchoolInvitation.update(inv.id, {
          token, expires_at: expiresAt, invited_at: now.toISOString(),
          email_status: null, email_error: null,
        });
        invitation = { ...inv, token, expires_at: expiresAt };
      } else {
        const token = makeToken();
        invitation = await svc.entities.SchoolInvitation.create({
          school_id: schoolId, school_name: schoolName, invited_email: email, role,
          invited_by: user.email, invited_by_name: inviterName, status: 'pending',
          token, invited_at: now.toISOString(), expires_at: expiresAt,
        });
      }
    } else {
      if (existing.length > 0) {
        skipped.push({ email, reason: 'already invited (pending)', existing_status: existing[0].status });
        continue;
      }
      const token = makeToken();
      invitation = await svc.entities.SchoolInvitation.create({
        school_id: schoolId, school_name: schoolName, invited_email: email, role,
        invited_by: user.email, invited_by_name: inviterName, status: 'pending',
        token, invited_at: now.toISOString(), expires_at: expiresAt,
      });
    }

    const inviteUrl = `${base}/invite/${invitation.token}`;
    const { subject, body } = renderInviteEmail(schoolName, inviterName, email, inviteUrl, roleLabel);
    const { delivered, error } = await sendInviteEmail(svc, email, subject, body);
    const email_status = delivered ? 'sent' : 'failed';
    await svc.entities.SchoolInvitation.update(invitation.id, { email_status, email_error: delivered ? null : error });

    if (delivered) {
      sent.push({ id: invitation.id, email, invite_url: inviteUrl, email_status });
    } else {
      failed.push({ id: invitation.id, email, invite_url: inviteUrl, email_status, email_error: error });
    }
  }

  return {
    sent_count: sent.length,
    skipped_count: skipped.length,
    failed_count: failed.length,
    sent,
    skipped,
    failed,
  };
}