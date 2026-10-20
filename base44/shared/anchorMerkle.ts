// ============================================================================
// anchorMerkle — SHA-256 Merkle tree over BW-HASH-V1 credential commitments.
// Dependency-free (WebCrypto only) so the SAME code runs in Deno backend
// functions and in Node tests, and so proofs can be re-verified anywhere.
//
// FORMAT: BATCH-PROOF-V1 (versioned batch-proof support, additive to BW-HASH-V1)
//   - Leaf i            = the credential's BW-HASH-V1 SHA-256 digest (32 bytes).
//                         BW-HASH-V1 is PRESERVED: the leaf IS the existing
//                         per-credential commitment — batching adds inclusion
//                         proofs around it, it never re-hashes credentials.
//   - Internal node     = SHA-256(left32 || right32).
//   - Odd node count    = the last node is paired with itself (deterministic).
//   - Single-member     = the leaf itself is the root (standard degenerate tree)
//                         — a batch of ONE is fully supported.
//   - Proof             = ordered [{position: 'left'|'right', hash: 64-hex}]
//                         siblings from the leaf to the root.
// ============================================================================

function hexToBytes(hex: string): Uint8Array {
  if (typeof hex !== 'string' || !/^(?:[0-9a-fA-F]{2})+$/.test(hex)) throw new Error('invalid hex');
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256Concat(aHex: string, bHex: string): Promise<string> {
  const merged = new Uint8Array(hexToBytes(aHex).length + hexToBytes(bHex).length);
  merged.set(hexToBytes(aHex), 0);
  merged.set(hexToBytes(bHex), hexToBytes(aHex).length);
  const digest = await crypto.subtle.digest('SHA-256', merged);
  return bytesToHex(new Uint8Array(digest));
}

// levels[0] = leaves, last entry = [root]. Leaves are 64-hex lowercase.
export async function buildMerkleLevels(leaves: string[]): Promise<string[][]> {
  if (!Array.isArray(leaves) || leaves.length === 0) throw new Error('no_leaves');
  for (const l of leaves) if (!/^[0-9a-f]{64}$/.test(l)) throw new Error('invalid_leaf');
  const levels: string[][] = [[...leaves.map((l) => l.toLowerCase())]];
  let current = levels[0];
  while (current.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < current.length; i += 2) {
      const left = current[i];
      const right = i + 1 < current.length ? current[i + 1] : left; // odd → pair with itself
      next.push(await sha256Concat(left, right));
    }
    levels.push(next);
    current = next;
  }
  return levels;
}

export async function merkleRoot(leaves: string[]): Promise<string> {
  const levels = await buildMerkleLevels(leaves);
  return levels[levels.length - 1][0];
}

// Inclusion proof for leaf `index` — siblings ordered leaf → root.
export async function merkleProof(leaves: string[], index: number): Promise<{ position: 'left' | 'right'; hash: string }[]> {
  if (!Number.isInteger(index) || index < 0 || index >= leaves.length) throw new Error('bad_index');
  const levels = await buildMerkleLevels(leaves);
  const proof: { position: 'left' | 'right'; hash: string }[] = [];
  let i = index;
  for (let level = 0; level < levels.length - 1; level++) {
    const nodes = levels[level];
    const isRight = i % 2 === 1;
    const siblingIndex = isRight ? i - 1 : (i + 1 < nodes.length ? i + 1 : i); // odd tail pairs with itself
    proof.push({ position: isRight ? 'right' : 'left', hash: nodes[siblingIndex] });
    i = Math.floor(i / 2);
  }
  return proof;
}

// Independent verification — the exact algorithm a third party re-runs.
export async function verifyMerkleProof(leafHex: string, proof: { position: string; hash: string }[], rootHex: string): Promise<boolean> {
  if (!/^[0-9a-f]{64}$/.test(leafHex) || !/^[0-9a-f]{64}$/.test(rootHex)) return false;
  if (!Array.isArray(proof)) return false;
  try {
    let node = leafHex.toLowerCase();
    for (const step of proof) {
      if (!step || (step.position !== 'left' && step.position !== 'right') || !/^[0-9a-f]{64}$/.test(step.hash || '')) return false;
      node = step.position === 'left' ? await sha256Concat(step.hash, node) : await sha256Concat(node, step.hash);
    }
    return node === rootHex.toLowerCase();
  } catch {
    return false;
  }
}