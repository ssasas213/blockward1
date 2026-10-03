// ============================================================================
// credentialTrust — the CANONICAL server-side trust calculation for Blockward
// credentials. One source of truth, consumed by public verification and all
// dashboards. Trust is LAYERED, never binary (§4/§5/§34).
//
// It derives ONLY from authoritative stored records (Credential, Achievement,
// VerificationRequest, VerificationSignature, IssuerOrganisation,
// OrganisationMember) plus persisted anchor/integrity state. It never trusts
// client-supplied labels and NEVER performs a live RPC — callers pass a fresh
// integrity result (verifyCredentialAnchor) if they have one; otherwise the
// cached chain_check / anchor_status is used (§42 performance).
//
// MIGRATION — conservative, never destructive (§41):
//   • A credential with a VERIFIED organisation + satisfied signature threshold
//     + confirmed integrity is the only thing that maps to BLOCKWARD_VERIFIED.
//   • A token-flow credential (no org_id — a named external issuer attested
//     without organisation authority) is PERSON_VERIFIED, even if it was
//     previously labelled "Blockward Verified". Organisation authority is never
//     invented for historical records.
//   • Revocation / expiry / suspension never erase historical verification —
//     they are lifecycle states layered on top of the authority level (§23/24/25).
//
// Blockchain ≠ truth (§30/§31): a confirmed anchor proves INTEGRITY only; it
// never promotes a PERSON_VERIFIED credential into BLOCKWARD_VERIFIED. Trust
// level and integrity level are independent.
// ============================================================================

import { computeCredentialHash } from './credentialHash.ts';
import { isTrustedChainCheck, polygonCredentialHashFields } from './chainVerification.ts';

export const TRUST_LEVELS = {
  ADDED_TO_BLOCKWARD: 'added_to_blockward',
  PERSON_VERIFIED: 'person_verified',
  BLOCKWARD_VERIFIED: 'blockward_verified',
} as const;

export const EVIDENCE_STATUS = { NONE: 'none', PROVIDED: 'provided', REVIEWED: 'reviewed' } as const;
export const VERIFIER_IDENTITY = { UNVERIFIED: 'unverified', VERIFIED: 'verified' } as const;
export const ORG_AUTHORITY = {
  NONE: 'none',
  CLAIMED: 'claimed',
  MEMBERSHIP_VERIFIED: 'membership_verified',
  ORGANISATION_VERIFIED: 'organisation_verified',
} as const;
export const INTEGRITY_STATUS = {
  NOT_ANCHORED: 'not_anchored',
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  FAILED: 'failed',
} as const;
export const LIFECYCLE = {
  ACTIVE: 'active',
  EXPIRING_SOON: 'expiring_soon',
  EXPIRED: 'expired',
  REVOKED: 'revoked',
  SUPERSEDED: 'superseded',
} as const;

const EVIDENCE_REVIEW_METHODS = new Set(['reviewed_evidence', 'official_records']);

function low(s?: string | null): string {
  return String(s || '').trim().toLowerCase();
}

function isPublicEvidenceUrl(url?: string | null): boolean {
  return !!url && /^https?:\/\//i.test(url);
}

// Lifecycle from the credential's own status + expiry window (§23/§24/§25).
export function lifecycleFrom(cred: any): string {
  if (cred?.status === 'revoked') return LIFECYCLE.REVOKED;
  if (cred?.status === 'superseded') return LIFECYCLE.SUPERSEDED;
  const today = new Date().toISOString().slice(0, 10);
  if (cred?.expires_at && cred.expires_at < today) return LIFECYCLE.EXPIRED;
  if (cred?.expires_at && new Date(cred.expires_at).getTime() - Date.now() < 30 * 86400000) {
    return LIFECYCLE.EXPIRING_SOON;
  }
  return LIFECYCLE.ACTIVE;
}

// Integrity level from a fresh verifyCredentialAnchor result (preferred) or the
// persisted chain_check / anchor_status. NEVER upgrades an unavailable check.
export async function integrityFrom(cred: any, integrity?: any | null): Promise<string> {
  const i = integrity || cred?.chain_check || null;
  if (i?.status === 'confirmed') {
    try {
      const hash = await computeCredentialHash(polygonCredentialHashFields(cred));
      if (isTrustedChainCheck(cred, i, hash)) return INTEGRITY_STATUS.CONFIRMED;
    } catch { /* hashing failure is never confirmation */ }
  }
  if (i?.status === 'hash_mismatch' || i?.status === 'anchor_invalid') return INTEGRITY_STATUS.FAILED;
  // chain_unavailable / pending / unknown → fall through to the anchor lock state.
  const anchor = cred?.anchor_status || cred?.blockchain?.status;
  if (anchor === 'failed') return INTEGRITY_STATUS.FAILED;
  if (anchor === 'confirmed') return INTEGRITY_STATUS.PENDING; // anchored but no fresh hash check yet
  if (anchor === 'processing') return INTEGRITY_STATUS.PENDING;
  return INTEGRITY_STATUS.NOT_ANCHORED;
}

