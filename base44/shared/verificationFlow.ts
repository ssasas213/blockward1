// ============================================================================
// verificationFlow — shared helpers for the Blockward individual verification
// loop (add achievement → request verification → issuer confirms → credential
// → blockchain → verified → share).
// ============================================================================

// Unambiguous alphabet (no 0/O, 1/I/L) for public Credential IDs.
const BW_ID_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export const REQUEST_TOKEN_DAYS = 14;      // issuer link lifetime
export const RESEND_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24h between reminders

export function generateBwId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let id = '';
  for (const b of bytes) id += BW_ID_ALPHABET[b % BW_ID_ALPHABET.length];
  return `BW-${id}`;
}

// Unique BW ID — retries against the Credential table (dupes are impossible
// in practice, but duplicate credential IDs are a stated security requirement).
export async function ensureUniqueBwId(svc): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const id = generateBwId();
    const existing = await svc.entities.Credential.filter({ bw_id: id }).catch(() => []);
    if (!existing || existing.length === 0) return id;
  }
  throw new Error('could not generate a unique credential id');
}

export function generateRequestToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function pushEvent(existingLog: any[] | null | undefined, event: string, actor: string, note?: string) {
  const log = Array.isArray(existingLog) ? existingLog.slice() : [];
  log.push({ event, actor: actor || 'system', note: note ? String(note).slice(0, 500) : undefined, timestamp: new Date().toISOString() });
  return log;
}

// In-app notification for the holder. Best-effort — never blocks the action.
export async function notifyHolder(svc, email: string, title: string, body: string, type: string, relatedId?: string | null) {
  try {
    if (!email) return;
    await svc.entities.Notification.create({
      user_email: (email || '').trim().toLowerCase(),
      title,
      body,
      type,
      related_id: relatedId || null,
      priority: 'normal',
    });
  } catch { /* best-effort */ }
}

// Resolve the UserProfile row for an actor email (case-insensitive fallback).
export async function getActorProfile(svc, email: string) {
  const direct = await svc.entities.UserProfile.filter({ user_email: email }).catch(() => []);
  if (direct?.length) return direct[0];
  const lower = (email || '').trim().toLowerCase();
  const rows = await svc.entities.UserProfile.filter({ user_email: lower }).catch(() => []);
  if (rows?.length) return rows[0];
  try {
    const all = await svc.entities.UserProfile.list('-created_date', 2000);
    return (all || []).find((p: any) => String(p.user_email || '').trim().toLowerCase() === lower) || null;
  } catch {
    return null;
  }
}

// Best-effort in-memory rate limiter (per server instance).
const rateBuckets = new Map<string, number[]>();
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (rateBuckets.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    rateBuckets.set(key, arr);
    return false;
  }
  arr.push(now);
  rateBuckets.set(key, arr);
  return true;
}

// Public base URL for share links and email buttons.
export function appBaseUrl(): string {
  return String(Deno.env.get('APP_URL') || 'https://blockward.base44.app').replace(/\/+$/, '');
}

// Human-readable achievement status labels (single source of truth).
export const ACHIEVEMENT_STATUS_LABELS: Record<string, string> = {
  unverified: 'Unverified',
  verification_requested: 'Verification Requested',
  issuer_confirmed: 'Issuer Confirmed',
  blockchain_processing: 'Blockchain Processing',
  verified: 'Blockward Verified',
  rejected: 'Rejected',
  expired: 'Expired',
  revoked: 'Revoked',
};