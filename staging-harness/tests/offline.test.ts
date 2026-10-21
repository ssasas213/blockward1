// ============================================================================
// offline.test.ts — deterministic offline tests for the staging harness.
//
// Tests pure logic only: config resolution, guards, metrics, commitments,
// Merkle proof round-trip, and secret redaction. No network, no broadcast,
// no viem, no secrets.
//
// Run: npx --yes tsx tests/offline.test.ts
// ============================================================================

// Ensure WebCrypto is available (Node 18+ has it globally; polyfill for safety)
if (!(globalThis as any).crypto) {
  const { webcrypto } = await import('node:crypto');
  (globalThis as any).crypto = webcrypto;
}

import assert from 'node:assert/strict';
import { resolveConfig, AMOY_CHAIN_ID } from '../lib/config.ts';
import {
  validateConfigPresent,
  validateSignerAddressMatch,
  validateChainId,
  validateRootHex,
  validateMemberCount,
} from '../lib/guards.ts';
import { computeStats, percentile, formatMs } from '../lib/metrics.ts';
import {
  generateSyntheticLeaves,
  buildBatchTree,
  verifyBatchProof,
  buildBatchPayload,
  parseBatchPayload,
  HARNESS_PREFIX,
} from '../lib/commitments.ts';
import { redactSecrets, sanitiseError, safeLog, errorToCode } from '../lib/sanitise.ts';

let passed = 0;
let failed = 0;

function check(name: string, fn: () => void | Promise<void>): void {
  Promise.resolve(fn())
    .then(() => {
      console.log(`  ✓ ${name}`);
      passed++;
    })
    .catch((e: Error) => {
      console.log(`  ✗ ${name}: ${e.message}`);
      failed++;
    });
}

async function checkAsync(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    const err = e as Error;
    console.log(`  ✗ ${name}: ${err.message}`);
    failed++;
  }
}