function organisationAuthorityStatus(org?: any | null): string {
  if (!org) return ORG_AUTHORITY.NONE;
  if (org.status === 'verified') return ORG_AUTHORITY.ORGANISATION_VERIFIED;
  if (org.status === 'pending') return ORG_AUTHORITY.CLAIMED;
  // rejected / suspended → no active authority.
  return ORG_AUTHORITY.NONE;
}

function evidenceStatusFrom(ach: any, signatures: any[], vr?: any | null): string {
  const evidence = Array.isArray(ach?.evidence) ? ach.evidence : [];
  const hasEvidence = evidence.some((e: any) => e?.url);
  if (!hasEvidence) return EVIDENCE_STATUS.NONE;
  const reviewed =
    EVIDENCE_REVIEW_METHODS.has(vr?.decision_method) ||
    signatures.some((s: any) => EVIDENCE_REVIEW_METHODS.has(s?.verification_method)) ||
    !!vr?.status && ['approved'].includes(vr.status);
  return reviewed ? EVIDENCE_STATUS.REVIEWED : EVIDENCE_STATUS.PROVIDED;
}

// ============================================================================
// calculateCredentialTrust — full layered trust for an ISSUED credential.
// svc: a service-role base44 client. cred: the Credential record. opts.integrity
// is an optional fresh verifyCredentialAnchor result to avoid a second RPC.
// ============================================================================
export async function calculateCredentialTrust(svc: any, cred: any, opts: { integrity?: any | null } = {}) {
  const reasons: string[] = [];

  // Parallel load of every authoritative record the calculation needs.
  const [achRows, vrRows, sigRows, orgRows] = await Promise.all([
    cred?.achievement_id ? svc.entities.Achievement.filter({ id: cred.achievement_id }).catch(() => []) : Promise.resolve([]),
    cred?.verification_request_id ? svc.entities.VerificationRequest.filter({ id: cred.verification_request_id }).catch(() => []) : Promise.resolve([]),
    cred?.verification_request_id ? svc.entities.VerificationSignature.filter({ request_id: cred.verification_request_id }).catch(() => []) : Promise.resolve([]),
    cred?.org_id ? svc.entities.IssuerOrganisation.filter({ id: cred.org_id }).catch(() => []) : Promise.resolve([]),
  ]);

  const ach = achRows?.[0] || null;
  const vr = vrRows?.[0] || null;
  const signatures = Array.isArray(sigRows) ? sigRows : [];
  const org = orgRows?.[0] || null;

  const verificationContext = cred?.org_id ? 'organisation' : 'personal';

  const evidenceStatus = evidenceStatusFrom(ach, signatures, vr);

  // Verifier identity — org-flow signatures are authenticated Blockward members
  // (verified identity). Token-flow has no Blockward Verifier (unverified).
  const hasAuthenticatedSignature = signatures.length > 0;
  const verifierIdentityStatus = hasAuthenticatedSignature ? VERIFIER_IDENTITY.VERIFIED : VERIFIER_IDENTITY.UNVERIFIED;

  const orgAuthority = organisationAuthorityStatus(org);

  const requiredSignatures = Math.max(1, Number(vr?.required_signatures || cred?.required_signatures || 1));
  const completedSignatures = Math.max(signatures.length, Number(vr?.signature_count || 0));
  const signatureProgress = {
    required: requiredSignatures,
    completed: completedSignatures,
    complete: completedSignatures >= requiredSignatures,
  };

  const integrityStatus = await integrityFrom(cred, opts.integrity);

  const lifecycle = lifecycleFrom(cred);

  // Self-verification defence (§16) — should never be present (blocked at
  // signing), but the calculation reports it honestly rather than trusting it.
  const holderEmail = low(ach?.holder_email);
  const selfVerified =
    !!holderEmail && signatures.some((s: any) => low(s.verifier_email) === holderEmail);
  if (selfVerified) reasons.push('Self-verification is not independent verification');

  // ── Trust level ──
  let trustLevel = TRUST_LEVELS.PERSON_VERIFIED;

  if (verificationContext === 'organisation') {
    const isBlockwardVerified =
      orgAuthority === ORG_AUTHORITY.ORGANISATION_VERIFIED &&
      signatureProgress.complete &&
      integrityStatus === INTEGRITY_STATUS.CONFIRMED &&
      !selfVerified;

    if (isBlockwardVerified) {
      trustLevel = TRUST_LEVELS.BLOCKWARD_VERIFIED;
    } else {
      trustLevel = TRUST_LEVELS.PERSON_VERIFIED;
      if (orgAuthority !== ORG_AUTHORITY.ORGANISATION_VERIFIED) {
        reasons.push(org
          ? `Issuing organisation is "${org.status}" — not a verified issuer`
          : 'Issuing organisation could not be established');
      }
      if (!signatureProgress.complete) {
        reasons.push(`Signature threshold not met (${completedSignatures} of ${requiredSignatures})`);
      }
      if (integrityStatus !== INTEGRITY_STATUS.CONFIRMED) {
        reasons.push(`Integrity not confirmed (${integrityStatus})`);
      }
    }
  } else {
    // Personal / token-flow: a named human attestation, no organisation authority.
    trustLevel = TRUST_LEVELS.PERSON_VERIFIED;
    reasons.push('Personal verification — no verified organisation authority attached');
  }

  // A revoked / expired credential keeps its authority level; the lifecycle is
  // surfaced separately so the UI can show REVOKED / EXPIRED prominently (§23/24).
  if (lifecycle === LIFECYCLE.REVOKED) reasons.push('Credential has been revoked');
  if (lifecycle === LIFECYCLE.EXPIRED) reasons.push('Credential has expired');

  return {
    trust_level: trustLevel,
    verification_context: verificationContext,
    evidence_status: evidenceStatus,
    verifier_identity_status: verifierIdentityStatus,
    organisation_authority_status: orgAuthority,
    signature_progress: signatureProgress,
    integrity_status: integrityStatus,
    lifecycle_status: lifecycle,
    self_verified: selfVerified,
    reasons,
    organisation: org
      ? { id: org.id, name: org.name, handle: org.handle || null, status: org.status, website: org.website || null }
      : null,
    verifiers: (cred?.verifiers || []).map((v: any) => ({
      name: v.name, title: v.title || null, signed_at: v.signed_at || null,
    })),
    signed_at: cred?.verified_at || vr?.responded_at || null,
  };
}

