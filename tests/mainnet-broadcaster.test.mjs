// Completely offline: synthetic wallet, mocked RPC/broadcast, temporary journal.
// Never invoke the CLI's --prepare or --broadcast actions in this suite.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Wallet, Transaction, keccak256 } from 'ethers';
import { mkdtempSync, readdirSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { COMMITMENT, prepareIntegration, executeIntegration, authorizationFor,
  verifyExecutedTransaction, fileJournal } from '../scripts/polygon-mainnet-integration.mjs';

const syntheticWallet = Wallet.createRandom();
const OTHER = '0x2222222222222222222222222222222222222222';
const NOW = 1700000000000;
const BLOCK = '0x' + 'b'.repeat(64);
function fixture(options = {}) {
  const calls = [], states = [];
  let sentTx, receipt, claimed = false;
  const config = { expectedAddress: syntheticWallet.address, normalNetwork: 'polygon_amoy', ...options.config };
  const io = {};
  const actions = {
    chainId: () => options.chain ?? 137,
    address: () => options.address ?? syntheticWallet.address,
    code: () => options.code ?? '0x',
    nonce: (_a, tag) => tag === 'pending' ? (options.pendingNonce ?? 0) : (options.nonce ?? 0),
    balance: () => options.balance ?? 1000000000000000000n,
    estimateGas: () => options.gas ?? 22000n,
    fees: () => options.fees ?? { maxFeePerGas: 30000000000n, maxPriorityFeePerGas: 1000000000n },
    sign: async tx => syntheticWallet.signTransaction({ ...tx, ...options.signed }),
    broadcast: raw => {
      const tx = Transaction.from(raw), hash = keccak256(raw);
      sentTx = { hash, chainId: tx.chainId, type: tx.type, nonce: tx.nonce,
        from: tx.from, to: tx.to, value: tx.value, data: tx.data, gasLimit: tx.gasLimit,
        maxFeePerGas: tx.maxFeePerGas, maxPriorityFeePerGas: tx.maxPriorityFeePerGas,
        blockNumber: 10, blockHash: BLOCK, ...options.tx };
      receipt = { hash, status: 1, from: tx.from, to: tx.to, blockNumber: 10, blockHash: BLOCK,
        gasUsed: 22000n, gasPrice: 1000000000n, ...options.receipt };
      if (options.broadcastAmbiguous) throw new Error('Synthetic transport timeout');
      return options.broadcastHash ?? hash;
    },
    waitReceipt: () => ({ status: options.waitStatus ?? 1 }),
    transaction: () => sentTx,
    receipt: () => receipt,
  };
  for (const [name, fn] of Object.entries(actions)) io[name] = async (...args) => {
    calls.push(name);
    if (options.fail === name) throw new Error('Synthetic failure');
    return fn(...args);
  };
  const journal = { reserve() {
    assert.equal(claimed, false, 'one-shot lock already exists');
    claimed = true; states.push({ state: 'reserved' });
    return { record: state => states.push(state), close: () => {} };
  } };
  return { io, config, calls, states, journal };
}
const prepare = f => prepareIntegration(f.io, f.config, { now: () => NOW, challenge: () => 'a'.repeat(64) });
const execute = (f, plan, auth = authorizationFor(plan), now = NOW) =>
  executeIntegration(f.io, f.config, plan, auth, f.journal, { now: () => now });

test('prepare is read-only and contains exactly the synthetic zero-value bounded transaction', async () => {
  const f = fixture(), plan = await prepare(f);
  assert.equal(plan.chainId, 137); assert.equal(plan.from, plan.to); assert.equal(plan.value, '0');
  assert.equal(plan.data, COMMITMENT); assert.match(plan.data, /^0x[0-9a-f]{64}$/);
  assert.equal(plan.gas, '26400'); assert.equal(plan.feeCeilingWei, '1000000000000000');
  assert(!f.calls.includes('sign')); assert(!f.calls.includes('broadcast'));
});
test('authorized execution sends once and independently validates the mined transaction', async () => {
  const f = fixture(), plan = await prepare(f), result = await execute(f, plan);
  assert.match(result.hash, /^0x[0-9a-f]{64}$/);
  assert.equal(f.calls.filter(c => c === 'broadcast').length, 1);
  assert(f.calls.includes('transaction') && f.calls.includes('receipt'));
  assert.deepEqual(f.states.map(s => s.state), ['reserved', 'signed', 'broadcast', 'confirmed']);
  const signedIndex = f.states.findIndex(s => s.state === 'signed');
  assert.equal(f.states[signedIndex].hash, result.hash);
  await assert.rejects(execute(f, plan));
  assert.equal(f.calls.filter(c => c === 'broadcast').length, 1);
});
for (const [name, options] of [
  ['wrong live chain', { chain: 80002 }], ['wrong configured chain', { config: { chainId: '1' } }],
  ['normal issuance mainnet', { config: { normalNetwork: 'mainnet' } }],
  ['wrong derived signer', { address: OTHER }], ['invalid expected address', { config: { expectedAddress: 'invalid' } }],
  ['self address has code', { code: '0x1234' }], ['pending transaction', { pendingNonce: 1 }],
  ['insufficient funds', { balance: 1n }], ['zero gas estimate', { gas: 0n }],
  ['fees above ceiling', { fees: { maxFeePerGas: 100000000000n, maxPriorityFeePerGas: 1n } }],
  ['priority fee above max', { fees: { maxFeePerGas: 1n, maxPriorityFeePerGas: 2n } }],
  ...['0', '-1', '1e-3', 'NaN', '0.010000000000000001', '1'].map(maxFeePol => ['invalid ceiling ' + maxFeePol, { config: { maxFeePol } }]),
  ...['chainId', 'address', 'code', 'nonce', 'balance', 'estimateGas', 'fees'].map(fail => ['failed RPC ' + fail, { fail }]),
]) test('preparation rejects ' + name, async () => {
  const f = fixture(options); await assert.rejects(prepare(f));
  assert(!f.calls.includes('sign')); assert(!f.calls.includes('broadcast'));
});
for (const [name, mutate] of [
  ['chain', p => { p.chainId = 1; }], ['recipient', p => { p.to = OTHER; }],
  ['sender', p => { p.from = OTHER; }], ['value', p => { p.value = '1'; }],
  ['commitment', p => { p.data = '0x' + 'f'.repeat(64); }],
  ['nonce', p => { p.nonce = 1; }], ['fee ceiling', p => { p.feeCeilingWei = '1000000000000000000'; }],
  ['gas limit', p => { p.gas = '10000000'; }], ['priority fee', p => { p.maxPriorityFeePerGas = '999999999999999'; }],
  ['fee units', p => { p.maxFeePerGas = '3e10'; }], ['expired plan', p => { p.createdAt -= 600000; p.expiresAt -= 600000; }],
  ['future plan', p => { p.createdAt += 600000; p.expiresAt += 600000; }],
  ['long-lived plan', p => { p.expiresAt += 600000; }], ['wrong test ID', p => { p.integration_id = 'another'; }],
]) test('execution rejects ' + name + ' even with a recomputed public authorization value', async () => {
  const f = fixture(), p = await prepare(f); mutate(p);
  await assert.rejects(execute(f, p));
  assert(!f.calls.includes('sign')); assert(!f.calls.includes('broadcast'));
});
test('absent/incorrect authorization cannot sign, broadcast or consume a lock', async () => {
  const f = fixture(), p = await prepare(f);
  for (const auth of ['', 'yes', '0'.repeat(64)]) await assert.rejects(execute(f, p, auth));
  assert(!f.calls.includes('sign')); assert.equal(f.states.length, 0);
});
test('fresh higher gas estimate requires a new reviewed plan', async () => {
  const f = fixture(), p = await prepare(f); f.io.estimateGas = async () => 23000n;
  await assert.rejects(execute(f, p), /FRESH_ESTIMATE_EXCEEDS_PLAN/);
  assert(!f.calls.includes('sign'));
});
test('balance must cover approved upper bound even when fresh fee estimate falls', async () => {
  const f = fixture(), p = await prepare(f);
  f.io.fees = async () => ({ maxFeePerGas: 2n, maxPriorityFeePerGas: 1n });
  f.io.balance = async () => 100000n;
  await assert.rejects(execute(f, p), /INSUFFICIENT_BALANCE/);
});
test('chain change immediately before signing aborts with consumed lock', async () => {
  const f = fixture(), p = await prepare(f); let n = 0;
  f.io.chainId = async () => ++n === 1 ? 137 : 80002;
  await assert.rejects(execute(f, p), /LIVE_CHAIN_NOT_137/);
  assert(!f.calls.includes('sign')); assert(!f.calls.includes('broadcast'));
  assert.equal(f.states.at(-1).state, 'stopped_manual_reconciliation_required');
});
test('unexpected signed transaction cannot be broadcast', async () => {
  const f = fixture({ signed: { to: OTHER } }), p = await prepare(f);
  await assert.rejects(execute(f, p), /SIGNED_TRANSACTION_MISMATCH/);
  assert(!f.calls.includes('broadcast'));
});
test('ambiguous broadcast is never retried and preserves signed hash for manual reconciliation', async () => {
  const f = fixture({ broadcastAmbiguous: true }), p = await prepare(f);
  await assert.rejects(execute(f, p)); await assert.rejects(execute(f, p));
  assert.equal(f.calls.filter(c => c === 'broadcast').length, 1);
  assert.match(f.states.at(-1).hash, /^0x[0-9a-f]{64}$/);
});
for (const [name, options] of [
  ['wrong sender', { tx: { from: OTHER } }], ['wrong recipient', { tx: { to: OTHER } }],
  ['wrong tx chain', { tx: { chainId: 1n } }], ['nonzero value', { tx: { value: 1n } }],
  ['wrong commitment', { tx: { data: '0x00' } }], ['wrong nonce', { tx: { nonce: 1 } }],
  ['unmined tx', { tx: { blockNumber: null } }], ['wrong block', { receipt: { blockHash: '0x' + 'c'.repeat(64) } }],
  ['failed receipt', { receipt: { status: 0 } }], ['failed wait receipt', { waitStatus: 0 }],
  ['receipt fee above limit', { receipt: { gasPrice: 1000000000000n } }],
  ['receipt timeout', { fail: 'waitReceipt' }], ['receipt RPC failure', { fail: 'receipt' }],
]) test('post-broadcast verification rejects ' + name + ' without retrying send', async () => {
  const f = fixture(options), p = await prepare(f);
  await assert.rejects(execute(f, p));
  assert.equal(f.calls.filter(c => c === 'broadcast').length, 1);
  assert.equal(f.states.at(-1).state, 'stopped_manual_reconciliation_required');
});
test('independent receipt verification rejects a different live chain', async () => {
  const f = fixture(), p = await prepare(f), result = await execute(f, p);
  f.io.chainId = async () => 1;
  await assert.rejects(verifyExecutedTransaction(f.io, p, result.hash), /POST_BROADCAST_WRONG_CHAIN/);
});
test('durable journal refuses repeat execution even through a new journal instance', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'blockward-offline-journal-'));
  try {
    const p = await prepare(fixture());
    const lock = fileJournal(dir).reserve(p);
    lock.record({ state: 'signed', hash: '0x' + 'a'.repeat(64) }); lock.close();
    assert.throws(() => fileJournal(dir).reserve(p), /ONE_SHOT_JOURNAL_EXISTS_OR_UNAVAILABLE/);
  } finally {
    // Delete only this test's flat journal file; never recursively delete paths.
    for (const name of readdirSync(dir)) unlinkSync(join(dir, name));
    rmdirSync(dir);
  }
});
