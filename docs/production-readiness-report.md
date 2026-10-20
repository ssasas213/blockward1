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

## 8. Polygon mainnet activation audit — 2026-10-20 (read-only)

All ten activation checks verified against the **deployed runtime** — no transactions broadcast, no settings changed, `MAINNET_BROADCAST_ENABLED` remains **false**.

1. **Mainnet RPC** — live probe: chain ID **137**, RPC reachable, latest block readable. ✅
2. **Production signer** — key derives a valid address that **exactly matches** the configured anchor address (server-side match, key value never exposed). `ready_to_sign: true`. ✅
3. **Secrets** — all present and valid (booleans only): `POLYGON_MAINNET_RPC_URL`, `POLYGON_MAINNET_ANCHOR_ADDRESS`, `POLYGON_MAINNET_ISSUER_PRIVATE_KEY`, `POLYGON_MAINNET_CHAIN_ID` (= 137), plus the existing Amoy key untouched. ✅
4. **Merkle batching / queue / independent verification for 137** — the queue resolves the chain config **from each batch's own pinned `network` field**, never the live selector; 61 broadcaster + 113 hardening tests cover 137 paths. ✅
5. **Amoy pinning** — credentials are verified against their persisted `blockchain.chain_id`/`network` (80002), never the issuance selector. Switching to mainnet cannot break historical Amoy verification. ✅
6. **Queue purity** — live scan: **zero** mainnet batches, **zero** mainnet-pinned credentials; Amoy queue holds 1 confirmed batch (E2E test), nothing pending/submitted/failed. Nothing can be rebroadcast or reassigned. ✅
7. **Worker cannot broadcast during activation** — enqueue, anchoring and the scheduled 5-minute worker all call `resolvePolygonTarget()`, which refuses mainnet unless the selector is `polygon_mainnet` AND the kill-switch is literally `'true'`. Both are currently off. ✅
8. **Fee/cost controls (live policy snapshot)** — max fee 200 gwei, per-batch cap $3.00, absolute spend cap $5.00, 8-attempt ceiling with exponential backoff, escalation 60 min / critical 24 h, integration-test ceiling 0.01 POL separate. Confirmed against the deployed endpoint. ✅
9. **Public verification** — supports legacy per-credential calldata anchors and BATCH-PROOF-V1 Merkle batches (inclusion proof, batch root, member count, explorer link), with independent re-verification. ✅
10. **Rollback plan** — set `MAINNET_BROADCAST_ENABLED=false` (blocks all mainnet resolution instantly), set `POLYGON_NETWORK` back to `polygon_amoy` (issuance resumes on testnet); retryable batches (`ANCHOR_FAILED_RETRYABLE`) resume via backoff, permanent failures raise admin alerts without retry; anchored credentials are immutable on-chain and stay verifiable regardless. ✅

**VERDICT: GO** — production infrastructure is fully configured, verified and idle-safe. Nothing broadcasts until an authorised operator flips the two secrets.

### Handoff requirements for the authorised production operator
- Rotate/confirm custody of `POLYGON_MAINNET_ISSUER_PRIVATE_KEY` and verify the funded wallet holds POL for gas (the health check proves the key is valid and matches; it does not probe on-chain balance).
- Activation (in order): 1) set `POLYGON_NETWORK=polygon_mainnet`; 2) set `MAINNET_BROADCAST_ENABLED=true`; 3) watch the 5-minute worker and the internal blockchain dashboard for the first batch.
- Post-activation smoke test with **fictional credentials only**: issue → queue → batch anchor → confirm → verify on the public page and PolygonScan.
- Rollback: flip the kill-switch to `false` first, then the selector to `polygon_amoy`.
- Monitor: internal dashboard alerts (fee holds, escalation/critical, permanent failures) and POL/USD fallback pricing (currently `fallback_estimate` at $0.30).

## 9. Polygon mainnet operational preflight — 2026-10-20 (read-only)

All probes read-only: no transactions, no settings or secret changes, no POL spent.

1. **Anchor wallet balance** — `0x2Af916c4dd18D07080ab4E674F3f05f06a442D7e` holds **243.940543 POL** (live `eth_getBalance`, block 9,584,759). At the worst-case ~0.007 POL/batch (275 gwei), that is runway for ~34,000 batches (~17M credentials at full 500-batches). Closes the balance-confirmation item from the activation audit. ✅
2. **Live gas** — `eth_gasPrice` = **275.4 gwei**; recent base fee ≈ 242 gwei (5-block fee history). Polygon is currently in a fee spike. ⚠️
3. **Policy comparison (live)** — 275.4 gwei market price **exceeds the 200 gwei ceiling**; USD-wise the batch estimate is ~$0.0021 (far inside the $3.00 normal cap and $5.00 absolute cap). The gwei ceiling is the only binding gate. ⚠️
4. **Eligibility right now** — a batch of **1** and a batch of **10** would BOTH be held as `ANCHOR_PENDING_FEE` (`fee_ceiling_gwei`) under current market gas. Both would pass instantly on USD grounds; per-credential cost ~$0.0021 / ~$0.00021 respectively. Holds are self-healing: the 5-minute worker retries automatically once fees fall below the ceiling. ⚠️
5. **Worker / queue / retries / monitoring** — workflow **active**, last 10 runs all `ok` (latest 06:10 UTC); live queue: 0 pending / 0 fee-held / 0 processing / 0 submitted / 0 failed, 1 confirmed Amoy batch; permanent failures 0. ✅
6. **No cross-network contamination** — zero mainnet batches, zero mainnet-pinned credentials; the only queued-batch history is Amoy `ANCHOR_CONFIRMED`. Batches carry their own `network` pin; the worker resolves chain config per batch, so no testnet job can ever be broadcast on mainnet. ✅
7. **Fee-policy sustainability (recommendation, separate approval — NOT applied)** — the 200 gwei ceiling sits below current market (242–275 gwei), so it could hold normal production anchoring for extended periods even though every hold costs fractions of a cent. Recommendation: raise `ANCHOR_MAX_FEE_GWEI` 200 → **500**, leaving both USD caps unchanged — the USD caps then become the primary financial guard (the $3.00 cap itself only binds above ~392 gwei at the $0.30 fallback price, and a 500 gwei batch costs ~$0.0038, ~0.13% of the cap). Until changed, the fee-hold + automatic retry path remains fully safe.
8. **Verdict: GO for operator handoff.** Infrastructure, wallet funding, queue, worker and safety rails are all verified live. Non-blockers/notes: (a) fee-ceiling recommendation above awaits separate approval — with it, activation can anchor immediately; without it, batches simply wait for sub-200 gwei windows; (b) POL/USD price source is `fallback_estimate` ($0.30) — a conservative floor, safe for decisions.

### Requirements for the responsible production operator (unchanged from §8, plus preflight)
- Decide on the `ANCHOR_MAX_FEE_GWEI` 200→500 recommendation (separate approval) or accept fee-window anchoring.
- Activation order: `POLYGON_NETWORK=polygon_mainnet` → `MAINNET_BROADCAST_ENABLED=true` → monitor the 5-minute worker and internal dashboard.
- Smoke test with fictional credentials only; verify on the public page and PolygonScan.
- Rollback: kill-switch `false` first, then selector to `polygon_amoy`.

## 10. Launch sequence status
- ✅ Finish development — anchoring, verification, queue, monitoring complete
- ✅ Pass security checks — 190/190 regression tests green; public API audited; access gating verified
- ⬜ Obtain authorised mainnet activation — kill-switch flip (operator action)
- ⬜ Final testing with fictional credentials on mainnet
- ⬜ Ready for organisations