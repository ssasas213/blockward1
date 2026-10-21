// Offline regression tests for the production finalisation security fix.
// A mock, synthetic or missing transaction can NEVER result in ANCHOR_CONFIRMED.
// Every confirmed batch requires a genuine transaction receipt independently
// retrieved and verified against the live Polygon chain (verifyBatchRootOnChain).
// Covers: mock injection on mainnet, nonexistent receipts, invalid transaction
// payloads, wrong sender/chain/value/root, and public verification integrity.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto, createHash } = require('node:crypto');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');
const QUEUE = 'base44/shared/anchorQueue.ts';
const POLYGON = 'base44/shared/chainPolygon.ts';
const TX = '0x' + 'a'.repeat(64);
const SYNTHETIC_TX = '0x8e2b02a5' + '0'.repeat(56); // the AB-5FBCA1 signature
const A = '0x1111111111111111111111111111111111111111';
const B = '0x2222222222222222222222222222222222222222';
const hex = (s) => '0x' + Buffer.from(s, 'utf8').toString('hex');
const ROOT_HASH = createHash('sha256').update('security-test-root').digest('hex');
const batchPayload = (root, n) => JSON.stringify({ v: 1, t: 'blockward-batch', hv: 1, n, r: root });

function fixtureCred(id, n) {
  return { id, bw_id: `BW-SEC${n}`, achievement_id: 'a' + n, holder_email: `h${n}@test.local`,
    title: `Security Test ${n}`, category: 'certification', description: 'synthetic',
    date_achieved: '2026-01-01', hash_version: 1, anchor_status: 'verified', blockchain: {}, event_log: [] };
}
const fixtureBatch = (over = {}) => ({
  id: 'b1', batch_ref: 'AB-SEC01', status: 'ANCHOR_PENDING', network: 'polygon_amoy',
  member_ids: ['c1'], member_count: 1, max_size: 500,
  created_at: new Date(Date.now() - 60000).toISOString(), close_at: new Date(Date.now() - 1000).toISOString(),
  attempts: 0, event_log: [], ...over,
});
function matches(rec, q) {
  for (const [k, cond] of Object.entries(q)) {
    if (cond && typeof cond === 'object' && !Array.isArray(cond)) { if ('$in' in cond) { if (!cond.$in.includes(rec[k])) return false; } else return false; }
    else if (rec[k] !== cond) return false;
  }
  return true;
}
function makeSvc(seed = {}) {
  const db = {
    AnchorBatch: (seed.batches || []).map(b => ({ created_date: b.created_at || new Date().toISOString(), attempts: 0, member_ids: [], member_count: 0, event_log: [], ...b, id: b.id || 'b1' })),
    Credential: (seed.creds || []).map(c => ({ event_log: [], blockchain: {}, ...c, id: c.id })),
    Achievement: (seed.achievements || []).map(a => ({ status: 'issuer_confirmed', title: 'T', holder_email: 'h@test.local', event_log: [], credential_id: null, ...a, id: a.id })),
    Notification: [],
  };
  const col = (name) => ({
    async filter(q, opts = {}) { let rows = (db[name]||[]).filter(r => matches(r, q||{})); if (opts.sort === '-created_date') rows.sort((a,b) => String(b.created_date).localeCompare(String(a.created_date))); return { items: typeof opts.limit === 'number' ? rows.slice(0, opts.limit) : rows, next_cursor: null, has_more: false }; },
    async create(data) { const rec = { id: `${name}-n${db[name].length+1}`, created_date: new Date().toISOString(), ...data }; db[name].push(rec); return rec; },
    async update(id, data) { const rec = (db[name]||[]).find(r => r.id === id); if (rec) Object.assign(rec, data); return rec; },
    async updateMany(q, u) { let n = 0; for (const r of (db[name]||[])) if (matches(r, q||{})) { Object.assign(r, (u&&u.$set)||u); n++; } return { modified: n }; },
    async bulkUpdate(arr) { for (const { id, ...rest } of arr) { const rec = (db[name]||[]).find(r => r.id === id); if (rec) Object.assign(rec, rest); } return arr; },
  });
  return { entities: { AnchorBatch: col('AnchorBatch'), Credential: col('Credential'), Achievement: col('Achievement'), Notification: col('Notification') }, _db: db };
}

