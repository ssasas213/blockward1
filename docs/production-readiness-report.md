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
7. **Fee-policy sustainability (recommendation, separate approval — NOT applied)** — the 200 gwei ceiling sits below current market (242–275 gwei), so it could hold normal production anchoring for extended periods even though every hold costs fractions of a cent.    Recommendation: raise `ANCHOR_MAX_FEE_GWEI` 200 → **500**, leaving both USD caps unchanged. CORRECTED (see §10 item 6): the USD caps bind only at ~378,000 / ~630,000 gwei at the $0.30 fallback price, so under normal conditions the **gwei ceiling is the primary binding control** and the USD caps serve as deep backstops; a 500 gwei batch costs ~$0.0040, ~0.13% of the cap. Until changed, the fee-hold + automatic retry path remains fully safe.
8. **Verdict: GO for operator handoff.** Infrastructure, wallet funding, queue, worker and safety rails are all verified live. Non-blockers/notes: (a) fee-ceiling recommendation above awaits separate approval — with it, activation can anchor immediately; without it, batches simply wait for sub-200 gwei windows; (b) POL/USD price source is `fallback_estimate` ($0.30) — a conservative floor, safe for decisions.

### Requirements for the responsible production operator (unchanged from §8, plus preflight)
- Decide on the `ANCHOR_MAX_FEE_GWEI` 200→500 recommendation (separate approval) or accept fee-window anchoring.
- Activation order: `POLYGON_NETWORK=polygon_mainnet` → `MAINNET_BROADCAST_ENABLED=true` → monitor the 5-minute worker and internal dashboard.
- Smoke test with fictional credentials only; verify on the public page and PolygonScan.
- Rollback: kill-switch `false` first, then selector to `polygon_amoy`.

## 10. Final pre-activation check — 2026-10-20 06:15 UTC (read-only)

1. **Block discrepancy resolved** — the live RPC now returns block **95,847,711** (hex `0x5b6851f`), timestamp **06:15:35 UTC**. The earlier preflight figure of 9,584,759 was a **decimal transcription error in the report itself** (95,847,711 ÷ 10); the ~94.9M figure from the first audit is consistent with chain height ~1.7 days earlier. **The RPC was never stale — the earlier report misstated the number.** Growth of ~152 blocks in 4 min (≈2.05 s/block) matches Polygon PoS cadence; synchronized.
2. **RPC & chain ID** — `eth_chainId` = `0x89` (**137**), latest block header readable and fresh. ✅
3. **Wallet** — **243.940543 POL** at `0x2Af9…2D7e`; signer key valid, derived address **matches** the configured anchor (`ready_to_sign: true`). Secrets never exposed. ✅
4. **Gas conditions** — gas price **287.2 gwei**; base fee ≈ 260 gwei, priority fee p50 ≈ 32 gwei (one 138.6 gwei outlier). Elevated but stable. Fee gate = market gasPrice × 1.25 headroom, so the effective gate at the 200 gwei ceiling is ~360 gwei — currently holding.
5. **EIP-1559 handling — correct.** Type-2 transactions with `maxFeePerGas` + `maxPriorityFeePerGas ≤ maxFeePerGas`, plan validation enforces the relationship, and the post-broadcast receipt check verifies actual paid fee ≤ plan ceiling (hardening tests cover ceiling rejection, invalid fee relationship, zero-fee cases).
6. **Cost table** (26,450 gas units conservative worst case; fallback $0.30 POL):

| Ceiling | Fee (POL) | Fee (USD) | /1 cred | /10 | /100 | /1,000 (2 batches) |
|---|---|---|---|---|---|---|
| 200 gwei | 0.00529 | $0.00159 | $0.00159 | $0.000159 | $0.0000159 | $0.0000032 |
| 300 gwei | 0.00794 | $0.00238 | $0.00238 | $0.000238 | $0.0000238 | $0.0000048 |
| 400 gwei | 0.01058 | $0.00317 | $0.00317 | $0.000317 | $0.0000317 | $0.0000063 |
| 500 gwei | 0.01323 | $0.00397 | $0.00397 | $0.000397 | $0.0000397 | $0.0000079 |

   **CORRECTED — USD-cap binding points (independently re-verified)** — the earlier figures (~378/~630 gwei) were wrong by a factor of 1,000. At 26,450 gas units and $0.30/POL: a **500 gwei** max fee costs 0.013225 POL ≈ **$0.00397/batch**; the $3.00 cap becomes binding at **~378,072 gwei** and the $5.00 absolute cap at **~630,120 gwei** (checked: 378 gwei → $0.0030; 378,072 gwei → $3.00). Under all realistic conditions the **gwei ceiling is the primary binding control**; the USD caps function as backstops against only pathological fee environments (and as the escalation force-attempt bound). The absolute worst automatic attempt (60,000 gas limit × 500 gwei) = 0.03 POL = **$0.009** — still 0.3% of the normal cap. USD caps remain adequate as backstops precisely because the gwei ceiling makes them unreachable in normal operation.
