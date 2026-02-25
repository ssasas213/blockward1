import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*" } });
  }

  try {
    const base44 = createClientFromRequest(req);

    // Find scheduled announcements whose scheduled_at is in the past
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

    console.log(JSON.stringify({ step: "processScheduled", processed, checked: allScheduled.length }));
    return Response.json({ ok: true, processed });
  } catch (err) {
    console.log(JSON.stringify({ step: "processScheduled_error", error: String(err?.message) }));
    return Response.json({ ok: false, error: err?.message || "Unknown error" }, { status: 500 });
  }
});