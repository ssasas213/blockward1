# BLOCKWARD — FINAL MAINNET PRODUCTION READINESS REVIEW
**Date:** 2026-10-21 · **Review Type:** Read-only, no production changes

---

## 1. Fee-Gate Policy Audit

### How `eth_gasPrice`, the 1.25× multiplier, and `ANCHOR_MAX_FEE_GWEI` interact

Confirmed from `anchorGasPolicy.ts` (`feeDecision`) and `gasFeeMonitor.ts` (`captureGasObservation`):

1. The worker reads `eth_gasPrice` via `pub.getGasPrice()`.
2. A **1.25× safety multiplier** is applied: `proposedWei = (gasPriceWei * 125n) / 100n`.
3. The fee gate checks three ceilings **in order**:
   - **Gas-price ceiling:** `proposedWei > gweiToWeiPerGas(maxFeeGwei)` → `fee_ceiling_gwei` (BLOCKED)
   - **Absolute cost cap:** `estUsd > $5.00` → `absolute_cost_cap` (BLOCKED)
   - **Per-batch budget:** `estUsd > $3.00` → `batch_budget_exceeded` (BLOCKED)
4. If all pass → `allowed: true` (broadcast proceeds).

The ceiling compares the **proposed max** (gas × 1.25), **not** the raw `eth_gasPrice`.

### Hypothetical ceiling simulation (live observations, last 10 ticks)

Observed mainnet gas: **276.7–282.6 Gwei** · Proposed max (×1.25): **345.9–353.3 Gwei**

| Ceiling (Gwei) | Decision | Reason |
|---|---|---|
| 200 (current live) | **BLOCKED** | `fee_ceiling_gwei` (348 > 200) |
| 300 | **BLOCKED** | `fee_ceiling_gwei` (348 > 300) |
| 400 | **ALLOWED** | `null` (348 ≤ 400) |
| 500 | **ALLOWED** | `null` |
| 600 | **ALLOWED** | `null` |

### Cost per batch and per credential

Gas used: **25,861 units** (constant — Merkle-root commitment only).
POL price: **$0.30** (coingecko).

| Ceiling (Gwei) | Fee (POL) | Fee (USD) | Per credential (500-batch) | $3 budget headroom |
|---|---|---|---|---|
| 200 | 0.00517 | $0.00155 | $0.0000031 | 1,932× |
| 300 | 0.00776 | $0.00233 | $0.0000047 | 1,288× |
| 400 | 0.01034 | $0.00310 | $0.0000062 | 967× |
| 500 | 0.01293 | $0.00388 | $0.0000078 | 773× |
| 600 | 0.01552 | $0.00466 | $0.0000093 | 644× |

$3 per-batch budget break-even: **386,700 Gwei**. $5 absolute cap break-even: **644,500 Gwei**. Neither is ever reached at realistic gas prices.

### Would 300 Gwei unblock?

**No.** The 1.25× multiplier raises the proposed max to ~348 Gwei at the current ~278 Gwei gas. 348 > 300, so the fee gate still blocks. The previously recommended 300 Gwei ceiling is insufficient.

### Recommended fee-policy range

**350–400 Gwei** (operator-approved). 350 is the absolute minimum to unblock at current gas (348 ≤ 350, no margin). 400 provides a safety margin for gas fluctuations up to ~320 Gwei observed. Costs remain negligible: $0.0031/batch at 400 Gwei — 967× under the $3 budget.

**$3 normal and $5 absolute budgets are preserved unchanged.**

---

## 2. Immediate Receipt Reconciliation Audit

### Complete flow verified

Issuer approval → `issueCredential` → `enqueueCredentialForAnchoring` (opens/joins batch) → entity-triggered workflow → 3s coalesce → `processAnchorQueue` (force-flush) → `anchorBatchRoot` (broadcast + 12s receipt wait) → `finalizeBatch` (proofs + verified) → holder notified.

| Requirement | Status | Evidence |
|---|---|---|
| Workflow uses correct function parameters | **PASS** | `invoke_backend_function` with `processAnchorQueue` + `{ batch_ref: "${.trigger.data.batch_ref}" }` |
| Receipt reconciliation begins promptly | **PASS** | 3s coalesce → flush → 4s wait → reconcile → 4s wait → reconcile (max ~47s) |
| 12s receipt timeout cannot leave a batch permanently stuck | **PASS** | On timeout: `receipt_pending: true` → batch goes `ANCHOR_SUBMITTED` → workflow reconciles → 5-min worker is fallback |
| 4s retry intervals work correctly | **PASS** | `wait_1: PT4S`, `wait_2: PT4S` between `flush_batch` and `reconcile_1`/`reconcile_2` |
| Concurrent workers cannot create duplicate transactions | **PASS** | Conditional `updateMany` claim with UUID: `{ status: $in: [PENDING, FAILED_RETRYABLE] }` → `$set: { PROCESSING, anchor_claimed_by: myClaim }` + re-fetch verification |
| Failed/delayed transactions recovered safely | **PASS** | Stale claim recovery (>10 min), revert → FAILED_RETRYABLE with backoff, receipt-not-found-after-30-min → FAILED_RETRYABLE |
| Confirmed blockchain integrity cannot bypass org-authority | **PASS** | `issueCredential` is called only AFTER `ach` + `vr` are issuer-verified; `verifyBatchAnchor` checks chain integrity only — org_id/verifiers are written from the verified VerificationRequest, never from the anchor |

