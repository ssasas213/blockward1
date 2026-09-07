/**
 * Shared handle logic for the public /@handle profile system.
 * Used by: checkHandleAvailability, updatePublicProfile, publicProfileData.
 */

const HANDLE_RE = /^[a-z0-9_]{3,20}$/;
const COOLDOWN_DAYS = 30;

export function normalizeHandle(raw: string): string {
  return (raw || '').trim().toLowerCase();
}

export function validateHandle(handle: string): { valid: boolean; reason?: string } {
  if (!handle) return { valid: false, reason: 'Handle is required' };
  if (!HANDLE_RE.test(handle)) {
    return { valid: false, reason: '3–20 characters, lowercase letters, numbers and underscores only' };
  }
  return { valid: true };
}

/**
 * Days remaining in the 30-day change cooldown (0 = can change).
 * First-ever claim is always free.
 */
export function cooldownDaysRemaining(currentHandle: string | null, changedAt: string | null): number {
  if (!currentHandle || !changedAt) return 0;
  const changed = new Date(changedAt).getTime();
  if (Number.isNaN(changed)) return 0;
  const elapsedDays = (Date.now() - changed) / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.ceil(COOLDOWN_DAYS - elapsedDays));
}

/**
 * Whether a handle is free to claim. Checks active handles AND reserved
 * history (old handles stay permanently reserved as redirects).
 * svc = base44.asServiceRole client.
 */
export async function isHandleAvailable(svc, handle: string, excludeProfileId: string | null): Promise<boolean> {
  const active = await svc.entities.UserProfile.filter({ handle });
  if (active.some((p) => p.id !== excludeProfileId)) return false;

  // Old handles live in handle_history (array) — must never be re-claimed.
  try {
    const reserved = await svc.entities.UserProfile.filter({ handle_history: handle });
    if (reserved.some((p) => p.id !== excludeProfileId)) return false;
  } catch (e) { /* field may be unindexed on old records — fall through */ }

  return true;
}