7. **Recommended production fee policy (separate approval, not applied)** — `ANCHOR_MAX_FEE_GWEI` **200 → 500**, USD caps unchanged. With the ×1.25 gate headroom this allows anchoring at market gas up to 400 gwei (today: 287 × 1.25 = 359 gwei passes) while keeping the ceiling itself as the primary financial guard; the USD caps bind only at ~378k/~630k gwei, far beyond any observed Polygon fee environment. Maximum automatic spend per attempt stays ≤ $0.009; fee-held batches stay preserved and retry automatically, never dropped.
8. **Fee-ceiling semantics — 500 gwei is a MAXIMUM, not a price.** Type-2 (EIP-1559) transactions pay `baseFee + priorityTip` at inclusion, always ≤ `maxFeePerGas`; the 500 gwei figure budgets the worst case (feeDecision compares the ×1.25-headroomed market estimate against the ceiling). Typical cost at current market is ~$0.002–0.004; if fees fall, the actual payment falls too — the ceiling only caps how high an attempt may go.
9. **Automated processing verified** — worker active, last 10 runs all `ok` (≈5-min cadence); 0 pending/fee-held/processing/submitted/failed jobs, 0 permanent failures; small (2-member) batch confirmed end-to-end on Amoy with independent inclusion proofs; unfilled batches process at the 15-minute target; fee-held batches retry every 5 min; idempotent claims/backoff proven by the 190-test suite; confirmation requires receipt verification + Merkle proof distribution; Amoy/Sepolia history verifies against each credential's pinned network/chain ID.
10. **Safety state (flags checked, values not exposed)** — `MAINNET_BROADCAST_ENABLED` is **false**; `POLYGON_NETWORK` is **not** mainnet (issuance on Amoy); **no mainnet batches or transactions exist**; integration-test ceiling **0.01 POL unchanged**; no duplicate/misassigned queue jobs.
11. **Verdict: GO for authorised mainnet activation.** Blockers: none. Awaiting the separate fee-policy approval (recommended) and the operator's activation sequence.
12. **Correction record (2026-10-20)** — the fee-policy analysis in §9 item 7 and §10 item 6 originally overstated the USD-cap binding points by a factor of 1,000 (~392/~378/~630 gwei). Independently re-verified: at 26,450 gas and $0.30/POL, the $3.00 normal cap binds at **~378,072 gwei** and the $5.00 absolute cap at **~630,120 gwei**; a 500 gwei ceiling batch costs **$0.00397**. The gwei ceiling — not the USD caps — is the primary binding control under all realistic conditions. All other figures and the GO verdict are unchanged.

## 12. Production-operator approval checklist (sign-off before activation)

1. **Fee-policy decision — DECIDED 2026-10-20:** `ANCHOR_MAX_FEE_GWEI` stays 200 (the 500 gwei proposal was declined by the authorised approver). Nothing to set at activation.
2. **Mainnet activation (authorised operator only)** — in order: `POLYGON_NETWORK=polygon_mainnet` → `MAINNET_BROADCAST_ENABLED=true` → confirm the 5-minute worker begins claiming mainnet batches → watch the internal dashboard and admin alert emails.
3. **Fictional-credential smoke test** — issue 1–2 fictional (clearly-labelled) verified credentials; let them enter the Merkle batch queue; confirm the batch anchors within the batching window and fee policy.
4. **Independent on-chain proof verification** — for each smoke credential: open the public /verify page (BLOCKWARD VERIFIED), confirm the BATCH-PROOF-V1 Merkle proof recomputes to the committed root, and cross-check the transaction root, block, network and chain ID (137) on PolygonScan directly — independent of Blockward's own API.
5. **Rollback drill (know it cold before launch)** — step 1: set `MAINNET_BROADCAST_ENABLED=false` (halts all mainnet broadcasting instantly; queued credentials preserved). Step 2 if needed: `POLYGON_NETWORK=polygon_amoy` (normal issuance back on testnet). Verify via the worker stopping all mainnet batch activity.

