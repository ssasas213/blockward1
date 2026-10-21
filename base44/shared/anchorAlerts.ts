// anchorAlerts — shared internal-admin notification helper for the anchoring
// pipeline. Extracted so both the production queue (anchorQueue) and the
// read-only gas-fee monitor (gasFeeMonitor) alert the same recipients without
// a circular import. Recipients come ONLY from server-side secrets; receiving
// a notification grants nothing.
import { secrets } from 'base44:runtime';

export function adminRecipients(): string[] {
  const set = new Set<string>();
  try {
    for (const key of ['BLOCKWARD_SUPER_ADMIN_NOTIFICATION_EMAILS', 'BLOCKWARD_INTERNAL_ADMIN_EMAILS']) {
      const raw = secrets.get(key) || '';
      String(raw).split(',').map((x: string) => x.trim().toLowerCase()).filter(Boolean).forEach((e: string) => set.add(e));
    }
  } catch { /* secrets unavailable */ }
  if (set.size === 0) ['mazen@blockward.me', 'arya@blockward.me'].forEach((e) => set.add(e));
  return [...set];
}

export async function notifyAnchorAdmins(svc: any, title: string, body: string, type: string, priority: string) {
  const recipients = adminRecipients();
  await Promise.allSettled(recipients.map((email) =>
    svc.entities.Notification.create({ user_email: email, title, body, type, priority, related_id: null })
  ));
}