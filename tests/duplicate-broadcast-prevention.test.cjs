// Offline regression tests for duplicate-broadcast prevention.
//
// After remediation, AB-5FBCA1 is quarantined as ANCHOR_FAILED_PERMANENT while
// BW-H5CHBVHE is re-enqueued into a new ANCHOR_PENDING batch. This test proves:
//
//   1. The quarantined (PERMANENT) batch is NEVER claimed or rebroadcast — the
//      due filter excludes it before any signing occurs (pre-broadcast).
//   2. The credential is anchored through exactly one new batch.
//   3. Concurrent queue workers cannot broadcast duplicate anchors for the same
//      credential: the conditional claim-lock ensures only one worker claims a
//      batch, so only one broadcast occurs even under Promise.all concurrency.
//
// All assertions are offline: the broadcaster is a mock that counts calls and
// never touches an RPC. No production records, secrets or transactions are used.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');
const QUEUE = 'base44/shared/anchorQueue.ts';
const TX = '0x' + 'd'.repeat(64);
const A = '0x1111111111111111111111111111111111111111';

function fixtureCred(id, bwId) {
  return { id, bw_id: bwId, achievement_id: 'a1b2c3d4e5f6a7b8c9d0e1f2', holder_email: 'h@test.local',
    title: 'Dup Test', category: 'certification', description: 'synthetic', date_achieved: '2026-01-01',
    hash_version: 1, anchor_status: 'pending', blockchain: {}, event_log: [] };
}

function matches(rec, q) {
  for (const [k, cond] of Object.entries(q || {})) {
    if (cond && typeof cond === 'object' && !Array.isArray(cond)) {
      if ('$in' in cond) { if (!cond.$in.includes(rec[k])) return false; } else return false;
    } else if (rec[k] !== cond) return false;
  }
  return true;
}

function makeSvc(seed = {}) {
  const db = {
    AnchorBatch: (seed.batches || []).map(b => ({ created_date: b.created_at || new Date().toISOString(), attempts: 0, member_ids: [], member_count: 0, event_log: [], max_size: 500, ...b, id: b.id })),
    Credential: (seed.creds || []).map(c => ({ event_log: [], blockchain: {}, ...c, id: c.id })),
    Achievement: (seed.achievements || []).map(a => ({ status: 'issuer_confirmed', title: 'T', holder_email: 'h@test.local', event_log: [], credential_id: null, ...a, id: a.id })),
    Notification: [],
  };
  const col = (name) => ({
    async filter(q, opts = {}) { let rows = (db[name]||[]).filter(r => matches(r, q||{})); if (opts.sort === 'created_date') rows.sort((a,b) => String(a.created_date).localeCompare(String(b.created_date))); if (opts.sort === '-created_date') rows.sort((a,b) => String(b.created_date).localeCompare(String(a.created_date))); return { items: typeof opts.limit === 'number' ? rows.slice(0, opts.limit) : rows, next_cursor: null, has_more: false }; },
    async create(data) { const rec = { id: `${name}-n${db[name].length+1}`, created_date: new Date().toISOString(), ...data }; db[name].push(rec); return rec; },
    async update(id, data) { const rec = (db[name]||[]).find(r => r.id === id); if (rec) Object.assign(rec, data); return rec; },
    async updateMany(q, u) { let n = 0; for (const r of (db[name]||[])) if (matches(r, q||{})) { Object.assign(r, (u&&u.$set)||u); n++; } return { modified: n }; },
    async bulkUpdate(arr) { for (const { id, ...rest } of arr) { const rec = (db[name]||[]).find(r => r.id === id); if (rec) Object.assign(rec, rest); } return arr; },
  });
  return { entities: { AnchorBatch: col('AnchorBatch'), Credential: col('Credential'), Achievement: col('Achievement'), Notification: col('Notification') }, _db: db };
}

