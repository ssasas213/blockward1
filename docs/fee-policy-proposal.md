# Fee-Policy Proposal — Sub-60s Anchoring Activation

**Status:** Proposal only. No live gas ceilings, budgets, secrets, or broadcast flags have been changed. Activation requires operator approval.

## Current Policy (unchanged)

| Parameter | Value | Source |
|---|---|---|
| `maxFeeGwei` | 200 Gwei | `anchorGasPolicy.ts` |
| `maxBatchCostUsd` | $3.00 / batch | `anchorGasPolicy.ts` |
| `absoluteMaxCostUsd` | $5.00 / batch | `anchorGasPolicy.ts` |
| `batchGasLimit` | 60,000 units | `anchorGasPolicy.ts` |
| `maxBatchSize` | 500 credentials | `anchorGasPolicy.ts` |
| `MAINNET_BROADCAST_ENABLED` | (secret — unchanged) | app secrets |

## Observed Gas Prices (live mainnet, last tick)

| Observation | Gwei | Decision (200 Gwei ceiling) |
|---|---|---|
| Tick 1 | 278.5 | **BLOCKED** — `fee_ceiling_gwei` |
| Tick 2 | 279.4 | **BLOCKED** — `fee_ceiling_gwei` |
| Tick 3 | 281.2 | **BLOCKED** — `fee_ceiling_gwei` |
| Tick 4 | 278.4 | **BLOCKED** — `fee_ceiling_gwei` |
| Tick 5 | 279.2 | **BLOCKED** — `fee_ceiling_gwei` |

Current mainnet gas is ~278-281 Gwei — above the 200 Gwei ceiling. Every batch is fee-held. Batch `AB-5FBCA1` remains held.

## Cost Analysis — Per-Batch Fee at Various Ceilings

Gas used per batch anchor: **25,861 units** (from the production audit — constant-size Merkle-root commitment).
POL price: **$0.30** (coingecko fallback).

| Ceiling (Gwei) | Fee (POL) | Fee (USD) | $3 Budget Headroom | Decision at 280 Gwei live |
|---|---|---|---|---|
| 200 (current) | 0.00517 | $0.00155 | 1,932× under | **BLOCKED** (280 > 200) |
| 300 | 0.00776 | $0.00233 | 1,288× under | **ALLOWED** (280 ≤ 300) |
| 400 | 0.01034 | $0.00310 | 967× under | **ALLOWED** |
| 500 | 0.01293 | $0.00388 | 773× under | **ALLOWED** |
| 600 | 0.01552 | $0.00466 | 644× under | **ALLOWED** |
| 800 | 0.02069 | $0.00621 | 483× under | **ALLOWED** |

### Break-even analysis

- **$3 per-batch budget** is hit at **386,700 Gwei** (~1,933× above the current 200 Gwei ceiling).
- **$5 absolute cap** is hit at **644,500 Gwei** (~3,222× above the current ceiling).
- The 200 Gwei ceiling is the **only** binding constraint. The $3/$5 budgets are never reached at any realistic gas price.

## Per-Credential Cost (batch of 500)

| Ceiling | Per-credential (USD) |
|---|---|
| 200 Gwei | $0.0000031 |
| 300 Gwei | $0.0000047 |
| 500 Gwei | $0.0000078 |

At any realistic ceiling, the per-credential cost is **microscopic** — less than one cent per thousand credentials.

## Recommendation

### Primary: Raise the ceiling to 300 Gwei

**Rationale:**
- Enables broadcasting at the current ~280 Gwei mainnet gas (unblocks batch `AB-5FBCA1`).
- Cost per batch: $0.00233 — still **1,288× below** the $3 budget.
- Per-credential cost at 500-batch size: $0.0000047.
- The $3/$5 protections remain unchanged and are never reached.
- The 200 Gwei ceiling is overly conservative for a 25,861-gas, zero-value, commitment-only transaction.

**Cost of inaction:**
- Every batch is fee-held at current gas prices.
- Batch `AB-5FBCA1` and all new batches wait indefinitely until gas drops below 200 Gwei.
- The sub-60s target is unreachable — the fee gate blocks broadcasting before the 12s receipt window can even start.

**What this does NOT change:**
- `MAINNET_BROADCAST_ENABLED` stays unchanged.
- The $3 per-batch and $5 absolute caps stay unchanged.
- The signer address, RPC, and contract stay unchanged.
- Amoy (testnet) anchoring is unaffected — the ceiling only gates mainnet.

### Alternative: Maintain 200 Gwei (no change)

- Safe but non-functional under current market conditions.
- Batches will continue to fee-hold until mainnet gas drops below 200 Gwei.
- The sub-60s target cannot be met; holders wait hours or days for anchoring.

## Cost-Per-Achievement Volume Projection (300 Gwei ceiling)

| Monthly verified achievements | Monthly batches (500/batch) | Monthly POL | Monthly USD |
|---|---|---|---|
| 1,000 | 2 | 0.0155 | $0.005 |
| 10,000 | 20 | 0.155 | $0.047 |
| 100,000 | 200 | 1.552 | $0.466 |
| 1,000,000 | 2,000 | 15.52 | $4.66 |

Even at one million achievements per month, the total mainnet anchoring cost is **under $5** at a 300 Gwei ceiling. The $3 per-batch budget is designed for a per-batch cost that is 1,000× lower than the budget.

## What Needs Operator Approval

1. Set `ANCHOR_MAX_FEE_GWEI=300` (or keep 200) — environment override on the gas policy.
2. Set `ANCHOR_FLUSH_DEBOUNCE_SECONDS=3` — activates event-driven flushing.
3. Activate the **Anchor Batch Flush** workflow (currently inactive — modified with the immediate reconciliation loop).
4. Keep `MAINNET_BROADCAST_ENABLED` unchanged.
5. (Optional) Switch `POLYGON_NETWORK=polygon_amoy` to test the full live path before mainnet activation.

No secrets, signer keys, or wallet configurations are touched by this proposal.