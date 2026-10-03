# Polygon verification cache policy

Only a successful hardened calldata verification issues `verification_version: 2`.
The cache is service-role-write-only; the version is not a client-supplied proof.
Both server trust calculation and UI integrity consumers require the same policy:

- status and current anchor state are confirmed;
- credential ID, revision, supported hash version, transaction hash, stored
  chain/network, anchor mode and contract address match;
- resolved Polygon chain/network match;
- checked_at is valid, not in the future, and less than ten minutes old;
- committed and recomputed hashes equal an independently recomputed hash of the
  current credential content. The stored credential_hash is never authoritative.

A supplied fresh failure takes precedence over a previous successful cache.
The explicit public verification path always runs fresh RPC verification.
The cached-only trust endpoint does not call RPC: missing, legacy, stale or
invalid confirmations remain pending/non-confirmed until fresh verification.
Late writes from an older content/anchor snapshot cannot confer trust on a
newer snapshot because consumers recheck the bindings and content digest.

## Migration

No bulk data edit or environment change is needed. Existing unversioned checks
are rejected immediately by the new consumers, including UI status/timeline
consumers. A successful fresh calldata check replaces them with version 2.
Never backfill the version onto old results without performing all checks.
The Credential entity schema must be deployed with the functions so all binding
fields survive persistence. Unknown/dropped fields fail closed.

Contract-mode checks are not the hardened calldata verifier and do not receive
version 2. They may report an anchor observation, but cannot confer confirmed
credential trust under this policy until independently hardened.

## Historical signers

Amoy verification still requires the address derived from the configured issuer
key; mainnet requires its configured expected public anchoring address. There is
no arbitrary-sender fallback. Historical verification across key/address rotation
requires an explicit trusted historical signer policy (for example, approved
addresses with network and validity intervals). This change does not implement
that policy. Existing valid caches can remain reusable for their ten-minute TTL;
fresh verification always applies the current configured signer requirement.

No broadcaster is added. Issuance network selection and mainnet preflight fee
limits are unchanged.
