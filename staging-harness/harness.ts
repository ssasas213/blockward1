// ============================================================================
// harness — entry point for the isolated Polygon Amoy staging test.
//
// Modes:
//   npx tsx harness.ts          — DRY RUN (default): computes commitments,
//                                 builds Merkle trees, verifies proofs, reports
//                                 readiness. NO broadcast.
//   npx tsx harness.ts --live   — LIVE RUN: broadcasts synthetic anchors on
//                                 Polygon Amoy and measures confirmation latency.
//                                 Requires .env with AMOY_STAGING_* secrets.
//
// The harness is completely independent of Base44's production runtime,
// database, workflows, and signing infrastructure.
// ============================================================================

import { resolveConfig, AMOY_CHAIN_ID } from './lib/config.ts';
import {
  validateConfigPresent,
  validateChainId,
  validateSignerAddressMatch,
} from './lib/guards.ts';
import { computeStats, formatMs, type LatencyStats } from './lib/metrics.ts';
import {
  generateSyntheticLeaves,
  buildBatchTree,
  verifyBatchProof,
  buildBatchPayload,
  HARNESS_PREFIX,
} from './lib/commitments.ts';
import { broadcastBatchRoot, reconcileReceipt, type BroadcastResult } from './lib/broadcast.ts';
import { safeLog } from './lib/sanitise.ts';

const LIVE = process.argv.includes('--live');

const SCENARIOS = [
  { name: 'Single-member batch (1 leaf)', count: 1 },
  { name: '5-member batch', count: 5 },
  { name: '10-member batch', count: 10 },
];

interface ScenarioResult {
  scenario: string;
  ok: boolean;
  root: string;
  proofVerified: boolean;
  latency?: number;
  broadcastResult?: BroadcastResult;
  reconcileLatency?: number;
  error?: string;
}

