import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { announcement_id, type } = await req.json();

    if (!announcement_id) {
      return Response.json({ error: 'announcement_id is required' }, { status: 400 });
    }

    // Fetch the announcement
    const announcements = await base44.asServiceRole.entities.Announcement.filter({ id: announcement_id });
    if (!announcements.length) return Response.json({ error: 'Announcement not found' }, { status: 404 });
    const ann = announcements[0];

    const notifType = type || (ann.priority === 'urgent' ? 'announcement_urgent' : 'announcement_important');

    // Get all users with matching preferences
    const prefs = await base44.asServiceRole.entities.NotificationPreference.list();

    const relevantPrefs = prefs.filter(p => {
      if (notifType === 'announcement_urgent') return p.notify_urgent !== false;
      if (notifType === 'announcement_important') return p.notify_important !== false;
      if (notifType === 'announcement_scheduled_reminder') return p.notify_scheduled_reminder === true;
      return false;
    });

    const title = notifType === 'announcement_scheduled_reminder'
      ? `Upcoming: ${ann.title}`
      : notifType === 'announcement_urgent'
        ? `🚨 Urgent: ${ann.title}`
        : `📢 Important: ${ann.title}`;

    const body = ann.body_short || ann.body?.slice(0, 200) || '';

    // Create in-app notifications for all opted-in users
    const notifications = relevantPrefs.map(p => ({
      user_email: p.user_email,
      school_id: ann.school_id || undefined,
      title,
      body,
      type: notifType,
      priority: ann.priority || 'normal',
      related_id: ann.id,
      read: false,
    }));

    if (notifications.length > 0) {
      await base44.asServiceRole.entities.Notification.bulkCreate(notifications);
    }

    // Also send email notifications for urgent announcements
    if (notifType === 'announcement_urgent' && relevantPrefs.length > 0) {
      for (const p of relevantPrefs.slice(0, 50)) { // limit to 50 emails per call
        try {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: p.user_email,
            subject: `🚨 Urgent School Announcement: ${ann.title}`,
            body: `<h2>${ann.title}</h2><p>${ann.body || ''}</p><p style="color:#888;font-size:12px;">This is an urgent announcement from your school. Log in to BlockWard to view details.</p>`,
          });
        } catch (_) {}
      }
    }

    return Response.json({ success: true, notified: notifications.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});