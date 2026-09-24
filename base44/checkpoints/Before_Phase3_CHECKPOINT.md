# CHECKPOINT — Before Phase 3 (Blockchain Integrity & Public Verification)

Date: 2026-09-24 (Asia/Dubai)

## Snapshot of pre-phase state (audit findings, verified by reading code + live probes)

### Chain & contract
- Network: Sepolia testnet, chainId **11155111** — CONFIRMED LIVE via healthCheckSepolia.
- Contract at `CONTRACT_ADDRESS` has deployed code; issuer `0xC07aF63F5eaa6D67F4a618D00A8a502a61D5fF0e` holds PLATFORM_ROLE (so the deployed contract is the v2-style `issueAward` contract, not just the v1 `mint` ABI).
- Secrets present: SEPOLIA_RPC_URL, CONTRACT_ADDRESS, ISSUER_PRIVATE_KEY, NETWORK (='sepolia'), ADMIN_PRIVATE_KEY, ADMIN_KEY.

### Issuance (canonical)
- **sendToStudentVault** (staff path): admin-only, atomic `approved → delivering` status lock, critical-ops rollback, idempotent re-delivery branch. Creates BlockWard + BlockWardVerificationRegistry keyed by student_record_id.
- **mintRequestCredential** (student-request path, shared/credentialDelivery.ts): idempotent via request status + existing-record checks; same registry/BlockWard pattern.
- **credentialEdits.reviewCorrection**: corrections create a NEW version, snapshot the old anchor into `previous_anchor`, clear top-level anchor fields and set nft_status back to 'pending' — "minted by the existing anchoring pipeline" (which did not exist).

### On-chain state before Phase 3
- On-chain minting is **DORMANT**: issueBlockward / issueBlockwardV2 are marked "do not call from the UI". NOTHING in the canonical flow wrote any chain field. All live credentials have nft_status 'pending' and empty token_id/transaction_hash.
- No content hash existed anywhere.

### Public verification (before)
- publicVerify (no login) returned isVerified purely from registry approval_status; no chain check, no hash. Cases handled: registry found/revoked/is_public=false(403)/not found(404); legacy StudentRecord by verify_id (pending/delivered).
- Verify.jsx rendered green "Verified BlockWard" for institutional verification (signatures — real, completed verification), plus a "Secured" chip shown whenever nft_status === 'minted' WITHOUT any chain confirmation, and a static "Blockchain anchored" check item when any chain fields existed.

## Guarantees to preserve
- Existing /verify/BW-… links (registry) and legacy verify_id links keep working unchanged.
- Test Mode / demo data flows untouched.
- Delivery never depends on chain availability (anchoring is best-effort, post-response).
- Unverified organisations do not anchor (existing product rule; demo/test school is unverified → test data does not mint).
- Never on-chain: names, DOB, emails, evidence, internal ids — hash/commitment + non-sensitive references only.

## Phase 3 plan (implemented after this checkpoint)
1. `base44/shared/credentialHash.ts` — BW-HASH-V1 deterministic commitment (documented field order).
2. `base44/shared/chainAnchor.ts` — idempotent anchoring (atomic claim lock) + full six-point on-chain confirmation with TTL cache; never returns 'confirmed' on RPC failure.
3. Registry entity: +credential_hash, +hash_version, +chain_check, +anchor_claimed_by/at; nft_status + 'anchoring' (transient lock state).
4. Wiring: sendToStudentVault + mintRequestCredential (post-response waitUntil), correction approval re-anchor + cache invalidation; new admin-only `anchorRetry`.
5. publicVerify: explicit statuses valid|invalid|private|pending|revoked|superseded|hash_mismatch + chain object + org_verified.
6. Verify.jsx: status-specific banners/messages; green blockchain badge only on chain.status==='confirmed'; testnet labels everywhere a chain claim appears.