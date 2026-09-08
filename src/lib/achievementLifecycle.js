import { base44 } from '@/api/base44Client';

/**
 * loadEarnedAchievements — THE single loader for earned achievements on every
 * student page, per ACHIEVEMENT_ARCHITECTURE.md ("Single Source of Truth —
 * Reading"). Verified achievements (archived StudentRecords joined with their
 * minted BlockWards) are read through the shared vault service, which handles
 * RLS and guarantees the student sees achievements immediately after delivery.
 *
 * No student page should call the vault function directly — import this instead.
 *
 * CACHING: the result is cached with a 60-second TTL, stale-while-revalidate.
 * Navigating between pages serves the cached list instantly; a stale cache is
 * refreshed invisibly in the background and never blocks the render. Pass
 * { force: true } to await a fresh load (e.g. after a mutation), or call
 * invalidateAchievementCache() to mark the cache stale.
 *
 * @returns {Promise<{ achievements: Array, profile: Object|null }>}
 */
const CACHE_TTL = 60_000; // 60 seconds
const cache = { data: null, at: 0, inflight: null };

function startLoad() {
  cache.inflight = (async () => {
    try {
      const res = await base44.functions.invoke('getStudentVault', {});
      const data = res.data;
      if (!data?.ok) return { achievements: [], profile: null }; // never cache failures
      const out = { achievements: data.achievements || [], profile: data.profile || null };
      cache.data = out;
      cache.at = Date.now();
      return out;
    } catch {
      return { achievements: [], profile: null }; // never cache failures
    } finally {
      cache.inflight = null;
    }
  })();
  return cache.inflight;
}

export async function loadEarnedAchievements({ force = false } = {}) {
  // A fetch is already in flight — piggyback on it (dedupes concurrent pages).
  if (cache.inflight) return cache.inflight;

  const fresh = cache.data && (Date.now() - cache.at) < CACHE_TTL;
  if (fresh && !force) return cache.data;

  // Stale but present: serve the cached data NOW and revalidate in the
  // background so navigation never blocks on a refetch.
  if (cache.data && !force) {
    startLoad();
    return cache.data;
  }
  return startLoad();
}

/** Mark the cache stale — the next loadEarnedAchievements() refetches. */
export function invalidateAchievementCache() {
  cache.at = 0;
}