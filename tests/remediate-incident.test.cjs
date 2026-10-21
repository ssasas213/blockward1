// Offline regression tests for the incident remediation module (Phase 1).
// Verifies: preview returns the exact plan without writes; execute quarantines
// the batch, reverts the credential + achievement, re-enqueues, and sends the
// correction notification; a second execute is idempotent (no double-write).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');
const REMEDIATION = 'base44/shared/incidentRemediation.ts';

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
    AnchorBatch: (seed.batches || []).map(b => ({ event_log: [], member_ids: [], member_count: 0, ...b })),
    Credential: (seed.creds || []).map(c => ({ event_log: [], blockchain: {}, ...c })),
    Achievement: (seed.achievements || []).map(a => ({ event_log: [], ...a })),
  };
  const col = (name) => ({
    async filter(q, opts = {}) { let rows = (db[name] || []).filter(r => matches(r, q || {})); return { items: typeof opts.limit === 'number' ? rows.slice(0, opts.limit) : rows, next_cursor: null, has_more: false }; },
    async get(id) { return (db[name] || []).find(r => r.id === id) || null; },
    async update(id, data) { const rec = (db[name] || []).find(r => r.id === id); if (rec) Object.assign(rec, data); return rec; },
  });
  return { entities: { AnchorBatch: col('AnchorBatch'), Credential: col('Credential'), Achievement: col('Achievement') }, _db: db };
}

function fixtureBatch(over = {}) {
  return { id: 'b1', batch_ref: 'AB-5FBCA1', status: 'ANCHOR_CONFIRMED', network: 'polygon_mainnet',
    member_ids: ['c1'], member_count: 1, transaction_hash: '0x8e2b02a500000000000000000000000000000000000000000000000000000000',
    merkle_root: '8e2b02a56519e4225cbf10c02028481a3394b194ee57ec13f2cb5d8d7e5b932b',
    confirmed_at: '2026-10-21T15:21:28.582Z', attempts: 1,
    event_log: [{ event: 'confirmed', note: '1 credentials anchored', timestamp: '2026-10-21T15:21:29.546Z' }], ...over };
}
function fixtureCred(over = {}) {
  return { id: 'c1', bw_id: 'BW-H5CHBVHE', achievement_id: 'a1b2c3d4e5f6a7b8c9d0e1f2',
    holder_email: 'holder@test.net', title: 'testachievement', status: 'active',
    anchor_status: 'confirmed', hash_version: 1,
    blockchain: { status: 'confirmed', network: 'polygon_mainnet', chain_id: 137, batch_ref: 'AB-5FBCA1', transaction_hash: '0x8e2b02a500000000000000000000000000000000000000000000000000000000', merkle_leaf_index: 0, merkle_proof: [{ position: 'right', hash: 'a'.repeat(64) }], batch_root: '8e2b02a56519e4225cbf10c02028481a3394b194ee57ec13f2cb5d8d7e5b932b' },
    chain_check: { status: 'confirmed', verification_version: 1, checked_at: '2026-10-21T15:21:30Z' },
    event_log: [{ event: 'blockchain_confirmed', note: 'anchor confirmed', timestamp: '2026-10-21T15:21:28.582Z' }], ...over };
}
function fixtureAch(over = {}) {
  return { id: 'a1b2c3d4e5f6a7b8c9d0e1f2', status: 'verified', title: 'testachievement',
    holder_email: 'holder@test.net', credential_id: 'c1',
    event_log: [{ event: 'verified', note: 'Blockward Verified', timestamp: '2026-10-21T15:21:28.582Z' }], ...over };
}

// Loader that stubs the heavy imports (anchorQueue, emailDelivery, verificationFlow).
function loadRemediation() {
  const cache = {};
  function load(file) {
    if (cache[file]) return cache[file];
    const output = {}; cache[file] = output;
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert.equal(ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true).parseDiagnostics.length, 0, file + ' must parse');
    const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(js, {
      exports: output, crypto: webcrypto, console: { log: () => {} },
      require: (id) => {
        if (id.endsWith('/anchorQueue.ts')) return { enqueueCredentialForAnchoring: async () => ({ ok: true, queued: true, batch_ref: 'AB-NEW01' }) };
        if (id.endsWith('/emailDelivery.ts')) return { sendTrackedEmail: async () => ({ ok: true }) };
        if (id.endsWith('/verificationFlow.ts')) return { appBaseUrl: () => 'https://blockward.me', notifyHolder: async () => {} };
        if (id === 'base44:runtime') return { secrets: { get: () => null } };
        throw new Error('Forbidden import: ' + id);
      },
    }, { timeout: 1000 });
    return output;
  }
  return load(REMEDIATION);
}

test('previewRemediation returns the exact plan without writing any records', async () => {
  const svc = makeSvc({ batches: [fixtureBatch()], creds: [fixtureCred()], achievements: [fixtureAch()] });
  const snapshot = JSON.stringify(svc._db);
  const r = await loadRemediation().previewRemediation(svc, { batchRef: 'AB-5FBCA1', bwId: 'BW-H5CHBVHE', deps: { baseUrl: 'https://blockward.me' } });
  assert.equal(r.ok, true);
  assert.equal(r.mode, 'preview');
  assert.equal(r.approved, false);
  assert.equal(r.plan.batch.target_status, 'ANCHOR_FAILED_PERMANENT');
  assert.equal(r.plan.credential.target_anchor_status, 'pending');
  assert.equal(r.plan.achievement.target_status, 'issuer_confirmed');
  assert.ok(r.plan.notification.subject.includes('Correction'));
  assert.equal(JSON.stringify(svc._db), snapshot, 'no writes occurred');
});

