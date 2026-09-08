/**
 * Shared handle logic for the public /@handle profile system.
 * Used by: checkHandleAvailability, updatePublicProfile, publicProfileData.
 *
 * Scarcity by design: 3-character handles and common first names are
 * RESERVED — they are never claimable first-come. BlockWard releases them
 * deliberately (e.g. to verified organisations or notable members) rather
 * than letting a squatter take @maya. Handles already legitimately owned
 * before the reservation list existed keep working — only NEW claims are
 * blocked.
 */

const HANDLE_RE = /^[a-z0-9_]{3,20}$/;
const COOLDOWN_DAYS = 30;

// Common first names — reserved so they can be released deliberately instead
// of being squatted. Lowercase, matching handle format.
const RESERVED_NAMES = new Set([
  'adam', 'ade', 'adrian', 'ahmed', 'aisha', 'alan', 'albert', 'alex', 'alexa', 'alice',
  'alina', 'amara', 'amelia', 'amine', 'amy', 'ana', 'andrew', 'anna', 'anne', 'anthony',
  'anton', 'anaya', 'aria', 'ariel', 'arjun', 'arthur', 'aryan', 'ashley', 'austin', 'avani',
  'avery', 'aya', 'ayaan', 'ayesha', 'ben', 'benjamin', 'bernard', 'blake', 'brandon', 'brian',
  'brooke', 'caleb', 'cameron', 'carla', 'carlos', 'carmen', 'carter', 'cathy', 'cecilia', 'cedric',
  'chad', 'charlie', 'charlotte', 'chase', 'chen', 'chloe', 'chris', 'christian', 'clara', 'claire',
  'colin', 'connor', 'cora', 'daisy', 'dan', 'daniel', 'danielle', 'dave', 'david', 'dean',
  'deepa', 'deniz', 'dennis', 'diego', 'divya', 'dominic', 'dylan', 'eddie', 'edgar', 'edith',
  'edward', 'elena', 'elias', 'elize', 'ella', 'ellen', 'eloise', 'elton', 'emil', 'emily',
  'emma', 'enzo', 'eric', 'erica', 'erin', 'esme', 'esther', 'ethan', 'eva', 'evelyn',
  'ezra', 'fatima', 'felix', 'fern', 'finn', 'fiona', 'flora', 'frances', 'frank', 'freya',
  'gabriel', 'gareth', 'gary', 'gemma', 'george', 'gianna', 'gina', 'gita', 'glenn', 'grace',
  'greg', 'gwen', 'hana', 'hannah', 'harper', 'harry', 'harvey', 'hazel', 'heather', 'hector',
  'helen', 'henry', 'hilda', 'hugo', 'ian', 'ida', 'iman', 'ines', 'iris', 'isaac',
  'isabel', 'ivan', 'ivy', 'jack', 'jacob', 'jade', 'james', 'jamie', 'jane', 'jasmine',
  'jason', 'javier', 'jay', 'jayden', 'jeff', 'jenna', 'jennifer', 'jess', 'jessica', 'jill',
  'jim', 'jo', 'joan', 'joe', 'joel', 'john', 'jonah', 'jordan', 'jose', 'joseph',
  'josh', 'joy', 'juan', 'judy', 'julia', 'julian', 'julie', 'justin', 'kai', 'kara',
  'karen', 'karl', 'kate', 'katherine', 'keith', 'kelly', 'ken', 'kendall', 'kevin', 'kim',
  'kiran', 'kurt', 'kyle', 'lana', 'laura', 'lauren', 'leah', 'lee', 'leo', 'leon',
  'leona', 'levi', 'lewis', 'lily', 'linda', 'lisa', 'logan', 'lola', 'lorenzo', 'louis',
  'lucas', 'lucy', 'luke', 'luna', 'lydia', 'lynn', 'maddie', 'mae', 'maggie', 'mai',
  'malik', 'marcus', 'margaret', 'maria', 'marie', 'marina', 'mario', 'martha', 'martin', 'mary',
  'mason', 'matteo', 'maya', 'mei', 'mel', 'melissa', 'mia', 'micah', 'michael', 'michelle',
  'miguel', 'milo', 'mira', 'miriam', 'mitch', 'molly', 'monica', 'morgan', 'musa', 'nadia',
  'nancy', 'naomi', 'natalie', 'nathan', 'neal', 'neil', 'nico', 'nicole', 'nina', 'noah',
  'nolan', 'nora', 'norman', 'oliver', 'olivia', 'omar', 'oscar', 'owen', 'pablo', 'paige',
  'pam', 'patrick', 'paul', 'pedro', 'pete', 'peter', 'phil', 'phoebe', 'pierce', 'polly',
  'priya', 'quinn', 'rachel', 'rafael', 'ralph', 'randy', 'ravi', 'ray', 'rebecca', 'renee',
  'rex', 'rhys', 'ricardo', 'rick', 'riley', 'rita', 'rob', 'robert', 'roger', 'roman',
  'ron', 'rona', 'rory', 'rosa', 'rose', 'ross', 'ruby', 'ryan', 'sacha', 'sadie',
  'sam', 'samantha', 'samuel', 'sandra', 'sara', 'sarah', 'scott', 'sean', 'selena', 'serena',
  'seth', 'shane', 'shaun', 'shirley', 'simon', 'sofia', 'sohan', 'sonia', 'sophie', 'stacy',
  'stefan', 'stella', 'stephen', 'steve', 'steven', 'sue', 'sunita', 'sydney', 'sylvia', 'tamara',
  'tanya', 'tara', 'taylor', 'ted', 'tessa', 'thomas', 'tia', 'tiffany', 'tim', 'timmy',
  'tina', 'toby', 'todd', 'tom', 'tommy', 'tony', 'tori', 'tracy', 'tristan', 'tyler',
  'uma', 'ursula', 'val', 'valentina', 'vanessa', 'vera', 'veronica', 'victor', 'victoria', 'vincent',
  'viola', 'violet', 'wade', 'walter', 'wanda', 'will', 'william', 'willow', 'wyatt', 'xavier',
  'yasmin', 'yuki', 'yusuf', 'zack', 'zara', 'zoe',
]);

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

