// ============================================================================
// orgVerification — shared helpers for the Issuer Organisation / Verifier
// architecture. Membership, authorisation and policy resolution for the new
// verification workflow. Never trusts client-side state.
// ============================================================================
import { resolveEffectiveActor } from './testMode.ts';
import { pushEvent } from './verificationFlow.ts';

export const ORG_TYPES = [
  'company', 'university', 'school', 'certification_provider', 'training_provider',
  'competition', 'sports_organisation', 'nonprofit', 'professional_organisation', 'other',
];

export async function authActor(base44: any) {
  const actor = await resolveEffectiveActor(base44);
  if (!actor.authorized) {
    return { actor: null, email: null, error: Response.json({ error: actor.reason || 'Unauthorized' }, { status: actor.status || 401 }) };
  }
  return { actor, email: String(actor.actor_email || '').trim().toLowerCase(), error: null };
}

// Every non-removed membership for an email.
export async function getMemberships(svc, email: string) {
  const lower = (email || '').trim().toLowerCase();
  if (!lower) return [];
  const direct = await svc.entities.OrganisationMember.filter({ user_email: lower }).catch(() => []);
  if (direct?.length) return direct;
  const rows = await svc.entities.OrganisationMember.filter({ user_email: lower, status: { $in: ['invited', 'active', 'suspended'] } }).catch(() => []);
  return rows || [];
}

// The caller must be an ACTIVE member (owner or verifier) of this org.
export async function requireActiveMember(svc, email: string, orgId: string) {
  const memberships = await getMemberships(svc, email);
  const m = memberships.find((x: any) => x.org_id === orgId && x.status === 'active');
  return m || null;
}

export function isOwner(m: any): boolean {
  return m?.role === 'owner' && m?.status === 'active';
}

// Resolve the policy for an achievement: the first ACTIVE policy whose
// categories include the achievement's category (empty = all categories).
// Falls back to { required_signatures: 1 } when the org has no policy.
export async function resolvePolicy(svc, orgId: string, category?: string | null) {
  const rows = await svc.entities.VerificationPolicy.filter({ org_id: orgId, is_active: true }).catch(() => []);
  const match = (rows || []).find((p: any) =>
    !Array.isArray(p.categories) || p.categories.length === 0 || (category && p.categories.includes(category))
  );
  if (match) return match;
  return { id: null, name: 'Default', required_signatures: 1, specific_verifier_emails: [], categories: [] };
}

// Best-effort organisation audit event.
export async function orgEvent(svc, org: any, event: string, actor: string, note?: string) {
  try {
    await svc.entities.IssuerOrganisation.update(org.id, {
      event_log: pushEvent(org.event_log, event, actor, note),
    });
  } catch { /* best-effort */ }
}

export function slugifyHandle(name: string): string {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'issuer';
}

export function generateJoinToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}