// ── Queue harness: mocked chainPolygon with controllable verifyBatchRootOnChain ──
function queueHarness(options = {}) {
  const env = Object.freeze({ ISSUER_PRIVATE_KEY: 'AMOY_TEST_STUB', ...options.env });
  const state = { gasGwei: 30, broadcasts: 0, mockCalls: [] };
  const verifyCalls = [];
  const viem = { http: () => ({}), createPublicClient: () => ({ async getGasPrice() { return BigInt(Math.round(state.gasGwei * 1e9)); }, async getTransactionReceipt() { return undefined; } }) };
  const cache = {};
  function load(file) {
    if (cache[file]) return cache[file];
    const output = {}; cache[file] = output;
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert.equal(ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true).parseDiagnostics.length, 0, file + ' must parse');
    const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(js, {
      exports: output, Response, TextEncoder, TextDecoder, Uint8Array, crypto: webcrypto, AbortSignal,
      fetch: async () => { throw new Error('offline'); }, Deno: { env: { get: (k) => env[k] } }, console: { log: () => {} },
      require: (id) => {
        if (id === 'npm:viem@2.7.0') return viem;
        if (id.startsWith('npm:@base44/sdk')) return { createClientFromRequest: () => ({}) };
        if (id === 'base44:runtime') return { secrets: { get: () => '' } };
        if (id.endsWith('/chainPolygon.ts')) return {
          resolvePolygonTarget: () => ({ target: 'polygon_amoy' }),
          resolvePolygonConfig: () => ({ chain: {}, rpc: 'https://rpc.invalid', networkName: options.networkName || 'polygon_amoy', chainId: options.chainId || 80002, isTestnet: options.isTestnet !== false, expectedSignerAddress: A }),
          anchorBatchRoot: async (o) => { state.broadcasts++; state.mockCalls.push(o); return options.broadcast ? options.broadcast(o) : { ok: true, transaction_hash: options.broadcastTx || TX, receipt_pending: false, block_number: 7, block_timestamp: new Date().toISOString(), gas_used: 25520, effective_gas_price_wei: String(BigInt(Math.round(state.gasGwei * 1e9))) }; },
          verifyBatchRootOnChain: async (target, txHash, root, memberCount) => { verifyCalls.push({ target, txHash: String(txHash).slice(0, 10), memberCount }); return options.verifyResult === null ? null : { block_number: 7, block_timestamp: new Date().toISOString(), gas_used: 25520, effective_gas_price_wei: String(BigInt(Math.round(state.gasGwei * 1e9))) }; },
          BATCH_ANCHOR_VERSION: 2,
        };
        if (id.endsWith('/chainVerification.ts')) return { verificationBindings: () => ({}) };
        if (id.endsWith('/emailDelivery.ts')) return { sendTrackedEmail: async () => ({ ok: true }) };
        if (id.endsWith('/issuerEmails.ts')) return { holderVerifiedEmail: () => ({ subject: 's', html: 'h' }) };
        if (id.endsWith('/verificationFlow.ts')) return { notifyHolder: async () => {}, appBaseUrl: () => 'https://test.local' };
        if (id.endsWith('/anchorAlerts.ts')) return { notifyAnchorAdmins: async () => {} };
        if (id.endsWith('/gasFeeMonitor.ts')) return { runGasFeeMonitoring: async () => {} };
        if (id.startsWith('.')) return load(path.posix.normalize(path.posix.join(path.posix.dirname(file), id)));
        throw new Error('Forbidden import: ' + id);
      },
    }, { timeout: 1000 });
    return output;
  }
  return { load, state, verifyCalls };
}

