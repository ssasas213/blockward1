// Shared, environment-free policy for reusing hardened Polygon calldata checks.
// Only the successful hardened verifier may stamp version 2. A version is not
// an attestation by itself: these records remain service-role-write-only.
export const CHAIN_VERIFICATION_VERSION = 2;
export const CHAIN_VERIFICATION_TTL_MS = 10 * 60 * 1000;

export function polygonCredentialHashFields(cred: any) {
  return {
    verification_id: cred?.bw_id,
    version: cred?.hash_version === 2 ? 2 : 1,
    achievement_title: cred?.title,
    achievement_category: cred?.category,
    achievement_description: cred?.description || '',
    date_achieved: cred?.date_achieved,
  };
}

export function verificationBindings(cred: any) {
  const bc = cred?.blockchain || {};
  return {
    credential_id: cred?.bw_id,
    credential_version: cred?.version ?? 1,
    hash_version: cred?.hash_version ?? 1,
    transaction_hash: bc.transaction_hash,
    anchor_chain_id: bc.chain_id ?? null,
    anchor_network: bc.network ?? null,
    anchor_mode: bc.anchor_mode ?? 'calldata',
    contract_address: bc.contract_address ?? null,
  };
}

export function isTrustedChainCheck(cred: any, check: any, recomputedHash: string, now = Date.now()): boolean {
  if (!check || check.status !== 'confirmed' || check.verification_version !== CHAIN_VERIFICATION_VERSION) return false;
  if ((cred?.anchor_status || cred?.blockchain?.status) !== 'confirmed') return false;
  const bindings = verificationBindings(cred);
  if (typeof bindings.credential_id !== 'string' || !bindings.credential_id
    || bindings.hash_version !== 1 || bindings.anchor_mode !== 'calldata'
    || bindings.contract_address !== null
    || !/^0x[0-9a-fA-F]{64}$/.test(bindings.transaction_hash || '')) return false;
  for (const [key, value] of Object.entries(bindings)) {
    if (check[key] !== value) return false;
  }
  // Preserve the production resolver's historical fallback and chain priority.
  const net = String(bindings.anchor_network || '').toLowerCase();
  const chain = bindings.anchor_chain_id ?? (net === 'polygon' || net === 'polygon_mainnet' ? 137 : 80002);
  if (chain !== 137 && chain !== 80002) return false;
  if (check.chain_id !== chain || check.network !== (chain === 137 ? 'polygon' : 'polygon_amoy')) return false;
  if (typeof check.checked_at !== 'string') return false;
  const age = now - Date.parse(check.checked_at);
  if (!Number.isFinite(age) || age < 0 || age >= CHAIN_VERIFICATION_TTL_MS) return false;
  return /^[0-9a-f]{64}$/.test(recomputedHash)
    && check.recomputed_hash === recomputedHash && check.committed_hash === recomputedHash;
}

// ── BATCH-PROOF-V1 trust (additive — the per-credential V2 path is untouched) ──
// A batch-anchored credential is trusted only when the fresh check verified
// the full chain: tx receipt, chain/sender/recipient bindings, on-chain root
// match, AND a Merkle proof over the RECOMPUTED BW-HASH-V1 leaf.
export const BATCH_VERIFICATION_VERSION = 1;

export function isTrustedBatchCheck(cred: any, check: any, recomputedHash: string, now = Date.now()): boolean {
  if (!check || check.status !== 'confirmed' || check.verification_version !== BATCH_VERIFICATION_VERSION) return false;
  if ((cred?.anchor_status || cred?.blockchain?.status) !== 'confirmed') return false;
  const bc = cred?.blockchain || {};
  if ((bc.anchor_mode || '') !== 'batch_calldata') return false;
  if (bc.contract_address != null) return false;
  if (!/^0x[0-9a-fA-F]{64}$/.test(bc.transaction_hash || '')) return false;
  if (!/^[0-9a-f]{64}$/.test(bc.batch_root || '')) return false;
  if (check.batch_root !== bc.batch_root) return false;
  if (check.merkle_leaf_index !== bc.merkle_leaf_index) return false;
  if (check.transaction_hash !== bc.transaction_hash) return false;
  // Preserve the network/chain priority of the per-credential resolver.
  const net = String(bc.network || '').toLowerCase();
  const chain = bc.chain_id ?? (net === 'polygon' || net === 'polygon_mainnet' ? 137 : 80002);
  if (chain !== 137 && chain !== 80002) return false;
  if (check.chain_id !== chain || check.network !== (chain === 137 ? 'polygon' : 'polygon_amoy')) return false;
  if (typeof check.checked_at !== 'string') return false;
  const age = now - Date.parse(check.checked_at);
  if (!Number.isFinite(age) || age < 0 || age >= CHAIN_VERIFICATION_TTL_MS) return false;
  return /^[0-9a-f]{64}$/.test(recomputedHash)
    && check.merkle_leaf === recomputedHash
    && check.committed_hash === check.batch_root
    && check.batch_member_count >= 1;
}