// ============================================================================
// calculateAchievementTrust — trust for a Holder achievement that has NOT yet
// been issued as a credential. LEVEL 1: "Added to Blockward — not independently
// verified." Once a credential exists, use calculateCredentialTrust instead.
// ============================================================================
export function calculateAchievementTrust(ach: any, vr?: any | null) {
  if (ach?.credential_id || ach?.status === 'verified' || ach?.status === 'blockchain_processing') {
    // An issued/issuing credential — caller should resolve the credential and
    // use calculateCredentialTrust. Conservatively report as added until then.
  }
  const reasons: string[] = ['Holder-added achievement — not independently verified'];
  let evidence = EVIDENCE_STATUS.NONE;
  const ev = Array.isArray(ach?.evidence) ? ach.evidence : [];
  if (ev.some((e: any) => e?.url)) evidence = EVIDENCE_STATUS.PROVIDED;
  const status = ach?.status || 'unverified';
  if (status === 'verification_requested') reasons.push('Verification requested — awaiting response');
  if (status === 'issuer_confirmed') reasons.push('Issuer confirmed — integrity proof pending');
  if (status === 'rejected') reasons.push('Verification was declined');
  return {
    trust_level: TRUST_LEVELS.ADDED_TO_BLOCKWARD,
    evidence_status: evidence,
    verifier_identity_status: VERIFIER_IDENTITY.UNVERIFIED,
    organisation_authority_status: ORG_AUTHORITY.NONE,
    signature_progress: { required: Math.max(1, Number(vr?.required_signatures || 1)), completed: Number(vr?.signature_count || 0), complete: false },
    integrity_status: INTEGRITY_STATUS.NOT_ANCHORED,
    lifecycle_status: LIFECYCLE.ACTIVE,
    self_verified: false,
    reasons,
  };
}

export { isPublicEvidenceUrl };
