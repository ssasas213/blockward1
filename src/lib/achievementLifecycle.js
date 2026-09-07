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
 * @returns {Promise<{ achievements: Array, profile: Object|null }>}
 */
export async function loadEarnedAchievements() {
  try {
    const res = await base44.functions.invoke('getStudentVault', {});
    const data = res.data;
    if (!data?.ok) return { achievements: [], profile: null };
    return {
      achievements: data.achievements || [],
      profile: data.profile || null,
    };
  } catch {
    return { achievements: [], profile: null };
  }
}