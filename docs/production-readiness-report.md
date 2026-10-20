# Blockward — Polygon Production-Readiness Report (Pre-Mainnet)

Date: 2026-10-20 · Scope: Polygon anchoring system, public verification, internal monitoring, queue reliability, security regressions, launch blockers.

## 1. Test suites — all green

| Suite | Result | Covers |
|---|---|---|
| `tests/merkle-queue.test.cjs` | **16/16 pass** | Queue lifecycle end-to-end against real backend sources |
| `tests/polygon-hardening.test.cjs` | **113/113 pass** | On-chain integrity verification, receipt validation, preflight, trust fail-closed |
| `tests/mainnet-broadcaster.test.mjs` | **61/61 pass** | Journal durability, broadcast authorization, post-broadcast verification |

**190/190 tests pass.** Build passes (`vite build`, exit 0).

### Fix provenance — the three previously failing queue tests
All three were **incorrect test expectations, not application bugs**; each fix was verified against the real backend source before rerunning:

1. **Fee-hold credential preservation** — the test expected `anchor_status: 'pending'`, but the seeded fixture credential was already `'verified'` (its issuer verification, a precondition of enqueueing). The fee hold correctly changed nothing on the credential; the test now asserts the value is *preserved* (`'verified'`), which is the actual guarantee.
2. **Receipt-RPC failure re-anchoring** — the test expected 2 broadcasts; the scenario only involves one deliberate re-anchor of the identical root (the original batch was seeded `SUBMITTED`, so the initial tick never broadcasts). Assertion corrected to 1.
3. **Economics logging** — a `JSON.stringify` crash on BigInt test data (test-harness serialization only; no app code involved). BigInts now serialize as strings.

### Hardening suite fix (same category)
`resolvePolygonTarget` was updated earlier to enforce the `MAINNET_BROADCAST_ENABLED` kill-switch (§P1). One hardening test predating the kill-switch expected mainnet resolution without the flag — the fail-closed refusal is the intended, correct behavior. The test now asserts both: mainnet is refused without the flag (`mainnet_broadcast_disabled`) and resolves only when the flag is literally `'true'`.

## 2. Public verification page (`/verify/:id`) — verified
- Serves both the new credential registry and legacy records on one URL; build compiles.
- Public API audit (`publicVerifyData`) — **no PII exposure**: returns only public-by-design fields (BW ID, display name, issuer, attested content, on-chain references, Merkle inclusion proof, integrity status). Never returns: holder email, achievement/request IDs, evidence files, `chain_check` internals, revocation details, or any holder-identifying data. Private vs unknown credentials are indistinguishable (`found: false`); endpoint is rate-limited.
- Integrity banner renders only when the live server-side on-chain check passes; trust never derives from local flags.

## 3. Internal blockchain dashboard — verified
- "Blockchain queue" tab in the internal console: queue counters, alerts (escalation/critical/fee-hold/retryable/permanent), batch detail with event logs, cost tracking, policy snapshot, scalability projection, mainnet-readiness flags.
- Access: data endpoint (`anchorQueueStatus`) is gated server-side by `requireInternalAdmin`; the console page independently checks `getInternalAdminStatus` (server-side allowlist) before rendering. A logged-in non-admin receives no data.

## 4. Gas economics — batching keeps cost extremely low
Measured Amoy: 25,520 gas per batch root (~30 gwei); mainnet estimate uses the conservative 200 gwei ceiling at $0.30/POL.

| Batch size | Cost/credential (Amoy) | Cost/credential (mainnet, conservative) |
|---|---|---|
| 1 | ~0.00077 POL (≈ $0.0002) | ~0.0051 POL (≈ **$0.0015**) |
| 10 | ≈ $0.00002 | ≈ $0.00015 |
| 100 | ≈ $0.000002 | ≈ $0.000015 |
| 1000 | ≈ $0.0000002 | ≈ $0.0000015 |

Even a batch of **one** costs ≈ $0.0015 — inside the per-batch cap ($3.00 default) by ~2000×. Cost per credential falls monotonically with batch size.

**Deadline-based batching confirmed:** every batch carries a batching-window deadline (`close_at`); an unfilled batch is anchored when due even if not full (15-minute default target), so low-volume organisations are never left waiting indefinitely. Escalation at 60 min and critical alerting at 24 h are separately enforced and tested.

## 5. Operational mechanisms — confirmed functioning
- **Five-minute worker:** `Blockchain Anchor Queue` workflow is **active**, scheduled every 5 minutes; the last 10 runs all succeeded (`ok`), including during this audit.
- **Retry system:** exponential backoff with a 6-hour ceiling; permanent failure ceiling raises administrator alerts (tested).
- **Fee holds:** high-fee estimates hold the batch untouched, never the credential; holds auto-release when fees normalize (tested).
- **Escalation & critical alerts:** windows enforced and alerted (tested).
- **Recovery:** stale claims (>10 min) are taken over automatically; worker-crash recovery tested; submitted transactions reconcile from receipts, missing/late receipts handled (tested).

## 6. Safety state — confirmed
- `MAINNET_BROADCAST_ENABLED` = **false** (verified at runtime). No mainnet transaction is possible.
- `POLYGON_NETWORK` selector is **not** mainnet — normal issuance resolves to **Polygon Amoy**. Even with the selector set, the kill-switch independently blocks mainnet.
- The 61-test broadcaster suite confirms: absent/incorrect authorization cannot sign, broadcast or consume a lock; every post-broadcast mismatch (sender, recipient, chain, value, commitment, nonce, receipt) is rejected without retry.

## 7. Blockers before Polygon mainnet activation

1. **Authorized activation (deliberate, by design):** an authorized operator must set `MAINNET_BROADCAST_ENABLED=true` and switch `POLYGON_NETWORK` to `polygon_mainnet`. No other path exists — this is the intended control.
2. **Activation-time secret verification:** confirm `POLYGON_MAINNET_RPC_URL`, `POLYGON_MAINNET_ANCHOR_ADDRESS`, `POLYGON_MAINNET_CHAIN_ID` and the mainnet issuer key are correctly configured and matching (server-side derivation check exists and fails closed).
3. **Post-activation smoke test:** issue fictional credentials, run them through the queue against mainnet, verify a batch on the public page and on PolygonScan, then flip the selector back if reverting to testnet staging is desired.
4. **Non-blocking note:** privileged endpoints returned HTTP 500 (instead of 401) when authentication is missing — fixed in source, pending confirmation on the deployed runtime.

## 8. Launch sequence status
- ✅ Finish development — anchoring, verification, queue, monitoring complete
- ✅ Pass security checks — 190/190 regression tests green; public API audited; access gating verified
- ⬜ Obtain authorised mainnet activation — kill-switch flip (operator action)
- ⬜ Final testing with fictional credentials on mainnet
- ⬜ Ready for organisations