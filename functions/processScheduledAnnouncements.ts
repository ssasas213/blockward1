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

    // Also send reminders for announcements scheduled in the next 30 minutes
    const toRemind = allScheduled.filter(a => {
      if (!a.scheduled_at) return false;
      const t = new Date(a.scheduled_at);
      const diff = (t - now) / 60000; // minutes
      return diff > 0 && diff <= 30;
    });

    let processed = 0;
    for (const ann of toSend) {
      await base44.asServiceRole.entities.Announcement.update(ann.id, {
        status: "sent",
        sent_at: now.toISOString(),
      });
      // Dispatch notifications if important/urgent
      if (ann.priority === 'urgent' || ann.priority === 'important') {
        try {
          await base44.asServiceRole.functions.invoke('dispatchAnnouncementNotifications', { announcement_id: ann.id });
        } catch (_) {}
      }
      processed++;
    }

    // Send scheduled reminders
    for (const ann of toRemind) {
      if (ann.priority === 'urgent' || ann.priority === 'important') {
        try {
          await base44.asServiceRole.functions.invoke('dispatchAnnouncementNotifications', {
            announcement_id: ann.id,
            type: 'announcement_scheduled_reminder'
          });
        } catch (_) {}
      }
    }

    console.log(JSON.stringify({ step: "processScheduled", processed, reminders: toRemind.length, checked: allScheduled.length }));
    return Response.json({ ok: true, processed, reminders: toRemind.length });
  } catch (err) {
    console.log(JSON.stringify({ step: "processScheduled_error", error: String(err?.message) }));
    return Response.json({ ok: false, error: err?.message || "Unknown error" }, { status: 500 });
  }
});