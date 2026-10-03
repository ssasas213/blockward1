# Controlled Polygon integration — preparation only

The standalone local CLI `scripts/polygon-mainnet-integration.mjs` is not a
Base44 endpoint, is not imported by issuance, and is not deployed by this change.
Node 24+ and the repository's ethers dependency are required. No environment
variables, deployment or transaction are created by installing/reviewing it.

## Fixed transaction and shared policy

- Polygon PoS chain ID 137, EIP-1559 type 2, value 0 wei.
- Sender derives from POLYGON_MAINNET_ISSUER_PRIVATE_KEY and must equal the
  configured POLYGON_MAINNET_ANCHOR_ADDRESS; recipient is that same address.
- Address must have empty bytecode (including no delegated account code).
- Calldata is exactly 32 raw bytes: SHA-256 of
  `blockward:polygon-mainnet-integration-test:v1:synthetic-only`.
- No credential identifiers, user input, PII, readable marker or contract call.
- Shared policy module: `base44/shared/mainnetIntegrationPolicy.ts`, also used
  by the existing Base44 preflight, which remains incapable of broadcasting.
- Default total fee ceiling is 0.001 POL; optional
  POLYGON_MAINNET_TEST_MAX_FEE_POL is a positive decimal no greater than 0.01 POL.
  All calculations use bigint wei; the gas limit is ceil(estimated gas × 1.2).
  Total maximum fee is gas limit × maxFeePerGas (priority fee is included).

## Operator flow — do not execute without separate authorization

Safe description with no environment reads, key access, RPC, signing or writes:

```sh
node scripts/polygon-mainnet-integration.mjs --describe
```

After separately authorizing a live read-only preflight and secure access to
the existing configuration, the operator can prepare a new public plan:

```sh
node scripts/polygon-mainnet-integration.mjs --prepare --plan mainnet-integration-plan.json
```

Preparation derives only the public signer, reads chain/balance/code/nonce/fees,
and estimates gas. It does not sign or broadcast. It refuses to overwrite the
plan file. It prints a public SHA-256 authorization value binding the entire
plan, including random challenge, nonce, amounts and five-minute expiry. Review
the plan and receive explicit authorization before proceeding. No keys or RPC
URLs are stored in the plan. Do not paste keys into commands or chat.

The exact eventual broadcast action is:

```sh
node scripts/polygon-mainnet-integration.mjs --broadcast --plan mainnet-integration-plan.json --authorize <EXACT_AUTHORIZATION_FROM_REVIEWED_PLAN>
```

The authorization placeholder is intentionally not prefilled. This command is
the only CLI action that can sign/send. Preparation must be repeated if the
plan expires; an existing journal must never be deleted as an automatic retry.
No broadcast action has been performed while preparing this code.

## Fresh checks and fail-closed execution

Execution verifies exact plan authorization/expiry/fields, then reruns live chain
137, expected signer, empty code, nonce, balance, gas and EIP-1559 fee checks.
It rejects pending transactions and a nonce different from the reviewed plan.
Fresh estimates must fit within the reviewed limits; it never raises those
limits automatically. Balance must cover the reviewed maximum, even if the
fresh estimate is lower. Normal issuance must still resolve to Amoy; the CLI
only reads POLYGON_NETWORK and never changes it.

Before signing, it reserves an exclusive durable journal in the operator's
home directory at `.blockward-integration/polygon-137-integration-v1-<sender>.json`.
The same operator/sender/test cannot execute twice, including across process
restarts. The offline signed transaction is decoded and its sender and every
transaction field checked against the plan. Only its public hash is persisted
and fsynced before the single send call. The raw signed transaction is not
printed or saved. Chain ID and plan expiry are rechecked immediately before send.

After send it waits for two confirmations (three-minute timeout), then separately
fetches transaction and receipt. It requires chain 137, successful mined receipt,
matching block/hash, sender, recipient, nonce, zero value, exact commitment and
approved fee fields, including actual paid fee within the ceiling.

Any signing/send/receipt ambiguity consumes the one-shot journal and requires
manual reconciliation of the recorded transaction hash and nonce. There is no
retry, fee bump, replacement, deletion, reset or second-send feature. Errors are
sanitized to fixed codes; provider/key exceptions and secret RPC URLs are not
logged. A failed receipt is never reported as a successful integration.

## Limits and remaining prerequisites

The journal is local to the operator account. Copies on other machines or
intentional deletion are not globally prevented; use one designated operator
machine. Sharing the same reviewed nonce prevents two independent transactions
from the same plan, but creating a new plan on another machine is not a global
one-time guarantee. No claim of global distributed idempotency is made.

Live configuration, balance, endpoint behavior, and actual nonce/fees have not
been inspected as part of code preparation. These must be checked in a separately
authorized preflight before authorizing the final command. The operator must
avoid unrelated use of the signer between plan and execution. A successful
test does not enable mainnet credential issuance or justify changing its selector.

## Offline validation

```sh
npm run test:polygon
npm run test:mainnet-broadcaster
git diff --check
```

Broadcaster tests use an ephemeral synthetic wallet, mock every RPC/send method,
and exercise journal persistence in a temporary directory. They never invoke
the CLI preparation/broadcast actions or use a configured production key.
