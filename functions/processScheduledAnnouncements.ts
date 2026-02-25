import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*" } });
  }

  try {
    const base44 = createClientFromRequest(req);

    // Verify admin
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const profile = await base44.entities.UserProfile.filter({ user_email: user.email });
    const userType = profile[0]?.user_type;
    if (userType !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });

    // Find scheduled announcements whose scheduledAt is in the past
    const allScheduled = await base44.asServiceRole.entities.Announcement.filter({ status: "scheduled" });
    const now = new Date();
    const toSend = allScheduled.filter(a => a.scheduled_at && new Date(a.scheduled_at) <= now);

    let processed = 0;
    for (const ann of toSend) {
      await base44.asServiceRole.entities.Announcement.update(ann.id, {
        status: "sent",
        sent_at: now.toISOString(),
      });
      processed++;
    }

    return Response.json({ ok: true, processed });
  } catch (err) {
    return Response.json({ ok: false, error: err?.message || "Unknown error" }, { status: 500 });
  }
});