// Queue harness: mocked chainPolygon. The broadcaster mock counts every call
// and records which batch_ref it was invoked for, so tests can assert exactly
// one broadcast. verifyBatchRootOnChain returns a valid result so finalizeBatch
// completes the confirm path (proving prevention is pre-broadcast, not only
// at finalisation).
function queueHarness() {
  const env = Object.freeze({ ISSUER_PRIVATE_KEY: 'AMOY_TEST_STUB' });
  const state = { broadcasts: 0, broadcastFor: [] };
  const verifyCalls = [];
  const viem = { http: () => ({}), createPublicClient: () => ({ async getGasPrice() { return BigInt(30e9); }, async getTransactionReceipt() { return undefined; } }) };
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
          resolvePolygonConfig: () => ({ chain: {}, rpc: 'https://rpc.invalid', networkName: 'polygon_amoy', chainId: 80002, isTestnet: true, expectedSignerAddress: A }),
          anchorBatchRoot: async (o) => { state.broadcasts++; state.broadcastFor.push(o); return { ok: true, transaction_hash: TX, receipt_pending: false, block_number: 7, block_timestamp: new Date().toISOString(), gas_used: 25520, effective_gas_price_wei: String(BigInt(30e9)) }; },
          verifyBatchRootOnChain: async (target, txHash, root, memberCount) => { verifyCalls.push({ target, memberCount }); return { block_number: 7, block_timestamp: new Date().toISOString(), gas_used: 25520, effective_gas_price_wei: String(BigInt(30e9)) }; },
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

// ═══ 1. QUARANTINED (PERMANENT) BATCH IS NEVER REBROADCAST ═══
test('a permanently quarantined batch is never claimed or rebroadcast; the credential anchors via exactly one new batch', async () => {
  const { load, state } = queueHarness();
  const q = load(QUEUE);
  const svc = makeSvc({
    batches: [
      // The quarantined synthetic batch — PERMANENT, so the due filter excludes it.
      { id: 'b_old', batch_ref: 'AB-5FBCA1', status: 'ANCHOR_FAILED_PERMANENT', network: 'polygon_mainnet',
        member_ids: ['c1'], member_count: 1, transaction_hash: '0x8e2b02a5' + '0'.repeat(56),
        created_at: new Date(Date.now() - 600000).toISOString(), close_at: new Date(Date.now() - 300000).toISOString(),
        escalated_at: new Date(Date.now() - 300000).toISOString(), attempts: 1,
        event_log: [{ event: 'confirmed', note: 'synthetic', timestamp: '2026-10-21T15:21:29Z' }, { event: 'synthetic_confirmation_detected', note: 'quarantined', timestamp: '2026-10-21T18:51:04Z' }] },
      // The new batch — PENDING, holds the re-enqueued credential.
      { id: 'b_new', batch_ref: 'AB-NEW01', status: 'ANCHOR_PENDING', network: 'polygon_amoy',
        member_ids: ['c1'], member_count: 1,
        created_at: new Date(Date.now() - 5000).toISOString(), close_at: new Date(Date.now() - 1000).toISOString(),
        attempts: 0, event_log: [{ event: 'opened', note: '', timestamp: new Date().toISOString() }] },
    ],
    creds: [fixtureCred('c1', 'BW-H5CHBVHE')],
    achievements: [{ id: 'a1b2c3d4e5f6a7b8c9d0e1f2', credential_id: 'c1', title: 'T' }],
  });

  await q.processAnchorQueue(svc);

  assert.equal(state.broadcasts, 1, 'exactly one broadcast — the new batch only');
  assert.equal(state.broadcastFor.length, 1);
  assert.equal(state.broadcastFor[0].memberCount, 1);
  // The quarantined batch was never touched by the worker.
  const oldBatch = svc._db.AnchorBatch.find(b => b.batch_ref === 'AB-5FBCA1');
  assert.equal(oldBatch.status, 'ANCHOR_FAILED_PERMANENT', 'quarantined batch never reprocessed');
  assert.equal(oldBatch.attempts, 1, 'quarantined batch attempts unchanged');
  assert.ok(oldBatch.event_log.some(e => e.event === 'confirmed'), 'audit history preserved');
  assert.ok(oldBatch.event_log.some(e => e.event === 'synthetic_confirmation_detected'), 'quarantine event preserved');
  // The credential is confirmed via the new batch.
  const newBatch = svc._db.AnchorBatch.find(b => b.batch_ref === 'AB-NEW01');
  assert.equal(newBatch.status, 'ANCHOR_CONFIRMED', 'new batch anchored the credential');
  assert.equal(svc._db.Credential[0].anchor_status, 'confirmed', 'credential anchored exactly once');
  assert.equal(svc._db.Credential[0].blockchain.batch_ref, 'AB-NEW01', 'credential bound to the new batch');
});

// ═══ 2. CONCURRENT WORKERS — SAME BATCH (claim-lock) ═══
test('concurrent workers cannot claim the same batch twice — one broadcast only', async () => {
  const { load, state } = queueHarness();
  const q = load(QUEUE);
  const svc = makeSvc({
    batches: [{ id: 'b1', batch_ref: 'AB-CONC1', status: 'ANCHOR_PENDING', network: 'polygon_amoy',
      member_ids: ['c1'], member_count: 1,
      created_at: new Date(Date.now() - 5000).toISOString(), close_at: new Date(Date.now() - 1000).toISOString(),
      attempts: 0, event_log: [] }],
    creds: [fixtureCred('c1', 'BW-CONC1')],
    achievements: [{ id: 'a1b2c3d4e5f6a7b8c9d0e1f2', credential_id: 'c1', title: 'T' }],
  });

  // Two workers run the queue concurrently on the same shared DB.
  await Promise.all([
    q.processAnchorQueue(svc),
    q.processAnchorQueue(svc),
  ]);

  assert.equal(state.broadcasts, 1, 'exactly one broadcast under concurrent workers');
  assert.equal(svc._db.AnchorBatch[0].status, 'ANCHOR_CONFIRMED', 'batch confirmed exactly once');
  assert.equal(svc._db.Credential[0].anchor_status, 'confirmed', 'credential anchored exactly once');
});

// ═══ 3. CONCURRENT WORKERS — QUARANTINED + NEW BATCH ═══
test('concurrent workers with a quarantined + new batch broadcast exactly once for the credential', async () => {
  const { load, state } = queueHarness();
  const q = load(QUEUE);
  const svc = makeSvc({
    batches: [
      { id: 'b_old', batch_ref: 'AB-5FBCA1', status: 'ANCHOR_FAILED_PERMANENT', network: 'polygon_mainnet',
        member_ids: ['c1'], member_count: 1, transaction_hash: '0x8e2b02a5' + '0'.repeat(56),
        created_at: new Date(Date.now() - 600000).toISOString(), close_at: new Date(Date.now() - 300000).toISOString(),
        escalated_at: new Date(Date.now() - 300000).toISOString(), attempts: 1, event_log: [{ event: 'confirmed', note: 'synthetic', timestamp: '2026-10-21T15:21:29Z' }] },
      { id: 'b_new', batch_ref: 'AB-NEW02', status: 'ANCHOR_PENDING', network: 'polygon_amoy',
        member_ids: ['c1'], member_count: 1,
        created_at: new Date(Date.now() - 5000).toISOString(), close_at: new Date(Date.now() - 1000).toISOString(),
        attempts: 0, event_log: [] },
    ],
    creds: [fixtureCred('c1', 'BW-H5CHBVHE')],
    achievements: [{ id: 'a1b2c3d4e5f6a7b8c9d0e1f2', credential_id: 'c1', title: 'T' }],
  });

  await Promise.all([
    q.processAnchorQueue(svc),
    q.processAnchorQueue(svc),
  ]);

  assert.equal(state.broadcasts, 1, 'exactly one broadcast — quarantined batch excluded, new batch claimed once');
  const oldBatch = svc._db.AnchorBatch.find(b => b.batch_ref === 'AB-5FBCA1');
  assert.equal(oldBatch.status, 'ANCHOR_FAILED_PERMANENT', 'quarantined batch never reprocessed under concurrency');
  assert.equal(svc._db.Credential[0].anchor_status, 'confirmed', 'credential anchored exactly once');
  assert.equal(svc._db.Credential[0].blockchain.batch_ref, 'AB-NEW02', 'bound to the new batch');
});

// ═══ 4. PRE-BROADCAST PREVENTION — quarantined batch never reaches the broadcaster ═══
test('the quarantined batch never reaches the broadcaster (pre-broadcast prevention, not only finalisation)', async () => {
  const { load, state, verifyCalls } = queueHarness();
  const q = load(QUEUE);
  const svc = makeSvc({
    batches: [
      { id: 'b_old', batch_ref: 'AB-5FBCA1', status: 'ANCHOR_FAILED_PERMANENT', network: 'polygon_mainnet',
        member_ids: ['c1'], member_count: 1, transaction_hash: '0x8e2b02a5' + '0'.repeat(56),
        created_at: new Date(Date.now() - 600000).toISOString(), close_at: new Date(Date.now() - 300000).toISOString(),
        escalated_at: new Date(Date.now() - 300000).toISOString(), attempts: 1, event_log: [] },
    ],
    creds: [fixtureCred('c1', 'BW-H5CHBVHE')],
  });

  await q.processAnchorQueue(svc);

  assert.equal(state.broadcasts, 0, 'no broadcast — PERMANENT batch excluded from due filter before any signing');
  assert.equal(verifyCalls.length, 0, 'no finalisation attempt — prevention is pre-broadcast');
  const oldBatch = svc._db.AnchorBatch[0];
  assert.equal(oldBatch.status, 'ANCHOR_FAILED_PERMANENT', 'batch unchanged');
  assert.equal(svc._db.Credential[0].anchor_status, 'pending', 'credential never touched by the quarantined batch');
});