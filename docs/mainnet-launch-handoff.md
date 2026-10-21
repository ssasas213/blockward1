# Blockward — Polygon Mainnet Launch Handoff (Phase 4)

Date: 2026-10-21 05:51 UTC · Status: **AWAITING OPERATOR ACTIVATION**
All items below are NON-TRANSACTIONAL: no secrets changed, nothing signed, no POL spent.

## 1. Current activation state (live probe, read-only)
- `activationSafetyState`: kill switch `MAINNET_BROADCAST_ENABLED` = **false**; selector resolves to `polygon_amoy`; `mainnet_broadcast_possible: false`; state **TESTNET_MODE**.
- `polygonMainnetHealth`: mainnet RPC live, chain ID **137**, signer key valid, derived address matches anchor `0x2Af9…2D7e`, `ready_to_sign: true`.

## 2. Remaining operator actions (authorised production-wallet operator ONLY)
1. Dashboard → Secrets → set `POLYGON_NETWORK` = `polygon_mainnet`.
2. Set `MAINNET_BROADCAST_ENABLED` = `true`.
3. Do NOT change `ANCHOR_MAX_FEE_GWEI` — the approved 200 Gwei ceiling stands; $3.00/$5.00 USD caps unchanged.
4. Confirm the 5-minute worker begins claiming mainnet batches (internal console → Blockchain queue).
5. Authorise and execute the smoke test (§3), then post-activation verification (§4).
6. Rollback at any time: `MAINNET_BROADCAST_ENABLED=false` (halts all mainnet broadcasting instantly; queued credentials preserved), then `POLYGON_NETWORK=polygon_amoy` if returning to testnet staging.

## 3. Fictional-credential smoke test plan (executes only after activation)
Test data: entirely fictional achievement (e.g. "Smoke Test Award — Mainnet Validation", category `other`, date 2026-10-21, holder display name "Smoke Test Holder"). No real personal information; clearly labelled as a test credential. Enforced through the normal pipeline — no trust records bypassed.

Validation gates, in order:
1. **Issuer verification & authority** — achievement created through the standard flow; issuer confirmation captured (test environment issuer); credential enters verified status only after legitimate confirmation. No issuer-authority checks bypassed.
2. **BW-HASH-V1 commitment** — SHA-256 content commitment generated at anchor time, hash_version 1.
3. **Mainnet pinning** — credential resolves network `polygon_mainnet`, chain_id 137 from `POLYGON_NETWORK` at enqueue time; pinned into `AnchorBatch.network`.
4. **Merkle batch construction** — batch opened with `close_at` window; credential leaf hashed (BW-HASH-V1 leaf) into the batch tree; batch_ref in `AB-XXXXXX` format.
5. **Queue processing & idempotency** — worker claims the batch (durable claim, stale-claim takeover); duplicate enqueue prevented; anchor_mode `batch_calldata`.
6. **Fee ceiling** — batch attempts only when market gas × 1.25 headroom ≤ 200 Gwei; otherwise `ANCHOR_PENDING_FEE` (Blockchain Pending — preserved, retried every 5 min, never dropped).
7. **Transaction confirmation** — EIP-1559 tx broadcast ≤ 200 Gwei max fee; receipt verified on-chain.
8. **Independent inclusion proof** — Merkle proof recomputes from leaf to the exact on-chain root; verified independently of Blockward's API (PolygonScan + manual proof check).
9. **Public page integrity** — /verify/BW-XXXXXXXX shows BLOCKWARD VERIFIED only after the live server-side check passes; hash recomputation confirms content commitment.

## 4. Post-activation transaction verification checklist
For each smoke credential's anchoring transaction:
- [ ] Chain ID 137 (`eth_chainId` = 0x89) — matches `POLYGON_MAINNET_CHAIN_ID`.
- [ ] Receipt status = 1 (success); block confirmed and read back.
- [ ] Sender = production signer address (derived from issuer key) = `0x2Af9…2D7e`.
- [ ] Recipient = configured anchor address; **value transferred = 0** (commitment data only).
- [ ] Calldata decodes to the batch's bare-hex Merkle root (no `0x` prefix, BATCH-PROOF-V1).
- [ ] Recomputed credential hash (BW-HASH-V1) equals the leaf used in the proof.
- [ ] Inclusion proof recomputes to the on-chain root; leaf index matches batch member order.
- [ ] Public /verify page shows verified status, network label "Polygon Mainnet", chain 137, and the on-chain references — **no personal data exposed on-chain** (only public references + content commitment).
- [ ] No achievement is marked blockchain-confirmed until every box above passes.

