// ============================================================================
// guards — pure fail-closed safety checks for the staging broadcast.
//
// Every check is a pure function with no side effects, so they are fully
// testable offline without any network or viem dependency.
// ============================================================================

export type GuardResult =
  | { ok: true }
  | { ok: false; error: string; [key: string]: unknown };

export function validateConfigPresent(
  resolved: { ok: true; config: any } | { ok: false; error: string; missing?: string[] }
): GuardResult {
  if (!resolved.ok) {
    return { ok: false, error: resolved.error, missing: resolved.missing };
  }
  return { ok: true };
}

export function validateSignerAddressMatch(
  derivedAddress: string,
  expectedAddress: string
): GuardResult {
  if (typeof derivedAddress !== 'string' || typeof expectedAddress !== 'string') {
    return { ok: false, error: 'invalid_address' };
  }
  if (derivedAddress.toLowerCase() !== expectedAddress.toLowerCase()) {
    return { ok: false, error: 'signer_address_mismatch' };
  }
  return { ok: true };
}

export function validateChainId(
  liveChainId: number | null,
  expected: number
): GuardResult {
  if (liveChainId === null || liveChainId === undefined) {
    return { ok: false, error: 'chain_id_unavailable', expected };
  }
  if (liveChainId !== expected) {
    return { ok: false, error: 'wrong_chain', live: liveChainId, expected };
  }
  return { ok: true };
}

export function validateRootHex(rootHex: string): GuardResult {
  const normalized = String(rootHex || '').trim().toLowerCase().replace(/^0x/, '');
  if (!/^[0-9a-f]{64}$/.test(normalized)) {
    return { ok: false, error: 'invalid_root' };
  }
  return { ok: true };
}

export function validateMemberCount(memberCount: number): GuardResult {
  if (!Number.isInteger(memberCount) || memberCount < 1) {
    return { ok: false, error: 'invalid_member_count' };
  }
  return { ok: true };
}