async function runScenario(name: string, count: number, live: boolean): Promise<ScenarioResult> {
  console.log(`\n  ${name}`);

  // Generate synthetic leaves (BW-HARNESS-* prefix, never BW-)
  const leaves = await generateSyntheticLeaves(count);
  for (const leaf of leaves) {
    if (!leaf.verification_id.startsWith(HARNESS_PREFIX)) {
      return { scenario: name, ok: false, root: '', proofVerified: false, error: 'leaf_prefix_violation' };
    }
  }

  // Build the Merkle tree + proofs (reuses production pure modules)
  const { root, proofs } = await buildBatchTree(leaves);
  console.log(`    root: ${root.slice(0, 16)}… (${count} leaves)`);

  // Verify every proof round-trips against the root
  let allProofsOk = true;
  for (let i = 0; i < leaves.length; i++) {
    const ok = await verifyBatchProof(leaves[i].leaf, proofs[i], root);
    if (!ok) allProofsOk = false;
  }
  console.log(`    proofs: ${allProofsOk ? 'all verified' : 'FAILED'}`);

  // Build the batch payload (same format as production)
  const payload = buildBatchPayload(root, count);
  console.log(`    payload: ${payload.length} bytes`);

  if (!live) {
    console.log(`    [dry-run] no broadcast`);
    return { scenario: name, ok: allProofsOk, root, proofVerified: allProofsOk };
  }

  // LIVE: broadcast on Polygon Amoy
  const result = await broadcastBatchRoot({ rootHex: root, memberCount: count });

  if (!result.ok) {
    console.log(`    broadcast: FAILED — ${result.error}`);
    return { scenario: name, ok: false, root, proofVerified: allProofsOk, broadcastResult: result, error: result.error };
  }

  if ('receipt_pending' in result && result.receipt_pending) {
    console.log(`    broadcast: receipt_pending (tx ${result.transaction_hash.slice(0, 18)}…)`);
    // Reconcile at 4s + 4s (mirrors production Anchor Batch Flush)
    const reconcileStart = Date.now();
    await sleep(4000);
    let reconcileResult = await reconcileReceipt({ transactionHash: result.transaction_hash });
    if (!reconcileResult.ok || !reconcileResult.confirmed) {
      await sleep(4000);
      reconcileResult = await reconcileReceipt({ transactionHash: result.transaction_hash });
    }
    const reconcileLatency = Date.now() - reconcileStart;

    if (reconcileResult.ok && reconcileResult.confirmed) {
      const totalLatency = Date.now() - new Date(result.broadcast_at).getTime();
      console.log(`    reconciled: block ${reconcileResult.block_number} (${formatMs(totalLatency)})`);
      return {
        scenario: name,
        ok: true,
        root,
        proofVerified: allProofsOk,
        latency: totalLatency,
        reconcileLatency,
        broadcastResult: result,
      };
    }
    console.log(`    reconcile: failed after 2 retries`);
    return {
      scenario: name,
      ok: false,
      root,
      proofVerified: allProofsOk,
      broadcastResult: result,
      reconcileLatency,
      error: 'reconcile_failed',
    };
  }

  // Immediate confirmation (≤12s)
  if ('transaction_hash' in result) {
    console.log(`    confirmed: block ${result.block_number} (${formatMs(result.latency_ms)})`);
    return {
      scenario: name,
      ok: true,
      root,
      proofVerified: allProofsOk,
      latency: result.latency_ms,
      broadcastResult: result,
    };
  }

  return { scenario: name, ok: false, root, proofVerified: allProofsOk, broadcastResult: result, error: 'unknown_result' };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function printStats(label: string, stats: LatencyStats): void {
  console.log(`  ${label}:`);
  console.log(`    samples:  ${stats.count}`);
  console.log(`    fastest:  ${formatMs(stats.fastest)}`);
  console.log(`    median:   ${formatMs(stats.median)}`);
  console.log(`    p95:      ${formatMs(stats.p95)}`);
  console.log(`    slowest:   ${formatMs(stats.slowest)}`);
}

async function main() {
  console.log('═'.repeat(72));
  console.log('  Blockward Amoy Staging Harness');
  console.log(`  Mode: ${LIVE ? 'LIVE (will broadcast on Polygon Amoy)' : 'DRY RUN (no broadcast)'}`);
  console.log('═'.repeat(72));

  // ── Pre-flight checks ──────────────────────────────────────────────────
  console.log('\n  Pre-flight:');

  // 1. Config present?
  const resolved = resolveConfig();
  const configCheck = validateConfigPresent(resolved);
  console.log(`    config:   ${configCheck.ok ? 'present' : `MISSING (${resolved.ok === false ? resolved.missing.join(', ') : ''})`}`);

  if (LIVE) {
    if (!configCheck.ok) {
      console.log('\n  ✗ Cannot run live: staging secrets missing. See .env.example.');
      process.exit(1);
    }

    // 2. Signer address match (imports viem)
    const { privateKeyToAccount } = await import('viem/accounts');
    let signerOk = false;
    try {
      const account = privateKeyToAccount((resolved as any).config.signingKey as `0x${string}`);
      const signerCheck = validateSignerAddressMatch(account.address, (resolved as any).config.signerAddress);
      signerOk = signerCheck.ok;
      console.log(`    signer:    ${signerOk ? 'address match ✓' : 'ADDRESS MISMATCH ✗'}`);
    } catch {
      console.log(`    signer:    invalid private key ✗`);
    }
    if (!signerOk) {
      console.log('\n  ✗ Cannot run live: signer address mismatch.');
      process.exit(1);
    }

    // 3. Live chain-ID match
    const { probeChainId } = await import('./lib/broadcast.ts');
    const probe = await probeChainId();
    const chainOk = probe.ok && probe.is_amoy;
    console.log(`    chain:     ${chainOk ? `Amoy (80002) ✓` : `WRONG CHAIN (${probe.ok ? probe.chain_id : probe.error}) ✗`}`);
    if (!chainOk) {
      console.log('\n  ✗ Cannot run live: RPC is not Polygon Amoy.');
      process.exit(1);
    }
  } else {
    console.log(`    signer:    skipped (dry-run)`);
    console.log(`    chain:     skipped (dry-run)`);
  }

  // ── Run scenarios ──────────────────────────────────────────────────────
  console.log('\n  Scenarios:');
  const results: ScenarioResult[] = [];
  for (const scenario of SCENARIOS) {
    results.push(await runScenario(scenario.name, scenario.count, LIVE));
  }

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log('\n  ' + '─'.repeat(70));

  const allOk = results.every((r) => r.ok);
  const latencies = results
    .filter((r) => r.latency !== undefined)
    .map((r) => r.latency as number);

  if (LIVE && latencies.length > 0) {
    console.log('\n  Latency summary (submission-to-confirmation):');
    printStats('All scenarios', computeStats(latencies));
    for (const r of results) {
      console.log(`    ${r.scenario}: ${r.latency ? formatMs(r.latency) : 'n/a'}`);
    }
  }

  console.log('\n  ' + (allOk ? '✓ All offline checks passed.' : '✗ Some checks failed.'));
  if (!LIVE) {
    console.log('  Harness is ready for a separately authorised testnet performance run.');
    console.log('  Run `npx tsx harness.ts --live` with .env configured to measure latency.');
  }

  console.log('\n' + '═'.repeat(72));
  process.exit(allOk ? 0 : 1);
}

main().catch((e) => {
  console.error('Fatal:', safeLog(e));
  process.exit(1);
});