test('executeRemediation quarantines batch, reverts credential + achievement, re-enqueues and sends correction', async () => {
  const svc = makeSvc({ batches: [fixtureBatch()], creds: [fixtureCred()], achievements: [fixtureAch()] });
  let enqueued = null, emailed = null;
  const r = await loadRemediation().executeRemediation(svc, {
    batchRef: 'AB-5FBCA1', bwId: 'BW-H5CHBVHE', deps: {
      baseUrl: 'https://blockward.me',
      enqueue: async (_s, c) => { enqueued = c.bw_id; return { ok: true, queued: true, batch_ref: 'AB-NEW01' }; },
      emailSender: async (_s, opts) => { emailed = opts; },
    },
  });
  assert.equal(r.ok, true);
  assert.equal(r.mode, 'executed');
  assert.equal(r.applied.batch_quarantined, true);
  assert.equal(r.applied.credential_reverted, true);
  assert.equal(r.applied.achievement_reverted, true);
  assert.equal(r.applied.notification_sent, true);
  assert.equal(enqueued, 'BW-H5CHBVHE');
  assert.ok(emailed.subject.includes('Correction'));
  assert.ok(emailed.html.includes('#2270ec'));
  const batch = svc._db.AnchorBatch[0];
  assert.equal(batch.status, 'ANCHOR_FAILED_PERMANENT');
  assert.ok(batch.event_log.some(e => e.event === 'synthetic_confirmation_detected'));
  const cred = svc._db.Credential[0];
  assert.equal(cred.anchor_status, 'pending');
  assert.equal(cred.blockchain.status, 'pending');
  assert.equal(cred.blockchain.transaction_hash, null);
  assert.equal(cred.chain_check, null);
  assert.ok(cred.event_log.some(e => e.event === 'synthetic_confirmation_cleared'));
  const ach = svc._db.Achievement[0];
  assert.equal(ach.status, 'issuer_confirmed');
  assert.ok(ach.event_log.some(e => e.event === 'verification_reverted_pending_reanchor'));
  // Audit trail preserved.
  assert.ok(batch.event_log.some(e => e.event === 'confirmed'));
  assert.ok(cred.event_log.some(e => e.event === 'blockchain_confirmed'));
  assert.ok(ach.event_log.some(e => e.event === 'verified'));
});

test('a second executeRemediation does not duplicate the audit trail', async () => {
  const svc = makeSvc({ batches: [fixtureBatch()], creds: [fixtureCred()], achievements: [fixtureAch()] });
  let enqueueCalls = 0;
  const deps = {
    baseUrl: 'https://blockward.me',
    enqueue: async () => { enqueueCalls++; return { ok: true, queued: true, batch_ref: 'AB-NEW0' + enqueueCalls }; },
    emailSender: async () => {},
  };
  await loadRemediation().executeRemediation(svc, { batchRef: 'AB-5FBCA1', bwId: 'BW-H5CHBVHE', deps });
  const batchEvents = svc._db.AnchorBatch[0].event_log.length;
  const credEvents = svc._db.Credential[0].event_log.length;
  const achEvents = svc._db.Achievement[0].event_log.length;
  const r2 = await loadRemediation().executeRemediation(svc, { batchRef: 'AB-5FBCA1', bwId: 'BW-H5CHBVHE', deps });
  assert.equal(r2.ok, true);
  assert.equal(r2.applied.batch_quarantined, false);
  assert.equal(r2.applied.credential_reverted, false);
  assert.equal(r2.applied.achievement_reverted, false);
  assert.equal(svc._db.AnchorBatch[0].event_log.length, batchEvents);
  assert.equal(svc._db.Credential[0].event_log.length, credEvents);
  assert.equal(svc._db.Achievement[0].event_log.length, achEvents);
});

test('executeRemediation handles a missing linked achievement gracefully', async () => {
  const svc = makeSvc({ batches: [fixtureBatch()], creds: [fixtureCred({ achievement_id: 'missing' })], achievements: [] });
  const r = await loadRemediation().executeRemediation(svc, {
    batchRef: 'AB-5FBCA1', bwId: 'BW-H5CHBVHE', deps: { baseUrl: 'https://blockward.me', enqueue: async () => ({ ok: true }), emailSender: async () => {} },
  });
  assert.equal(r.ok, true);
  assert.equal(r.applied.achievement_reverted, false);
  assert.equal(svc._db.Credential[0].anchor_status, 'pending');
});

test('previewRemediation reports not_found for an unknown batch', async () => {
  const svc = makeSvc({ batches: [], creds: [], achievements: [] });
  const r = await loadRemediation().previewRemediation(svc, { batchRef: 'AB-NONEXIST', bwId: 'BW-NONEXIST', deps: { baseUrl: 'https://blockward.me' } });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'batch_not_found');
});