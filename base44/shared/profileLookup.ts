/**
 * profileLookup — targeted UserProfile lookup by email.
 *
 * Replaces the full-table scans (`UserProfile.filter({})` then find-by-email)
 * that used to load EVERY profile in the database to locate one. Profiles are
 * now normalised to lowercase ON WRITE (profileProvisioning), so the common
 * case is a single exact-match query; the case-variant queries below cover
 * profiles created before normalisation existed. At most 2-3 targeted queries,
 * never a scan.
 */

export function normalizeEmailString(e: string): string {
  return (e || '').trim().toLowerCase();
}

export async function findProfileByEmail(svc: any, email: string): Promise<any | null> {
  const raw = (email || '').trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  const variants = [...new Set([raw, lower, lower.charAt(0).toUpperCase() + lower.slice(1)])];
  for (const v of variants) {
    try {
      const rows = await svc.entities.UserProfile.filter({ user_email: v });
      if (rows?.length > 0) return rows[0];
    } catch (e) { /* try the next variant */ }
  }
  return null;
}