// ── Chain harness: REAL chainPolygon with a mocked viem public client ──
function chainHarness(options = {}) {
  const env = Object.freeze({ ISSUER_PRIVATE_KEY: 'AMOY_TEST_STUB', POLYGON_MAINNET_ISSUER_PRIVATE_KEY: 'MAINNET_TEST_STUB', POLYGON_MAINNET_ANCHOR_ADDRESS: B, POLYGON_MAINNET_RPC_URL: 'https://mainnet.invalid', ...options.env });
  const tx = { hash: TX, blockNumber: 1n, blockHash: '0x' + 'b'.repeat(64), from: A, to: A, value: 0n, chainId: options.chain ?? 80002, input: hex(batchPayload(ROOT_HASH, options.memberCount ?? 1)), ...options.tx };
  const receipt = { transactionHash: TX, blockNumber: 1n, blockHash: '0x' + 'b'.repeat(64), status: 'success', from: A, to: A, gasUsed: 25520n, effectiveGasPrice: 30000000000n, blockTimestamp: 1716000000n, ...options.receipt };
  const publicClient = new Proxy({}, { get: (_, method) => async () => {
    if (options.fail === method) throw new Error('RPC failure');
    switch (method) {
      case 'getChainId': return options.chain ?? 80002;
      case 'getTransaction': return options.noTx ? null : tx;
      case 'getTransactionReceipt': return options.noReceipt ? null : receipt;
      default: throw new Error('Forbidden RPC: ' + method);
    }
  } });
  const viem = { http: () => ({}), createPublicClient: () => publicClient, defineChain: (x) => x, stringToHex: hex, isAddress: (x) => /^0x[0-9a-fA-F]{40}$/.test(x), getAddress: (x) => x };
  const cache = {};
  function load(file) {
    if (cache[file]) return cache[file];
    const output = {}; cache[file] = output;
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert.equal(ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true).parseDiagnostics.length, 0, file + ' must parse');
    const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(js, {
      exports: output, Response, TextEncoder, TextDecoder, Uint8Array, crypto: webcrypto,
      Deno: { env: { get: (k) => env[k] } }, console: { log: () => {} },
      require: (id) => {
        if (id === 'npm:viem@2.7.0') return viem;
        if (id === 'npm:viem@2.7.0/accounts') return { privateKeyToAccount: (k) => { if (k === 'AMOY_TEST_STUB') return { address: A }; if (k === 'MAINNET_TEST_STUB') return { address: B }; throw new Error('bad key'); } };
        if (id.startsWith('npm:@base44/sdk')) return { createClientFromRequest: () => ({}) };
        if (id === 'ethers') return require('ethers');
        if (id.startsWith('.')) return load(path.posix.normalize(path.posix.join(path.posix.dirname(file), id)));
        throw new Error('Forbidden import: ' + id);
      },
    }, { timeout: 1000 });
    return output;
  }
  return { load };
}

// ═══ 1. MOCK BROADCASTER ON MAINNET IS BLOCKED ═══
test('mock broadcaster on a mainnet batch is blocked before any broadcast', async () => {
  const { load, state } = queueHarness({ networkName: 'polygon', chainId: 137, isTestnet: false });
  const q = load(QUEUE);
  const svc = makeSvc({ batches: [fixtureBatch({ network: 'polygon_mainnet', batch_ref: 'AB-M1' })], creds: [fixtureCred('c1', 1)] });
  const mockBroadcaster = async () => ({ ok: true, transaction_hash: SYNTHETIC_TX, block_number: 12345678, gas_used: 26000, effective_gas_price_wei: '1000000000' });
  await q.processAnchorQueue(svc, { forceBatchRef: 'AB-M1', broadcaster: mockBroadcaster });
  const batch = svc._db.AnchorBatch[0];
  assert.equal(batch.status, 'ANCHOR_FAILED_PERMANENT');
  assert.equal(batch.last_error, 'mock_broadcaster_blocked_on_mainnet');
  assert.equal(state.broadcasts, 0, 'no broadcast occurred');
  assert.notEqual(svc._db.Credential[0].anchor_status, 'confirmed');
});

// ═══ 2. SYNTHETIC / NONEXISTENT RECEIPT CANNOT CONFIRM ═══
test('a synthetic transaction hash (AB-5FBCA1 signature) cannot confirm', async () => {
  const { load, verifyCalls } = queueHarness({ verifyResult: null, broadcastTx: SYNTHETIC_TX });
  const q = load(QUEUE);
  const svc = makeSvc({ batches: [fixtureBatch({ batch_ref: 'AB-S2' })], creds: [fixtureCred('c1', 1)] });
  await q.processAnchorQueue(svc);
  assert.notEqual(svc._db.AnchorBatch[0].status, 'ANCHOR_CONFIRMED');
  assert.equal(verifyCalls.length, 1, 'finalizeBatch independently verified on-chain');
  assert.notEqual(svc._db.Credential[0].anchor_status, 'confirmed');
});

test('a broadcast whose receipt cannot be verified does not confirm', async () => {
  const { load } = queueHarness({ verifyResult: null });
  const q = load(QUEUE);
  const svc = makeSvc({ batches: [fixtureBatch({ batch_ref: 'AB-S3' })], creds: [fixtureCred('c1', 1)] });
  await q.processAnchorQueue(svc);
  assert.notEqual(svc._db.AnchorBatch[0].status, 'ANCHOR_CONFIRMED');
  assert.notEqual(svc._db.Credential[0].anchor_status, 'confirmed');
});

