# Blockward — Live Production Issuance Workflow Audit

Date: 2026-10-21 · Scope: issuer verification → credential issuance → Polygon mainnet batching → public verification.
Method: code audit of the complete org-flow path + live read-only inspection of production data, the queue, the worker, the public verify API and PolygonScan. **No credentials created, no transactions, no production data modified, fee policy untouched.**

## 1. Workflow trace — verified end-to-end (code + live state)

1. **Holder requests verification** (`requestOrgVerification`): ownership + status guards (self-verification impossible, one active request per achievement), resolves the organisation's verification policy (single or joint signatures), notifies the org contact + every active verifier by email and in-app. Pending organisations may receive requests but can never mint credentials (gated at issuance).
2. **Organisation reviews & signs** (org dashboard → `OrgVerificationQueue` → `orgVerificationReview`): authority = an ACTIVE, authenticated membership of the request's organisation. Signing requires the verification method, explicit consent, and the id of the verifier's stored, ownership-confirmed signature — never auto-attached. Policy-restricted verifier lists enforced. Joint verification completes only at the required signature count.
3. **Issuance** (`credentialIssuance.issueCredential`): single shared pipeline — unique BW-XXXXXXXX credential ID, full attested content snapshot, verifier signer records, Achievement set to `blockchain_processing`, holder notified.
4. **Batching queue** (`anchorQueue.enqueueCredentialForAnchoring`): credential joins the oldest open batch on the resolved network (mainnet since activation), pinned to the batch; durable `AnchorBatch` lifecycle with batching window (≤15 min), fee-policy gate, escalation/critical windows, retries with backoff.
5. **Worker**: scheduled workflow "Blockchain Anchor Queue" is **active**, running every ~5 minutes; the last 10 runs all `ok` (including the run that confirmed the smoke batch at 05:57 UTC).
6. **Confirmation**: receipt verified, Merkle proofs distributed to each credential, achievement marked VERIFIED only after on-chain confirmation, holder notified.
7. **Public verification** (`publicVerifyData` → `/verify/:bw_id`): returns only public-by-design fields (no PII); trust derives from server-side on-chain re-verification, never local flags.

## 2. Anchored-credential display — verified live

Both mainnet smoke credentials (BW-CMAH7MGR, BW-TD9SQVBM) on `publicVerifyData`:
- Correct credential ID, `status: active`, `validity: valid`, attested content, signer snapshot. ✅
- Network `polygon`, `testnet: false` — Polygon mainnet, chain ID 137 (pinned per credential and verified on-chain). ✅
- Actual confirmed transaction hash `0x77479eb136b720b51e72f4001a5756fc10c8a9937b90b2e1b28e712bf02d5035` with a working PolygonScan link (checked externally on polygonscan.com: Success, block 95904599, 2026-10-21 05:57 UTC). ✅
- Merkle inclusion proofs recomputed independently (canonical BATCH-PROOF-V1 convention) — both recompute exactly to the on-chain batch root decoded from the transaction calldata (`14afc5df…d58f`), matching PolygonScan's Input Data byte-for-byte. ✅
- Integrity status: `confirmed`; public page renders the batch reference, root, leaf index and explorer link. ✅

## 3. Shared transaction, separate proofs — verified

Batch `AB-F224C0` (2 members): BW-TD9SQVBM (leaf 0) and BW-CMAH7MGR (leaf 1) **share the same transaction hash** but each carries its **own inclusion proof** (distinct sibling hash, distinct leaf index), and each proof independently recomputes to the same on-chain root. The same structure was previously proven on Amoy (AB-E2ETST). ✅

## 4. Issues found

| # | Severity | Issue | Status |
|---|---|---|---|
| 1 | **High — blocks a normal path** | The legacy email-token issuer flow has **no landing page**: `issuerVerifyData`/`issuerVerifyAction` exist server-side, but no route/page exists for the emailed `/issuer-verify/:token` link — an issuer who is NOT a registered Blockward organisation clicks the verification email and reaches a 404. Holders verifying with unregistered issuers cannot complete verification. | **Open — needs the issuer-verify page built (or the fallback path retired with clear UX).** |
| 2 | Medium | `AchievementDetailDrawer` hardcoded the **Amoy** PolygonScan link, so mainnet credentials showed a broken "view transaction" link in the holder's detail view. | **Fixed during audit** — link is now network-aware (mainnet → polygonscan.com, testnet → amoy.). |
| 3 | Medium | Org-flow emails linked verifiers to `/organisation`, which is the **invite-accept page**, not the dashboard. | **Fixed during audit** — email links now point to `/organisations/dashboard`. |
| 4 | Informational | Hidden legacy school-life components (BlockWardIssueForm, NFTMinter) still hardcode Amoy links — not part of the issuer workflow; no user reaches them in current navigation. | Noted only. |
| 5 | Informational | **No real production credential has completed the full UI-path yet.** All 8 credentials are fictional/test records; the only verified organisation is "Blockward Test Issuer". The pipeline is proven (smoke test + code audit), but the first real issuer issuance should be watched on the internal dashboard and its credential checked on PolygonScan. | Operator awareness. |

## 5. Verdict

**The organisation-issuer workflow is production-ready for verified organisations**: holder request → queue → review & sign → credential → mainnet Merkle batch → confirmed anchor → public verification all verify in code and live data, with correct IDs, chain-137 labelling, real transaction hashes, working explorer links, and independently recomputed inclusion proofs. One genuine gap remains (**#1 — the unregistered-issuer token flow's missing landing page**); it does not affect registered organisations but must be closed before holders can rely on the fallback path.