export function isHandleReserved(handle: string): boolean {
  return handle.length <= 3 || RESERVED_NAMES.has(handle);
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
 * Whether a handle is free to claim, and why not if it isn't. Checks active
 * handles, reserved history (old handles stay permanently reserved as
 * redirects), and the deliberate-release reservation list.
 * svc = base44.asServiceRole client.
 */
export async function isHandleAvailable(
  svc,
  handle: string,
  excludeProfileId: string | null
): Promise<{ available: boolean; reason: string | null; reserved: boolean }> {
  const active = await svc.entities.UserProfile.filter({ handle });
  if (active.some((p) => p.id !== excludeProfileId)) {
    return { available: false, reason: `@${handle} is already taken`, reserved: false };
  }

  // Old handles live in handle_history (array) — must never be re-claimed.
  try {
    const reserved = await svc.entities.UserProfile.filter({ handle_history: handle });
    if (reserved.some((p) => p.id !== excludeProfileId)) {
      return { available: false, reason: `@${handle} was used before and stays permanently reserved`, reserved: false };
    }
  } catch (e) { /* field may be unindexed on old records — fall through */ }

  // Deliberate-release reservation — never claimable first-come.
  if (isHandleReserved(handle)) {
    return { available: false, reason: `@${handle} is reserved by BlockWard`, reserved: true };
  }

  return { available: true, reason: null, reserved: false };
}

/**
 * Up to 3 near-miss handles that ARE available, e.g. when @maya is taken:
 * "@maya_ is available". Ordered by how close they stay to the original.
 */
export async function suggestHandles(svc, handle: string, excludeProfileId: string | null): Promise<string[]> {
  const suffixes = ['_', '1', 'bw', '2', 'hq', 'x', 'official', 'real'];
  const suggestions: string[] = [];
  for (const suffix of suffixes) {
    const candidate = `${handle}${suffix}`;
    if (candidate.length > 20) continue;
    try {
      const check = await isHandleAvailable(svc, candidate, excludeProfileId);
      if (check.available) suggestions.push(candidate);
    } catch (e) { /* ignore individual failures */ }
    if (suggestions.length >= 3) break;
  }
  return suggestions;
}