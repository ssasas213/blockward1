import { base44 } from '@/api/base44Client';

/**
 * achievementMeta — client helpers for the student's PERSONAL achievement
 * organisation: categories, featured, card order, archived.
 *
 * Everything here is presentation metadata stored in dedicated entities
 * (AchievementMeta / AchievementCategory), never on the Achievement or
 * Credential records — so it can never alter issuer-signed content, the
 * BW-HASH-V1 commitment or the verification audit trail. All rows are
 * owner-scoped by RLS.
 */

export const DEFAULT_CATEGORIES = [
  { name: 'Academic Achievements', icon: 'GraduationCap', color: 'blue' },
  { name: 'Competitions & Awards', icon: 'Trophy', color: 'amber' },
  { name: 'Sports', icon: 'Medal', color: 'green' },
  { name: 'Volunteering & Community Service', icon: 'HeartHandshake', color: 'rose' },
  { name: 'Work Experience & Internships', icon: 'Briefcase', color: 'indigo' },
  { name: 'Certifications & Qualifications', icon: 'FileBadge', color: 'violet' },
  { name: 'Leadership', icon: 'Crown', color: 'amber' },
  { name: 'Projects & Entrepreneurship', icon: 'Rocket', color: 'sky' },
  { name: 'Arts & Creativity', icon: 'Palette', color: 'pink' },
  { name: 'Other', icon: 'Shapes', color: 'slate' },
];

const asArray = (r) => (Array.isArray(r) ? r : (r?.items || []));

export async function loadCategories() {
  const rows = await base44.entities.AchievementCategory.list({ sort: 'sort_order', limit: 100 });
  return asArray(rows);
}

/** Seeds the ten starter categories on first use — idempotent. */
export async function ensureDefaultCategories(existing) {
  const cats = existing || (await loadCategories());
  if (cats.length > 0) return cats;
  await base44.entities.AchievementCategory.bulkCreate(
    DEFAULT_CATEGORIES.map((d, i) => ({ ...d, sort_order: i, is_default: true })),
  );
  return loadCategories();
}

export async function createCategory(ownerEmail, { name, icon, color, sort_order }) {
  return base44.entities.AchievementCategory.create({
    owner_email: ownerEmail, name, icon: icon || 'Shapes', color: color || 'slate', sort_order: sort_order ?? 999,
  });
}

export async function updateCategory(id, patch) {
  return base44.entities.AchievementCategory.update(id, patch);
}

export async function deleteCategory(id) {
  return base44.entities.AchievementCategory.delete(id);
}

export async function loadMeta() {
  const rows = await base44.entities.AchievementMeta.list({ limit: 500 });
  return asArray(rows);
}

export const metaFor = (metas, ref) => (metas || []).find((m) => m.achievement_ref === ref) || null;

/**
 * Upsert a metadata patch for many achievement refs at once (bulk category
 * assignment, feature, archive, reorder). Owner-scoped by RLS; duplicates
 * across concurrent tabs are tolerated by first-wins dedupe at read time.
 */
export async function upsertMetas(ownerEmail, refs, patch) {
  const list = refs.filter(Boolean);
  if (!list.length) return;
  const rows = (await loadMeta()).filter((m) => list.includes(m.achievement_ref));
  const have = new Set(rows.map((r) => r.achievement_ref));
  if (rows.length) {
    await base44.entities.AchievementMeta.bulkUpdate(rows.map((r) => ({ id: r.id, ...patch })));
  }
  const missing = list.filter((ref) => !have.has(ref));
  if (missing.length) {
    await base44.entities.AchievementMeta.bulkCreate(missing.map((ref) => ({
      owner_email: ownerEmail, achievement_ref: ref, category_ids: [], ...patch,
    })));
  }
}

export const assignCategories = (ownerEmail, refs, ids) => upsertMetas(ownerEmail, refs, { category_ids: ids || [] });
export const setFeatured = (ownerEmail, refs, on) => upsertMetas(ownerEmail, refs, { featured: !!on });
export const setArchived = (ownerEmail, refs, on) => upsertMetas(ownerEmail, refs, { archived: !!on });
export async function setCardOrder(ownerEmail, orderedRefs) {
  return upsertMetas(ownerEmail, orderedRefs, { card_order: null });
}

/** Persist a drag-and-drop order as card_order = index. */
export async function saveCardOrder(ownerEmail, orderedRefs) {
  const rows = (await loadMeta()).filter((m) => orderedRefs.includes(m.achievement_ref));
  const byRef = new Map(rows.map((r) => [r.achievement_ref, r]));
  const updates = [];
  const creates = [];
  orderedRefs.forEach((ref, i) => {
    const row = byRef.get(ref);
    if (row) updates.push({ id: row.id, card_order: i });
    else creates.push({ owner_email: ownerEmail, achievement_ref: ref, category_ids: [], card_order: i });
  });
  if (updates.length) await base44.entities.AchievementMeta.bulkUpdate(updates);
  if (creates.length) await base44.entities.AchievementMeta.bulkCreate(creates);
}