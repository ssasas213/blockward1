import { sha256, toUtf8Bytes } from 'ethers';
import { credentialHashPreimage } from '../../base44/shared/credentialHash.ts';
import { isTrustedChainCheck, polygonCredentialHashFields } from '../../base44/shared/chainVerification.ts';

// Recompute from displayed content, never from the stored credential_hash.
// Reuse the server's policy so UI badges cannot revive a rejected legacy cache.
export function hasVerifiedIntegrity(credential) {
  try {
    const hash = sha256(toUtf8Bytes(credentialHashPreimage(polygonCredentialHashFields(credential)))).slice(2);
    return isTrustedChainCheck(credential, credential?.chain_check, hash);
  } catch {
    return false;
  }
}
