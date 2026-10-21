# Blockward Amoy Staging Harness

A standalone Node.js test harness for measuring Polygon Amoy blockchain
submission-to-confirmation latency. It is **completely independent** of
Base44's production runtime, database, workflows, and signing infrastructure.

## Isolation guarantees

- **No Base44 SDK** — the harness never imports `@base44/sdk` or connects to the
  Base44 database, backend functions, or workflows.
- **No production secrets** — reads only `AMOY_STAGING_*` from a local `.env`
  file. Never reads `POLYGON_MAINNET_*`, `ISSUER_PRIVATE_KEY`, or any production
  credential.
- **Hardcoded Amoy** — `defineChain({ id: 80002 })`. There is no mainnet chain
  definition and no network selector.
- **Fail-closed guards** — config-required, signer-address-match, and
  live-chain-ID (80002) checks run before any broadcast.
- **Test-only credentials** — synthetic commitments use the `BW-HARNESS-`
  prefix, never the production `BW-` prefix.

## What it reuses

The harness imports the production **pure crypto modules** (zero network /
secret access, verified by grep):
- `base44/shared/anchorMerkle.ts` — SHA-256 Merkle tree + proof verification
- `base44/shared/credentialHash.ts` — BW-HASH-V1 credential content commitment

These modules use WebCrypto only and contain no imports, no network calls, and
no secret access.

## Requirements

- Node.js 18+ (for global `crypto.subtle`)
- The root project's `node_modules` (provides `viem`)

## Setup

```bash
# 1. Copy the env template
cp .env.example .env

# 2. Fill in the staging secrets (for a live run only)
#    DO NOT use production credentials.
#    Generate a new Amoy test key and fund it from the Amoy faucet.
```

## Usage

```bash
# Run offline (deterministic) tests — no network, no broadcast
npx --yes tsx tests/offline.test.ts

# Dry-run the harness — computes commitments, builds Merkle trees,
# verifies proofs, and reports readiness. NO broadcast.
npx --yes tsx harness.ts

# Live run — broadcasts synthetic anchors on Polygon Amoy and measures
# confirmation latency. Requires .env with staging secrets.
npx --yes tsx harness.ts --live
```

## What the harness measures

End-to-end submission-to-confirmation latency for a synthetic Polygon Amoy
Merkle-root anchor — the same commitment shape production uses
(`{ v: 1, t: 'blockward-batch', hv: 1, n, r }`), signed as a 0-value self-tx
with commitment-only calldata.

Per scenario, it reports:
- Fastest (min)
- Median (50th percentile)
- Slowest (max)
- 95th percentile
- Breakdown: broadcast→hash, hash→receipt, total

## What the harness CANNOT validate

The harness tests raw network confirmation latency in isolation. It does NOT
exercise these production-only components:

| Component | Why it's out of scope |
|---|---|
| AnchorBatch / Credential entity writes | No Base44 database access |
| Event-driven trigger (entity-created → flush workflow) | No Base44 workflows |
| 3-second coalescing window (event-driven batching) | Queue orchestration |
| Claim-lock concurrency control | Queue orchestration |
| Fee-policy gate (gas ceiling, fee hold, escalation) | Policy, not broadcast |
| Proof distribution (writing Merkle proofs to records) | No database |
| Notification / alerting pipeline | No database |
| Full credential lifecycle (issuer verification → issuance → anchor → verify) | Only the anchor subset |

The orchestration overhead (batching window, claim locks, queue processing) is
additive and is measured separately by the mock-broadcaster validation harness
(`anchorFlushValidation` in the production app).