---

## 3. Production Safety Audit

| Requirement | Status | Evidence |
|---|---|---|
| Test functions cannot reach production signing | **PASS** | `anchorFlushValidation` uses mock broadcaster (0 production_broadcast_calls); `mainnetSmokeTest` requires explicit `liveBroadcastConsent: true`; `mainnetIncidentAudit` is read-only RPC |
| Amoy-pinned batches cannot broadcast on mainnet | **PASS** | `anchorBatchRoot` receives `opts.target` from the batch's `network` field (line 225); `attemptBatch` resolves `batchTarget` from `batch.network` (line 344); the broadcaster is network-pinned |
| Network mismatches fail closed | **PASS** | `resolvePolygonTarget` returns `unsupported` for unknown values; `anchorBatchRoot` checks `chainId !== cfg.chainId` → `wrong_chain`; `verifyBatchAnchor` checks `bc.chain_id !== cfg.chainId` → `unsupported_pinned_chain` |
| Orphaned synthetic transactions cannot grant verified status | **PASS** | `verifyBatchAnchor` requires: tx exists, receipt success, correct chain/sender/recipient, zero value, calldata parses as batch payload, on-chain root = stored root, Merkle proof verifies recomputed leaf. An orphaned tx without a matching AnchorBatch record has no stored root/proof → `anchor_invalid` |
| Production broadcasting settings unchanged | **PASS** | `MAINNET_BROADCAST_ENABLED` unchanged; fee ceiling 200 Gwei unchanged; $3/$5 budgets unchanged; no secrets modified |
| Fast-flush workflow inactive | **PASS** | `Anchor Batch Flush` workflow is modified but NOT activated — the 5-min scheduled worker remains the only active mechanism |
| Production spending during review | **PASS** | 0 production broadcast calls; fee gate blocks at 200 Gwei (348 > 200); no mainnet transactions executed |

**Note:** `MAINNET_BROADCAST_ENABLED` is `true` in the environment (pre-existing). The fee gate (200 Gwei ceiling) is the active defense preventing spending at current gas prices.

---

## 4. Performance Evidence

### Latency breakdown

| Measurement type | Value | Source |
|---|---|---|
| Mock-test latency (scenario 8a) | **2,899 ms** | `anchorFlushValidation` mock broadcaster finalize path |
| Deterministic budget (simulated) | **8,000 ms** | Validation harness scenario 9 |
| Live on-chain confirmation latency | **NOT MEASURED** | Scenario 8b requires Amoy env + explicit consent — not run |
| Live mainnet batch (AB-F224C0, 2 creds) | **No timing data** | Confirmed before instrumentation was added |
| Live mainnet batch (AB-5FBCA1, 1 cred) | **No timing data** | Confirmed before instrumentation was added |

### Timing instrumentation confirmed present

- `submitted` event_log: `broadcast_at` + `receipt_pending`
- `confirmed` event_log: `total_ms` (enqueue→receipt) + `broadcast_to_receipt_ms`
- `processAnchorQueue` response: `forced_batch_result.timing` with `enqueue_at`, `flush_at`, `broadcast_at`, `receipt_at`, `tick_ms`, `total_ms`

### Remaining bottlenecks

1. **Fee gate at 200 Gwei** — blocks ALL broadcasting at current gas (~278 Gwei). This is the primary bottleneck. Resolution requires operator approval to raise the ceiling to 350–400 Gwei.
2. **Live on-chain latency unmeasured** — the 8-10s target is simulated/mock-proven only. Actual Polygon block inclusion + confirmation time requires a live Amoy test with explicit consent.
3. **Legacy per-credential path** (`anchorCredential` line 534) has no receipt timeout — could block the function runtime. Not a primary path (batch path is used for all new credentials), but a minor gap.

---

## 5. Final Deliverable

### PASS / FAIL / NOT TESTED Summary