## 5. Production automation validation (after activation)
Confirm, via the internal console and a second fictional credential:
- New eligible verified achievements enqueue automatically (service-role pipeline; batch pinned `polygon_mainnet`).
- Batching runs on the 10-minute window / 15-minute target; small batches never delayed past `close_at`.
- Worker processes every ~5 minutes (workflow `Blockchain Anchor Queue`, scheduled, healthy).
- High gas ⇒ `ANCHOR_PENDING_FEE` (Blockchain Pending) — preserved and self-healing, never lost.
- Retry/backoff (8 attempts, 6-hour ceiling), stale-claim takeover (>10 min), receipt reconciliation active.
- Historical Amoy & Sepolia credentials unchanged and verifiable against their pinned `chain_id`/`network` — switching networks can never reassign or rebroadcast them.
- Internal console "Blockchain queue" tab reports mainnet batches, alerts (fee hold / escalation 60 min / critical 24 h), cost tracking, and policy snapshot.

## 6. Launch monitoring checklist
| Signal | Watch for | Response |
|---|---|---|
| Worker failures | Workflow runs not `ok`; >15 min without a tick | Check logs; queue holds durable claims — restart-safe by design |
| Queue delays | Batch past `close_at` unprocessed | 60-min escalation alert fires; force-attempt if needed |
| Fee holds | `ANCHOR_PENDING_FEE` growing under 200 Gwei ceiling | Expected under fee spikes; holds auto-release; alert dedupe active |
| Confirmation failures | `ANCHOR_FAILED_RETRYABLE` with `last_error` | Backoff handles transient errors; investigate persistent RPC errors |
| Duplicate anchoring | Same root broadcast twice | Claim locks + idempotent enqueue prevent; verify no duplicate tx hashes |
| Network misassignment | Batch `network` ≠ credential expectation | Batches carry their own pinned network; investigate immediately if mismatch seen |
| Invalid Merkle proofs | Public page integrity banner | Fail-closed: page never shows verified on proof mismatch; root-cause via event logs |
| Emergency rollback | Any critical incident | Flip `MAINNET_BROADCAST_ENABLED=false`; credentials preserved; review before re-enabling |

Alert channels: `anchor_escalation`, `anchor_fee_hold`, `anchor_critical` admin notifications (Notification entity + admin alert emails), internal console alerts panel.

## 7. Fee-policy status (decided, unchanged)
- `ANCHOR_MAX_FEE_GWEI` = **200** (500 Gwei proposal declined by authorised approver).
- USD caps $3.00/batch, $5.00 absolute — backstops only; the Gwei ceiling is the primary binding control.
- At ~26,450 gas: worst-case attempt ≤ $0.009; typical cost $0.002–0.004 per batch. Integration-test ceiling 0.01 POL separate and unchanged.
- POL/USD price source currently `fallback_estimate` ($0.30) — conservative floor, safe for decisions.

## 8. Unresolved blockers
- **Resolved 2026-10-21 05:57 UTC:** the operator completed activation and the smoke test passed. See §9.

## 9. SMOKE TEST RESULT — PASSED (2026-10-21 05:57 UTC, post-activation)
- Activation confirmed: `ACTIVATED_MAINNET`, kill switch enabled by the operator, issuance resolves `polygon_mainnet`.
- Two fictional, clearly-labelled credentials (BW-CMAH7MGR, BW-TD9SQVBM) entered the queue through the single production issuance pipeline (BW-HASH-V1 commitments, mainnet pinning, batch AB-F224C0).
- Mainnet transaction: `0x77479eb136b720b51e72f4001a5756fc10c8a9937b90b2e1b28e712bf02d5035` — chain 137, receipt success, block 95904599, sender = recipient = anchor `0x2Af9…2D7e`, value 0, fee 0.00358 POL (140 gwei, under the 200 Gwei ceiling).
- On-chain calldata decoded (RPC + PolygonScan independently): `{"v":1,"t":"blockward-batch","hv":1,"n":2,"r":"14afc5df…d58f"}` — matches the stored batch root; no personal data on-chain.
- Both Merkle inclusion proofs independently recomputed (canonical BATCH-PROOF-V1 convention) to the exact on-chain root. Achievements marked VERIFIED only after confirmation.
- Public verification page: integrity confirmed, batch proof + explorer link rendered, no PII.
- Historical Amoy credentials (AB-E2ETST) unchanged and still verifiable on their pinned chain 80002. Queue healthy: zero failures.
- Note: the old `polygonMainnetIntegrationTest` pre-broadcast probe now correctly refuses while issuance is on mainnet (its Gate 6 requires issuance on Amoy) — expected, historical role fulfilled.