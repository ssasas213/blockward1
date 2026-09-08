// Independent verification — a student with no organisation can get an
// achievement verified by a named person who was there (coach, referee,
// employer…), via a one-time account-free link. This module holds the role
// whitelist, the disposable-domain blocklist, the self-verification (alias)
// checks and the rolling monthly cap — shared by achievementRequestAction
// (submit + confirm) and the maintenance sweep.

// Roles a student can pick for an independent verifier.
export const INDEPENDENT_ROLES = [
  'coach', 'teacher', 'instructor', 'examiner', 'referee',
  'club_official', 'event_organiser', 'employer', 'mentor', 'other',
];

// Max independent verifications per student per rolling 30 days.
export const INDEPENDENT_MONTHLY_CAP = 5;

// The verifier link lives 14 days (shorter than the org flow's 30 — an
// independent verifier acts on a personal email, not an institutional queue).
export const INDEPENDENT_TOKEN_DAYS = 14;

// Known disposable / temporary email providers. Rejecting these is a hard
// block, not a flag — a throwaway address is the cheapest self-verification
// attack. Keep this list maintained as new providers appear.
export const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'guerrillamailblock.com', 'sharklasers.com',
  'grr.la', 'guerrillamail.net', 'guerrillamail.org', 'guerrillamail.biz',
  '10minutemail.com', '10minutemail.net', '20minutemail.com', 'temp-mail.org',
  'temp-mail.io', 'tempmail.com', 'tempmail.net', 'tempmailo.com', 'tempmail.dev',
  'tempr.email', 'tmpmail.org', 'tmpeml.com', 'tmpmail.net', 'throwawaymail.com',
  'throwawaymail.net', 'yopmail.com', 'yopmail.net', 'yopmail.fr', 'yopmail.org',
  'maildrop.cc', 'dispostable.com', 'mailnesia.com', 'mailnesia.net',
  'trashmail.com', 'trashmail.de', 'trash-mail.com', 'trashmail.me',
  'fakeinbox.com', 'fakemail.net', 'fake-mail.net', 'getnada.com', 'nada.email',
  'inboxbear.com', 'spambog.com', 'spambog.de', 'spambog.ru', 'mailcatch.com',
  'mintemail.com', 'mohmal.com', 'emailondeck.com', 'email-fake.com',
  'burnermail.io', 'burnermail.net', 'spam4.me', 'tempinbox.com', 'mytemp.email',
  'mohmal.im', 'linshiyouxiang.net', 'mail-temp.com', 'tempmailaddress.com',
  'instantemailaddress.com', 'discard.email', 'discardmail.com', 'discardmail.de',
]);

// Canonical form of an email for alias comparison: lowercase, strip dots in
// the local part (Gmail-style aliasing) and strip +suffix tags. A verifier
// address matching the student's canonical form is a self-verification.
export function canonicalEmail(email: string): string {
  const e = String(email || '').trim().toLowerCase();
  if (!e.includes('@')) return e;
  const [local, domain] = e.split('@');
  const bare = local.split('+')[0].replace(/\./g, '');
  return `${bare}@${domain}`;
}

export function isDisposableEmail(email: string): boolean {
  const domain = String(email || '').trim().toLowerCase().split('@')[1];
  if (!domain) return false;
  if (DISPOSABLE_DOMAINS.has(domain)) return true;
  // Obvious throwaway patterns: temp-mail style subdomains.
  if (/^(temp|throwaway|fake|burner)[-a-z0-9]*\./.test(domain)) return true;
  return false;
}

// Returns an error string when the verifier email is the student (or an
// alias / an address already on the student's account), else null.
export function selfVerificationError(
  verifierEmail: string,
  studentEmail: string,
  accountEmails: (string | null | undefined)[] = [],
): string | null {
  const v = canonicalEmail(verifierEmail);
  if (!v) return 'A valid verifier email is required';
  const own = [studentEmail, ...accountEmails]
    .map((e) => (e ? canonicalEmail(e) : ''))
    .filter(Boolean);
  if (own.includes(v)) {
    return 'You cannot verify your own achievement. Ask someone who was there — their email must be different from yours (and from any contact email on your account).';
  }
  return null;
}

// Review flags computed at confirm time. These NEVER auto-reject — they are
// recorded so a human can review later. False positives are costly.
export async function independentVerifierFlags(
  svc: any,
  request: any,
  confirmedEmail: string,
  confirmIp: string | null,
): Promise<{ reason: string; detail: string; at: string }[]> {
  const flags: { reason: string; detail: string; at: string }[] = [];
  const at = new Date().toISOString();
  try {
    const prior = await svc.entities.AchievementRequest.filter({ external_verifier_email: confirmedEmail }, '-created_date', 200);
    const confirmedPrior = (prior || []).filter((r: any) => r.external_signoff?.email);
    const students = new Set<string>(confirmedPrior.map((r: any) => r.student_email));
    students.add(request.student_email);

    // Address whose entire history is a single student — the classic
    // second-email self-verification shape.
    if (students.size === 1) {
      flags.push({
        reason: 'sole_student_verifier',
        detail: `${confirmedEmail} has only ever verified one student (${request.student_email})`,
        at,
      });
    }
    // Unusual volume in a short window.
    const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recent = confirmedPrior.filter((r: any) => new Date(r.external_signoff.signed_at).getTime() >= monthAgo).length;
    if (recent >= 5) {
      flags.push({
        reason: 'high_volume_verifier',
        detail: `${confirmedEmail} has verified ${recent} achievements in the last 30 days`,
        at,
      });
    }
  } catch { /* flags are best-effort — never block a legitimate confirmation */ }

  // Verifier and student appear to share an IP (recorded at submit vs confirm).
  if (confirmIp && request.submit_ip && confirmIp === request.submit_ip) {
    flags.push({
      reason: 'shared_ip',
      detail: `Verifier confirmation came from the same IP as the student's submission (${confirmIp})`,
      at,
    });
  }
  return flags;
}