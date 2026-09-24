// ============================================================================
// credentialHash — the deterministic, versioned content commitment for
// verified BlockWard credentials. FORMAT: BW-HASH-V1
//
// WHAT IS COMMITTED (protected/attested achievement content ONLY):
//   FIELD ORDER — fixed, never reorder within a format version:
//     1. verification_id          the permanent public credential id
//     2. version                  the credential version being committed
//     3. achievement_title
//     4. achievement_category
//     5. achievement_description
//     6. date_achieved            ISO date (yyyy-MM-dd)
//
// WHAT IS NEVER INCLUDED: student names, DOB, emails, evidence URLs or any
// other personal data — only the SHA-256 of this preimage goes on-chain, and
// the preimage contains no identifiers beyond the public verification id.
//
// CANONICALISATION (deterministic across runtimes):
//   - null / undefined  → '' (empty string)
//   - numbers           → String(n)
//   - strings           → \r\n and \r collapsed to \n, then trimmed
//   - serialisation     → JSON.stringify of the 6-element array, in the order
//                         above, exactly once
//   - digest            → SHA-256, lowercase hex
//
// Verification recomputes this hash from the CURRENT registry content and
// compares it with the hash committed on-chain at anchor time. Any drift in
// any protected field changes the digest → hash-mismatch, never "verified".
//
// A format change (adding/reordering fields) bumps CREDENTIAL_HASH_VERSION;
// anchors minted under V1 stay verifiable under V1 forever via hash_version.
// ============================================================================
export const CREDENTIAL_HASH_VERSION = 1;

function canonicalValue(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return String(v);
  return String(v).replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

// The preimage string. For transparency/debugging only — the preimage itself
// is never sent to the chain; only its SHA-256 is.
export function credentialHashPreimage(fields) {
  return JSON.stringify([
    canonicalValue(fields.verification_id),
    canonicalValue(fields.version || 1),
    canonicalValue(fields.achievement_title),
    canonicalValue(fields.achievement_category),
    canonicalValue(fields.achievement_description),
    canonicalValue(fields.date_achieved),
  ]);
}

export async function sha256Hex(input) {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// fields: { verification_id, version, achievement_title, achievement_category,
//           achievement_description, date_achieved }
export async function computeCredentialHash(fields) {
  return sha256Hex(credentialHashPreimage(fields));
}