async function main() {
  console.log('═'.repeat(60));
  console.log('  Offline Test Suite — Blockward Amoy Staging Harness');
  console.log('═'.repeat(60));

  // ── Config resolution ───────────────────────────────────────────────
  console.log('\n  Config:');

  check('rejects when all secrets missing', () => {
    const r = resolveConfig({});
    assert.equal(r.ok, false);
    assert.equal(r.ok === false && r.error, 'staging_config_missing');
    assert.equal(r.ok === false && r.missing.length, 3);
  });

  check('rejects when one secret missing', () => {
    const r = resolveConfig({
      AMOY_STAGING_PRIVATE_KEY: '0xabc',
      AMOY_STAGING_ANCHOR_ADDRESS: '0xdef',
    });
    assert.equal(r.ok, false);
    assert.equal(r.ok === false && r.missing.length, 1);
    assert.equal(r.ok === false && r.missing[0], 'AMOY_STAGING_RPC_URL');
  });

  check('accepts when all secrets present', () => {
    const r = resolveConfig({
      AMOY_STAGING_PRIVATE_KEY: '0xabc',
      AMOY_STAGING_ANCHOR_ADDRESS: '0xdef',
      AMOY_STAGING_RPC_URL: 'https://rpc',
    });
    assert.equal(r.ok, true);
    assert.equal(r.ok === true && r.config.chainId, AMOY_CHAIN_ID);
  });

  // ── Guards ──────────────────────────────────────────────────────────
  console.log('\n  Guards:');

  check('config-present: passes on valid config', () => {
    const r = validateConfigPresent({ ok: true, config: {} });
    assert.equal(r.ok, true);
  });

  check('config-present: fails on missing config', () => {
    const r = validateConfigPresent({ ok: false, error: 'staging_config_missing', missing: ['X'] });
    assert.equal(r.ok, false);
    assert.equal(r.ok === false && r.error, 'staging_config_missing');
  });

  check('signer-address: passes on match', () => {
    const r = validateSignerAddressMatch('0xABC123', '0xabc123');
    assert.equal(r.ok, true);
  });

  check('signer-address: fails on mismatch', () => {
    const r = validateSignerAddressMatch('0xABC123', '0xDEF456');
    assert.equal(r.ok, false);
    assert.equal(r.ok === false && r.error, 'signer_address_mismatch');
  });

  check('chain-id: passes on 80002', () => {
    const r = validateChainId(80002, 80002);
    assert.equal(r.ok, true);
  });

  check('chain-id: fails on 137 (mainnet)', () => {
    const r = validateChainId(137, 80002);
    assert.equal(r.ok, false);
    assert.equal(r.ok === false && r.error, 'wrong_chain');
  });

  check('chain-id: fails on null (RPC error)', () => {
    const r = validateChainId(null, 80002);
    assert.equal(r.ok, false);
    assert.equal(r.ok === false && r.error, 'chain_id_unavailable');
  });

  check('root-hex: passes on valid 64-hex', () => {
    const r = validateRootHex('a'.repeat(64));
    assert.equal(r.ok, true);
  });

  check('root-hex: passes on 0x-prefixed', () => {
    const r = validateRootHex('0x' + 'a'.repeat(64));
    assert.equal(r.ok, true);
  });

  check('root-hex: fails on short hex', () => {
    const r = validateRootHex('abc');
    assert.equal(r.ok, false);
  });

  check('member-count: passes on 1', () => {
    const r = validateMemberCount(1);
    assert.equal(r.ok, true);
  });

  check('member-count: fails on 0', () => {
    const r = validateMemberCount(0);
    assert.equal(r.ok, false);
  });

  check('member-count: fails on negative', () => {
    const r = validateMemberCount(-1);
    assert.equal(r.ok, false);
  });

  // ── Metrics ─────────────────────────────────────────────────────────
  console.log('\n  Metrics:');

  check('percentile: median of odd array', () => {
    assert.equal(percentile([100, 200, 300], 50), 200);
  });

  check('percentile: median of even array', () => {
    assert.equal(percentile([100, 200, 300, 400], 50), 250);
  });

  check('percentile: p95 of array', () => {
    // [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]
    // rank = 0.95 * 9 = 8.55 → between index 8 (900) and 9 (1000)
    // 900 + (1000-900)*0.55 = 955
    const result = percentile([100, 200, 300, 400, 500, 600, 700, 800, 900, 1000], 95);
    assert.ok(Math.abs(result - 955) < 0.01, `expected ~955, got ${result}`);
  });

  check('computeStats: correct for known array', () => {
    const stats = computeStats([100, 200, 300, 400, 500]);
    assert.equal(stats.count, 5);
    assert.equal(stats.fastest, 100);
    assert.equal(stats.slowest, 500);
    assert.equal(stats.median, 300);
  });

  check('computeStats: empty array', () => {
    const stats = computeStats([]);
    assert.equal(stats.count, 0);
    assert.equal(stats.fastest, 0);
  });

  check('formatMs: rounds to integer', () => {
    assert.equal(formatMs(1234.5), '1235ms');
  });

  // ── Commitments ─────────────────────────────────────────────────────
  console.log('\n  Commitments:');

  await checkAsync('synthetic leaves use BW-HARNESS- prefix', async () => {
    const leaves = await generateSyntheticLeaves(3);
    for (const leaf of leaves) {
      assert.ok(leaf.verification_id.startsWith(HARNESS_PREFIX), `expected ${HARNESS_PREFIX} prefix, got ${leaf.verification_id}`);
    }
  });

  await checkAsync('synthetic leaves are valid 64-hex SHA-256', async () => {
    const leaves = await generateSyntheticLeaves(2);
    for (const leaf of leaves) {
      assert.match(leaf.leaf, /^[0-9a-f]{64}$/);
    }
  });

  await checkAsync('synthetic leaves are deterministic', async () => {
    const leaves1 = await generateSyntheticLeaves(2);
    const leaves2 = await generateSyntheticLeaves(2);
    assert.equal(leaves1[0].leaf, leaves2[0].leaf);
    assert.equal(leaves1[1].leaf, leaves2[1].leaf);
  });

  await checkAsync('batch payload round-trips through parse', async () => {
    const root = 'a'.repeat(64);
    const payload = buildBatchPayload(root, 5);
    const parsed = parseBatchPayload(payload);
    assert.notEqual(parsed, null);
    assert.equal(parsed!.root, root);
    assert.equal(parsed!.memberCount, 5);
  });

  check('batch payload rejects invalid root', () => {
    assert.equal(parseBatchPayload('not json'), null);
    assert.equal(parseBatchPayload(JSON.stringify({ v: 2, t: 'x' })), null);
  });

  // ── Merkle proof round-trip (pure crypto) ───────────────────────────
  console.log('\n  Merkle proofs:');

  await checkAsync('single-member tree: root equals leaf', async () => {
    const leaves = await generateSyntheticLeaves(1);
    const { root, proofs } = await buildBatchTree(leaves);
    assert.equal(root, leaves[0].leaf);
    assert.equal(proofs[0].length, 0);
    const ok = await verifyBatchProof(leaves[0].leaf, proofs[0], root);
    assert.equal(ok, true);
  });

  await checkAsync('5-member tree: all proofs verify against root', async () => {
    const leaves = await generateSyntheticLeaves(5);
    const { root, proofs } = await buildBatchTree(leaves);
    for (let i = 0; i < leaves.length; i++) {
      const ok = await verifyBatchProof(leaves[i].leaf, proofs[i], root);
      assert.equal(ok, true, `proof ${i} failed`);
    }
  });

  await checkAsync('10-member tree: all proofs verify against root', async () => {
    const leaves = await generateSyntheticLeaves(10);
    const { root, proofs } = await buildBatchTree(leaves);
    for (let i = 0; i < leaves.length; i++) {
      const ok = await verifyBatchProof(leaves[i].leaf, proofs[i], root);
      assert.equal(ok, true, `proof ${i} failed`);
    }
  });

  await checkAsync('tampered leaf fails proof verification', async () => {
    const leaves = await generateSyntheticLeaves(3);
    const { root, proofs } = await buildBatchTree(leaves);
    // Flip the leaf hash — proof should fail
    const tampered = '0'.repeat(64);
    const ok = await verifyBatchProof(tampered, proofs[0], root);
    assert.equal(ok, false);
  });

  // ── Secret redaction ──────────────────────────────────────────────
  console.log('\n  Secret redaction:');

  await checkAsync('redactSecrets strips 0x-prefixed private keys', async () => {
    const key = '0x' + 'a'.repeat(64);
    const msg = `Error with key ${key} in message`;
    const redacted = redactSecrets(msg);
    assert.ok(!redacted.includes(key), 'private key leaked into redacted output');
    assert.ok(redacted.includes('[REDACTED_KEY]'));
  });

  await checkAsync('redactSecrets preserves bare 64-hex Merkle roots', async () => {
    const root = 'a'.repeat(64);
    const msg = `Merkle root: ${root}`;
    const redacted = redactSecrets(msg);
    assert.ok(redacted.includes(root), 'Merkle root was incorrectly redacted');
  });

  await checkAsync('redactSecrets strips ?apikey= query parameters', async () => {
    const msg = 'RPC failed at https://rpc.example.com?apikey=supersecret123';
    const redacted = redactSecrets(msg);
    assert.ok(!redacted.includes('supersecret123'), 'API key leaked into redacted output');
    assert.ok(redacted.includes('[REDACTED]'));
  });

  await checkAsync('redactSecrets strips long tokens in URL paths', async () => {
    const longToken = 'a'.repeat(40);
    const msg = `RPC: https://polygon-amoy.g.alchemy.com/v2/${longToken} failed`;
    const redacted = redactSecrets(msg);
    assert.ok(!redacted.includes(longToken), 'URL path token leaked into redacted output');
  });

  await checkAsync('redactSecrets handles non-string input', async () => {
    assert.equal(redactSecrets(null as any), '');
    assert.equal(redactSecrets(undefined as any), '');
    assert.equal(redactSecrets(123 as any), '');
  });

  await checkAsync('sanitiseError returns a stable code, not the raw object', async () => {
    const key = '0x' + 'a'.repeat(64);
    const err = { name: 'TransactionExecutionError', message: `tx failed ${key}` };
    const s = sanitiseError(err);
    assert.equal(s.code, 'tx_execution_failed');
    assert.ok(!s.message.includes(key), 'private key leaked into sanitised message');
  });

  await checkAsync('sanitiseError handles non-Error objects', async () => {
    const s = sanitiseError({ random: 'stuff', message: 'hello' });
    assert.equal(s.code, 'unknown_error');
    assert.equal(s.message, 'hello');
  });

  await checkAsync('sanitiseError handles null and undefined', async () => {
    assert.equal(sanitiseError(null).code, 'unknown_error');
    assert.equal(sanitiseError(null).message, '');
    assert.equal(sanitiseError(undefined).code, 'unknown_error');
  });

  await checkAsync('errorToCode maps known viem error names', async () => {
    assert.equal(errorToCode({ name: 'InsufficientFundsError' }), 'insufficient_funds');
    assert.equal(errorToCode({ name: 'ChainIdMismatchError' }), 'chain_id_mismatch');
    assert.equal(errorToCode({ name: 'TimeoutError' }), 'timeout');
  });

  await checkAsync('errorToCode returns unknown_error for unmapped names', async () => {
    assert.equal(errorToCode({ name: 'SomeRandomError' }), 'unknown_error');
    assert.equal(errorToCode(null), 'unknown_error');
  });

  await checkAsync('safeLog redacts private keys and truncates', async () => {
    const key = '0x' + 'f'.repeat(64);
    const err = { name: 'Error', message: `key=${key} ${'x'.repeat(400)}` };
    const s = safeLog(err);
    assert.ok(!s.includes(key), 'private key leaked into safeLog output');
    assert.ok(s.length <= 302, `safeLog output too long: ${s.length}`);
  });

  // ── Summary ────────────────────────────────────────────────────────
  // Wait a tick for all async checks to settle
  await new Promise((resolve) => setTimeout(resolve, 500));

  console.log('\n' + '─'.repeat(60));
  console.log(`  ${passed} passed, ${failed} failed`);
  console.log('─'.repeat(60));

  if (failed > 0) {
    console.log('  ✗ OFFLINE TESTS FAILED');
  } else {
    console.log('  ✓ ALL OFFLINE TESTS PASSED');
  }
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});