| # | Critical Requirement | Status |
|---|---|---|
| 1 | Fee gate: eth_gasPrice + 1.25× + ceiling interaction | **PASS** |
| 2 | Hypothetical ceilings 200/300/400/500/600 evaluated | **PASS** |
| 3 | $3 normal / $5 absolute budgets preserved | **PASS** |
| 4 | 300 Gwei recommendation validity | **FAIL** — insufficient (348 > 300) |
| 5 | Workflow uses correct function parameters | **PASS** |
| 6 | Receipt reconciliation begins promptly | **PASS** |
| 7 | 12s timeout cannot permanently stall | **PASS** |
| 8 | 4s retry intervals correct | **PASS** |
| 9 | No duplicate transactions from concurrency | **PASS** |
| 10 | Failed/delayed transactions recovered safely | **PASS** |
| 11 | Blockchain integrity cannot bypass org-authority | **PASS** |
| 12 | Test functions cannot reach production signing | **PASS** |
| 13 | Amoy batches cannot broadcast on mainnet | **PASS** |
| 14 | Network mismatches fail closed | **PASS** |
| 15 | Orphaned txs cannot grant verified status | **PASS** |
| 16 | Production broadcast settings unchanged | **PASS** |
| 17 | Fast-flush workflow inactive | **PASS** |
| 18 | No production spending during review | **PASS** |
| 19 | Simulated latency ≤ 8s | **PASS** (2.9s mock) |
| 20 | Mock-test latency ≤ 10s | **PASS** (2.9s) |
| 21 | Actual on-chain confirmation latency ≤ 10s | **NOT TESTED** |
| 22 | 95% of eligible credentials confirmed ≤ 60s | **NOT TESTED** (requires live Amoy) |

### Recommended fee-policy range

**350–400 Gwei** (operator-approved). Cost per batch: $0.0031 at 400 Gwei. $3/$5 budgets unchanged and never reached.

### Receipt reconciliation confirmation

**Confirmed working.** The 3s coalesce → flush → 4s wait → reconcile → 4s wait → reconcile loop ensures a submitted batch is reconciled within ~47s maximum. The 12s receipt timeout returns `receipt_pending` cleanly, and the conditional claim prevents duplicate transactions.

### Remaining bugs / blockers

1. **Fee gate at 200 Gwei blocks all broadcasting** — the active ceiling is below current mainnet gas. Requires operator approval to raise to 350–400 Gwei.
2. **Live on-chain latency unmeasured** — Amoy test (scenario 8b) not run. Must be measured before claiming live 8-10s performance.
3. **Legacy `anchorCredential` path lacks receipt timeout** — minor gap on a non-primary path.

### Production readiness verdict

**CONDITIONAL GO**

The architecture, safety controls, and reconciliation loop are production-ready. The conditional gate is the fee ceiling: at 200 Gwei, no transactions can broadcast. Once an operator approves a 350–400 Gwei ceiling and a live Amoy confirmation test validates the 8-10s target, the system is GO for mainnet activation.

---

## 6. Handoff Checklist for the Authorised Production Operator

### Pre-activation (read-only, safe)

- [ ] Review this report and the fee-policy proposal at `docs/fee-policy-proposal.md`
- [ ] Confirm `MAINNET_BROADCAST_ENABLED` is the intended state
- [ ] Confirm the signer address in `POLYGON_MAINNET_ANCHOR_ADDRESS` matches the private key in `POLYGON_MAINNET_ISSUER_PRIVATE_KEY`
- [ ] Confirm `POLYGON_MAINNET_RPC_URL` is the intended mainnet endpoint
- [ ] Review the gas-fee monitor panel in the Admin Console (last 10 observations)

### Fee-policy approval

- [ ] Approve `ANCHOR_MAX_FEE_GWEI=400` (or 350 as minimum) — do NOT use 300
- [ ] Confirm `$3` per-batch budget and `$5` absolute cap remain unchanged
- [ ] Confirm no change to `MAINNET_BROADCAST_ENABLED` or wallet secrets

### Amoy validation (test, not mainnet)

- [ ] Set `POLYGON_NETWORK=polygon_amoy` (do NOT change `MAINNET_BROADCAST_ENABLED`)
- [ ] Run `anchorFlushValidation` with `{ count: 5, liveBroadcastConsent: true }` on Amoy
- [ ] Verify scenario 8b measures live on-chain confirmation latency ≤ 10s
- [ ] Verify scenario 8b confirms 95% of eligible credentials within 60s
- [ ] Revert `POLYGON_NETWORK` to the production value after testing

### Workflow activation

- [ ] Set `ANCHOR_FLUSH_DEBOUNCE_SECONDS=3` (activates event-driven flushing)
- [ ] Activate the **Anchor Batch Flush** workflow (currently inactive, modified with reconciliation loop)
- [ ] Verify the 5-min scheduled **Blockchain Anchor Queue** workflow remains active as the recovery mechanism
- [ ] Monitor the first live batch through the Admin Console queue panel

### Post-activation monitoring

- [ ] Watch for `ANCHOR_PENDING_FEE` batches (fee ceiling still blocking)
- [ ] Watch for `ANCHOR_SUBMITTED` batches exceeding the 10-min confirmation SLA
- [ ] Watch for `anchor_escalation` / `anchor_critical` notifications
- [ ] Verify confirmed batches have `total_ms` timing in the event_log (should be ≤ 60s)

### Rollback

- [ ] To disable fast-flush: set `ANCHOR_FLUSH_DEBOUNCE_SECONDS=0` and deactivate the Anchor Batch Flush workflow
- [ ] The 5-min scheduled worker continues regardless
- [ ] To block all broadcasting: set `ANCHOR_MAX_FEE_GWEI=1` (or revert to 200)
- [ ] No secrets or wallet configurations need to be changed for rollback