// ═══ 3. POSITIVE CONTROL — A GENUINE VERIFIED RECEIPT CONFIRMS ═══
test('a genuine independently verified receipt confirms', async () => {
  const { load } = queueHarness({ verifyResult: undefined });
  const q = load(QUEUE);
  const svc = makeSvc({ batches: [fixtureBatch({ batch_ref: 'AB-S4' })], creds: [fixtureCred('c1', 1)], achievements: [{ id: 'a1', credential_id: 'c1', title: 'T' }] });
  const summary = await q.processAnchorQueue(svc);
  assert.equal(svc._db.AnchorBatch[0].status, 'ANCHOR_CONFIRMED');
  assert.equal(summary.confirmed, 1);
  assert.equal(svc._db.Credential[0].anchor_status, 'confirmed');
  assert.equal(svc._db.Credential[0].chain_check.status, 'confirmed');
  assert.equal(svc._db.Achievement[0].status, 'verified');
});

// ═══ 4. verifyBatchRootOnChain — the independent on-chain gate (real module) ═══
test('verifyBatchRootOnChain confirms a genuine batch root commitment', async () => {
  const { load } = chainHarness({});
  const verified = await load(POLYGON).verifyBatchRootOnChain('polygon_amoy', TX, ROOT_HASH, 1);
  assert.ok(verified);
  assert.equal(verified.gas_used, 25520);
});

test('verifyBatchRootOnChain rejects a nonexistent transaction', async () => {
  assert.equal(await chainHarness({ noTx: true }).load(POLYGON).verifyBatchRootOnChain('polygon_amoy', TX, ROOT_HASH, 1), null);
});

test('verifyBatchRootOnChain rejects a failed receipt', async () => {
  assert.equal(await chainHarness({ receipt: { status: 'reverted' } }).load(POLYGON).verifyBatchRootOnChain('polygon_amoy', TX, ROOT_HASH, 1), null);
});

test('verifyBatchRootOnChain rejects an invalid calldata payload (wrong root)', async () => {
  assert.equal(await chainHarness({ tx: { input: hex(batchPayload('0'.repeat(64), 1)) } }).load(POLYGON).verifyBatchRootOnChain('polygon_amoy', TX, ROOT_HASH, 1), null);
});

test('verifyBatchRootOnChain rejects a wrong member count in the calldata', async () => {
  assert.equal(await chainHarness({ memberCount: 5 }).load(POLYGON).verifyBatchRootOnChain('polygon_amoy', TX, ROOT_HASH, 1), null);
});

test('verifyBatchRootOnChain rejects a wrong sender', async () => {
  assert.equal(await chainHarness({ tx: { from: B }, receipt: { from: B } }).load(POLYGON).verifyBatchRootOnChain('polygon_amoy', TX, ROOT_HASH, 1), null);
});

test('verifyBatchRootOnChain rejects a nonzero value', async () => {
  assert.equal(await chainHarness({ tx: { value: 1n } }).load(POLYGON).verifyBatchRootOnChain('polygon_amoy', TX, ROOT_HASH, 1), null);
});

test('verifyBatchRootOnChain rejects a wrong live chain ID', async () => {
  assert.equal(await chainHarness({ chain: 137 }).load(POLYGON).verifyBatchRootOnChain('polygon_amoy', TX, ROOT_HASH, 1), null);
});

test('verifyBatchRootOnChain rejects a malformed calldata payload', async () => {
  assert.equal(await chainHarness({ tx: { input: '0x00' } }).load(POLYGON).verifyBatchRootOnChain('polygon_amoy', TX, ROOT_HASH, 1), null);
});

// ═══ 5. PUBLIC VERIFICATION INTEGRITY — a synthetic tx is rejected ═══
test('the synthetic AB-5FBCA1 transaction hash fails independent on-chain verification', async () => {
  // A synthetic hash (root prefix + zeros) does not exist on any chain — the
  // gate returns null, so finalizeBatch cannot confirm and the public verify
  // path returns anchor_invalid / transaction_not_found.
  assert.equal(await chainHarness({ noTx: true }).load(POLYGON).verifyBatchRootOnChain('polygon_mainnet', SYNTHETIC_TX, ROOT_HASH, 1), null);
});