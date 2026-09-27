// Generic Resend email dispatcher shared by every backend email-sending flow
// (invitations, record-workflow notifications, etc.). One implementation so
// RESEND_API_KEY / RESEND_FROM_EMAIL wiring lives in a single place.
//
// Returns { delivered, error } so callers can log/record the outcome without
// ever throwing — email delivery is always best-effort and must not block the
// calling workflow.
//
// DELIVERY LOGGING: when a service-role client is passed (svc), every send is
// recorded on the EmailLog entity (sent | failed + error). A failed email
// never rolls back the workflow that triggered it — the record persists here
// so delivery failures stay inspectable instead of living only in the console.

async function sendResendEmailCore(to: string, subject: string, html: string): Promise<{ delivered: boolean; error?: string }> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM_EMAIL");
  if (!apiKey || !from) {
    console.log("[resend-email] MISSING_SECRET — Resend not configured", { to });
    return { delivered: false, error: "Resend not configured (RESEND_API_KEY / RESEND_FROM_EMAIL missing)" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html }),
    });
    const data = await res.json().catch(() => null);
    console.log("[resend-email] response", {
      status: res.status, ok: res.ok, from, to,
      resendId: data?.id || null, resendError: data?.message || null,
    });
    if (res.ok) return { delivered: true };
    return { delivered: false, error: data?.message || res.statusText || `Resend error ${res.status}` };
  } catch (e) {
    console.log("[resend-email] fetch threw", { error: e?.message, to });
    return { delivered: false, error: e?.message || String(e) };
  }
}

export async function sendResendEmail(to: string, subject: string, html: string, svc?: any): Promise<{ delivered: boolean; error?: string }> {
  const result = await sendResendEmailCore(to, subject, html);
  if (svc) {
    try {
      await svc.entities.EmailLog.create({
        recipient_email: to,
        subject,
        status: result.delivered ? 'sent' : 'failed',
        error: result.delivered ? null : (result.error || null),
        provider: 'resend',
        sent_at: new Date().toISOString(),
      });
    } catch (e: any) {
      console.log('[resend-email] email log write failed:', e?.message || e);
    }
  }
  return result;
}