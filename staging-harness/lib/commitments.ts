// ============================================================================
// commitments — synthetic BW-HASH-V1 leaves + batch payload builders.
//
// Imports the PRODUCTION pure crypto modules (anchorMerkle.ts, credentialHash.ts)
// which use WebCrypto only — zero network, zero secret access. This reuses the
// exact same hashing and Merkle logic the production pipeline uses.
//
// Synthetic credentials use the BW-HARNESS- prefix (never BW-) to prevent any
// collision with production credential IDs.
// ============================================================================

import { computeCredentialHash, CREDENTIAL_HASH_VERSION } from '../../base44/shared/credentialHash.ts';
import { merkleRoot, merkleProof, verifyMerkleProof } from '../../base44/shared/anchorMerkle.ts';

export interface SyntheticCredential {
  verification_id: string;
  version: number;
  achievement_title: string;
  achievement_category: string;
  achievement_description: string;
  date_achieved: string;
  leaf: string;
}

export const HARNESS_PREFIX = 'BW-HARNESS-';

export function generateSyntheticLeaf(index: number): Promise<SyntheticCredential> {
  const id = `${HARNESS_PREFIX}${String(index + 1).padStart(6, '0')}`;
  const cred: SyntheticCredential = {
    verification_id: id,
    version: 1,
    achievement_title: `Harness synthetic commitment #${index + 1}`,
    achievement_category: 'certification',
    achievement_description: `Synthetic BW-HASH-V1 leaf for harness test ${index + 1}`,
    date_achieved: '2026-01-01',
    leaf: '',
  };
  return computeCredentialHash({
    verification_id: cred.verification_id,
    version: cred.version,
    achievement_title: cred.achievement_title,
    achievement_category: cred.achievement_category,
    achievement_description: cred.achievement_description,
    date_achieved: cred.date_achieved,
  }).then((leaf) => ({ ...cred, leaf }));
}

export async function generateSyntheticLeaves(count: number): Promise<SyntheticCredential[]> {
  const leaves: SyntheticCredential[] = [];
  for (let i = 0; i < count; i++) {
    leaves.push(await generateSyntheticLeaf(i));
  }
  return leaves;
}

export function buildBatchPayload(rootHex: string, memberCount: number): string {
  return JSON.stringify({
    v: 1,
    t: 'blockward-batch',
    hv: CREDENTIAL_HASH_VERSION,
    n: memberCount,
    r: rootHex,
  });
}

export function parseBatchPayload(input: string): { root: string; memberCount: number } | null {
  try {
    const meta = JSON.parse(input);
    if (meta?.v !== 1 || meta?.t !== 'blockward-batch' || meta?.hv !== CREDENTIAL_HASH_VERSION
      || !Number.isInteger(meta?.n) || meta.n < 1
      || typeof meta.r !== 'string' || !/^[0-9a-f]{64}$/.test(meta.r)) return null;
    return { root: meta.r, memberCount: meta.n };
  } catch {
    return null;
  }
}

export async function buildBatchTree(leaves: SyntheticCredential[]) {
  const leafHashes = leaves.map((l) => l.leaf);
  const root = await merkleRoot(leafHashes);
  const proofs = await Promise.all(
    leaves.map((_, i) => merkleProof(leafHashes, i))
  );
  return { root, proofs, leafHashes };
}

export async function verifyBatchProof(
  leafHex: string,
  proof: { position: 'left' | 'right'; hash: string }[],
  rootHex: string
): Promise<boolean> {
  return verifyMerkleProof(leafHex, proof, rootHex);
}