import { sha256, toUtf8Bytes } from 'ethers';
import { credentialHashPreimage } from '../../base44/shared/credentialHash.ts';
import { isTrustedChainCheck, isTrustedBatchCheck, polygonCredentialHashFields } from '../../base44/shared/chainVerification.ts';

// Recompute from displayed content, never from the stored credential_hash.
// Reuse the server's policy so UI badges cannot revive a rejected legacy cache.
// BATCH-PROOF-V1: batch-anchored credentials (anchor_mode batch_calldata) are
// trusted through isTrustedBatchCheck — the same policy the server's
// credentialTrust.ts uses. Before this fix, batch-anchored credentials could
// never pass the client check, producing the contradictory
// "Blockchain secured / Integrity verification required" badge.
export function hasVerifiedIntegrity(credential) {
  try {
    const hash = sha256(toUtf8Bytes(credentialHashPreimage(polygonCredentialHashFields(credential)))).slice(2);
    const mode = credential?.blockchain?.anchor_mode || credential?.chain_check?.anchor_mode;
    if (mode === 'batch_calldata') return isTrustedBatchCheck(credential, credential?.chain_check, hash);
    return isTrustedChainCheck(credential, credential?.chain_check, hash);
  } catch {
    return false;
  }
}

// True when a confirmed-anchored credential's cached integrity check is stale
// or missing (TTL 10 min) — i.e. a fresh server verification (publicVerifyData)
// would legitimately turn the badge green. A recently checked, non-confirmed
// result is NOT stale: re-verifying it would loop forever.
export function integrityCheckIsStale(credential, now = Date.now()) {
  try {
    if (!credential?.chain_check || typeof credential.chain_check.checked_at !== 'string') return true;
    const age = now - Date.parse(credential.chain_check.checked_at);
    return !Number.isFinite(age) || age >= 10 * 60 * 1000;
  } catch {
    return false;
  }
}