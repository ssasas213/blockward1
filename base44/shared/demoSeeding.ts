// ============================================================================
// demoSeeding — shared helpers for the demo-world seeders (seedInvestorDemo,
// seedPitchDemo). Every demo seeder needs the same time helpers, the same
// super-admin authorization gate, the same rate-limit retry wrapper and the
// same profile/request lookups — they live here, once.
// ============================================================================
import { verifyTestSuperUser } from './testMode.ts';

export const appUrl = () => Deno.env.get('APP_URL') || 'https://blockward.base44.app';
export const ago = (days) => new Date(Date.now() - days * 86400000).toISOString();
export const day = (days) => new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
export const inDaysDate = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
export const fail = (msg) => { throw new Error(msg); };
export const norm = (e) => String(e || '').trim().toLowerCase();

// Rate-limit resilience — retries a unit of seeding work when the platform's
// write-rate limit trips. Every unit re-derives its own state (idempotent).
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export async function retryRateLimit(fn, label, tries = 5) {
  for (let t = 0; ; t++) {
    try {
      return await fn();
    } catch (e) {
      const msg = String(e?.message || e);
      if (t < tries && /rate limit/i.test(msg)) {
        console.log(`[seed] ${label} hit a rate limit — backing off ${(5 + t * 10)}s`);
        await sleep((5 + t * 10) * 1000);
        continue;
      }
      throw e;
    }
  }
}

export const gradeFor = (pct) =>
  pct >= 90 ? 'A*' : pct >= 80 ? 'A' : pct >= 70 ? 'B' : pct >= 60 ? 'C' : pct >= 50 ? 'D' : pct >= 40 ? 'E' : 'U';

export const profileByEmail = async (svc, email) =>
  (await svc.entities.UserProfile.filter({ user_email: norm(email) }))[0] || null;

export const findRequest = async (svc, email, title) =>
  (await svc.entities.AchievementRequest.filter({ student_email: norm(email) }, '-created_date', 200))
    .find((r) => r.title === title) || null;

// Authorization: the Test Super User, or a real super_admin.
export async function authorizeDemo(base44) {
  const check = await verifyTestSuperUser(base44);
  if (check.authorized) return { ok: true, email: check.user.email };
  const user = await base44.auth.me();
  if (!user) return { ok: false, status: 401, reason: 'Not authenticated' };
  const svc = base44.asServiceRole;
  const profiles = await svc.entities.UserProfile.filter({ user_email: user.email });
  const p = profiles[0];
  if (!p || p.user_type !== 'admin' || p.admin_level !== 'super_admin') {
    return { ok: false, status: 403, reason: 'Only super admins can manage demo data' };
  }
  return { ok: true, email: user.email };
}