## 13. LIVE conditions — Blockward is officially LIVE on Polygon mainnet when ALL of these hold:

- `POLYGON_NETWORK=polygon_mainnet` AND `MAINNET_BROADCAST_ENABLED=true` (both set by the authorised operator).
- At least one production (non-fictional) credential from a real verified issuer organisation has passed the full pipeline: issuer confirmation → BW-HASH-V1 commitment → Merkle batch → batch root anchored in a confirmed Polygon mainnet transaction (chain ID 137, receipt verified).
- The credential's public /verify page shows BLOCKWARD VERIFIED, with the Merkle inclusion proof independently recomputing to the on-chain root (also confirmed on PolygonScan).
- Queue state is healthy: no `ANCHOR_FAILED_PERMANENT` batches, no unacknowledged `anchor_critical` alerts.
- The smoke test (checklist item 3–4) has passed and the rollback drill (item 5) has been rehearsed.
- External organisations may be onboarded only after these conditions are met.

## 15. Phase-1 operator handoff — 2026-10-20 06:22 UTC (live, read-only)

- **Live activation state (new read-only `activationSafetyState` probe, internal-admin only):**
  `kill_switch_enabled: false` · `selector: polygon_amoy` · `effective_issuance_network: polygon_amoy` · `mainnet_broadcast_possible: false` · state `TESTNET_MODE`. **No mainnet transaction is possible until the operator's authorised activation.**
- **Production signer/infra re-verified live:** RPC reachable, chain ID 137, latest block readable, signer key derives the address matching `POLYGON_MAINNET_ANCHOR_ADDRESS` (0x2Af9…2D7e), `ready_to_sign: true`. Signing stays exclusively on the secure backend; keys never leave it.
- **Queue safety:** zero open batches (0 pending / fee-held / processing / submitted), zero retryable or permanent failures; the single confirmed batch `AB-E2ETST` is pinned `polygon_amoy` (chain 80002) and is never reassigned — network pinning resolves every credential's verification from its persisted `chain_id`. Historical Sepolia records likewise verify on their pinned chain. Nothing existing can be broadcast to mainnet by the activation.
- **Worker:** scheduled workflow running every ~5 minutes, last 10+ runs all `ok`.
- **All regression suites re-run green** (queue, hardening, broadcaster).
- **Fee policy — DECIDED 2026-10-20 (authorised approval):** the proposed `ANCHOR_MAX_FEE_GWEI` 200 → 500 change is **DECLINED — the ceiling stays 200 gwei**. USD caps $3.00/$5.00 unchanged. Batches anchor automatically whenever market gas is below 200 gwei; fee-held batches are preserved and retry — never dropped. No spending-limit increase is authorised or planned.
- **Operator activation sequence (authorised production-wallet operator ONLY — no one else may sign or spend):** ① `POLYGON_NETWORK=polygon_mainnet` → ② `MAINNET_BROADCAST_ENABLED=true` → ③ confirm the worker claims a mainnet batch → ④ run the fictional-credential smoke test (§12 checklist). `ANCHOR_MAX_FEE_GWEI` is NOT changed at activation — 200 gwei stands.
- **Rollback (rehearsed, always available):** `MAINNET_BROADCAST_ENABLED=false` halts all mainnet broadcasting instantly; queued credentials are preserved, never dropped. `POLYGON_NETWORK=polygon_amoy` restores normal testnet issuance.
- **Monitoring:** internal blockchain dashboard + `anchor_*` admin alert emails (escalation 60 min, critical 24 h, fee-hold dedupe) all active.

**Status at handoff: NOT ACTIVATED — awaiting (1) fee-policy approval and (2) the authorised operator's activation sequence.**

## 16. Launch sequence status
- ✅ Finish development — anchoring, verification, queue, monitoring complete
- ✅ Pass security checks — 190/190 regression tests green; public API audited; access gating verified
- ⬜ Obtain authorised mainnet activation — kill-switch flip (operator action)
- ⬜ Final testing with fictional credentials on mainnet
- ⬜ Ready for organisations