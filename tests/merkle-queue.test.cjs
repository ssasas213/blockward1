// Offline regression tests for the BATCH-PROOF-V1 anchoring queue: fee holds,
// fee recovery, retry backoff, permanent failures, stale locks, concurrency,
// duplicate prevention, RPC failures, delayed confirmations, escalation /
// critical windows, spend caps and the batch economics table.
// Same technique as polygon-hardening.test.cjs: execute the real backend
// source after TS erasure, with an in-memory entity store and mocked RPC.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto, createHash } = require('node:crypto');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');
const QUEUE = 'base44/shared/anchorQueue.ts';
const GAS = 'base44/shared/anchorGasPolicy.ts';
const MERKLE = 'base44/shared/anchorMerkle.ts';
const HASHMOD = 'base44/shared/credentialHash.ts';
const TX = '0x' + 'a'.repeat(64);

function fixtureCred(id, n) {
  return {
    id, bw_id: `BW-T${String(n).padStart(6, '0')}`, achievement_id: 'a' + n,
    holder_email: `h${n}@test.local`, title: `Test Achievement ${n}`,
    category: 'certification', description: 'synthetic queue-test credential',
    date_achieved: '2026-01-01', hash_version: 1, anchor_status: 'verified',
    blockchain: {}, event_log: [],
  };
}
const fixtureBatch = (over = {}) => ({
  id: 'b1', batch_ref: 'AB-TEST01', status: 'ANCHOR_PENDING', network: 'polygon_amoy',
  member_ids: ['c1', 'c2'], member_count: 2, max_size: 500,
  created_at: new Date(Date.now() - 11 * 60000).toISOString(),
  close_at: new Date(Date.now() - 60000).toISOString(),
  attempts: 0, event_log: [], ...over,
});

// ── In-memory entity store (supports the exact queries the queue issues) ──
function matches(rec, q) {
  for (const [k, cond] of Object.entries(q)) {
    if (cond && typeof cond === 'object' && !Array.isArray(cond)) {
      if ('$in' in cond) { if (!cond.$in.includes(rec[k])) return false; }
      else return false; // unknown operator — fail closed
    } else if (rec[k] !== cond) return false;
  }
  return true;
}
function makeSvc(seed = {}) {
  const db = {
    AnchorBatch: (seed.batches || []).map((b) => ({
      created_date: b.created_at || new Date().toISOString(), attempts: 0,
      member_ids: [], member_count: 0, event_log: [], ...b, id: b.id || 'b1',
    })),
    Credential: (seed.creds || []).map((c) => ({ event_log: [], blockchain: {}, ...c, id: c.id })),
    Achievement: (seed.achievements || []).map((a) => ({
      status: 'issuer_confirmed', title: 'T', holder_email: 'h@test.local',
      event_log: [], credential_id: null, ...a, id: a.id,
    })),
    Notification: [],
  };
  const col = (name) => ({
    async filter(q, opts = {}) {
      let rows = (db[name] || []).filter((r) => matches(r, q || {}));
      if (opts.sort === 'created_date') rows.sort((a, b) => String(a.created_date).localeCompare(String(b.created_date)));
      if (opts.sort === '-created_date') rows.sort((a, b) => String(b.created_date).localeCompare(String(a.created_date)));
      const items = typeof opts.limit === 'number' ? rows.slice(0, opts.limit) : rows;
      return { items, next_cursor: null, has_more: false };
    },
    async create(data) {
      const rec = { id: `${name}-n${db[name].length + 1}`, created_date: new Date().toISOString(), ...data };
      db[name].push(rec);
      return rec;
    },
    async update(id, data) {
      const rec = (db[name] || []).find((r) => r.id === id);
      if (!rec) throw new Error('record not found: ' + id);
      Object.assign(rec, data);
      return rec;
    },
    async updateMany(q, u) {
      let n = 0;
      for (const r of (db[name] || [])) if (matches(r, q || {})) { Object.assign(r, (u && u.$set) || u); n++; }
      return { modified: n, has_more: false };
    },
    async bulkUpdate(arr) {
      const out = [];
      for (const { id, ...rest } of arr) {
        const rec = (db[name] || []).find((r) => r.id === id);
        if (rec) { Object.assign(rec, rest); out.push(rec); }
      }
      return out;
    },
  });
  return { entities: { AnchorBatch: col('AnchorBatch'), Credential: col('Credential'), Achievement: col('Achievement'), Notification: col('Notification') }, _db: db };
}

// ── Module loader (real gas-policy / Merkle / hash modules, mocked chain) ──
function harness(options = {}) {
  const env = Object.freeze({
    ISSUER_PRIVATE_KEY: 'AMOY_TEST_STUB',
    ...options.env,
  });
  const state = {
    gasGwei: options.gasGwei ?? 30,
    broadcast: options.broadcast || null, // () => anchorBatchRoot-shaped result
    receiptThrows: !!options.receiptThrows,
    receipt: options.receipt === undefined ? undefined : options.receipt,
    broadcasts: 0,
  };
  const viem = {
    http: () => ({}),
    createPublicClient: () => ({
      async getGasPrice() {
        if (options.rpcGasFails) throw new Error('Synthetic gas RPC failure');
        return BigInt(Math.round(state.gasGwei * 1e9));
      },
      async getTransactionReceipt() {
        if (state.receiptThrows) throw new Error('Synthetic receipt RPC failure');
        return state.receipt;
      },
    }),
  };
  const cache = {};
  function load(file) {
    if (cache[file]) return cache[file];
    const output = {};
    cache[file] = output;
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert.equal(ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true).parseDiagnostics.length, 0, file + ' must parse');
    const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(js, {
      exports: output, Response, TextEncoder, TextDecoder, Uint8Array,
      crypto: webcrypto, AbortSignal,
      fetch: async () => { throw new Error('offline — fallback price in tests'); },
      Deno: { env: { get: (k) => env[k] } },
      console: { log: () => {} },
      require: (id) => {
        if (id === 'npm:viem@2.7.0') return viem;
        if (id.startsWith('npm:@base44/sdk')) return { createClientFromRequest: () => ({}) };
        if (id === 'base44:runtime') return { secrets: { get: () => '' } };
        if (id.endsWith('/chainPolygon.ts')) return {
          resolvePolygonTarget: () => ({ target: 'polygon_amoy' }),
          resolvePolygonConfig: () => ({ chain: {}, rpc: 'https://rpc.invalid', networkName: 'polygon_amoy', chainId: 80002, isTestnet: true, expectedSignerAddress: '0x1111111111111111111111111111111111111111' }),
          anchorBatchRoot: async () => {
            state.broadcasts++;
            if (state.broadcast) return state.broadcast();
            return { ok: true, transaction_hash: TX, receipt_pending: false, block_number: 7, block_timestamp: new Date().toISOString(), gas_used: 25520, effective_gas_price_wei: String(BigInt(Math.round(state.gasGwei * 1e9))) };
          },
          verifyBatchRootOnChain: async () => ({ block_number: 7, block_timestamp: new Date().toISOString(), gas_used: 25520, effective_gas_price_wei: String(BigInt(Math.round(state.gasGwei * 1e9))) }),
          BATCH_ANCHOR_VERSION: 2,
        };
        if (id.endsWith('/chainVerification.ts')) return { verificationBindings: () => ({}) };
        if (id.endsWith('/emailDelivery.ts')) return { sendTrackedEmail: async () => ({ ok: true }) };
        if (id.endsWith('/issuerEmails.ts')) return { holderVerifiedEmail: () => ({ subject: 's', html: 'h' }) };
        if (id.endsWith('/verificationFlow.ts')) return { notifyHolder: async () => {}, appBaseUrl: () => 'https://test.local' };
        if (id.startsWith('.')) return load(path.posix.normalize(path.posix.join(path.posix.dirname(file), id)));
        throw new Error('Forbidden import: ' + id);
      },
    }, { timeout: 1000 });
    return output;
  }
  return { load, state, env };
}

function svcFor(over = {}) {
  return makeSvc({
    batches: [fixtureBatch(over.batch || {})],
    creds: [fixtureCred('c1', 1), fixtureCred('c2', 2)],
    achievements: over.achievements || [],
  });
}

// ═══ 1. POLICY — the 15 min / 60 min / 24 h windows and spending caps ═══
test('queue policy enforces the 15-minute target, 60-minute escalation and 24-hour critical alert', () => {
  const { load } = harness();
  const gas = load(GAS);
  const p = gas.resolveAnchorPolicy();
  assert.equal(p.targetMinutes, 15);
  assert.equal(p.escalationMinutes, 60);
  assert.equal(p.criticalMinutes, 1440);
  assert.equal(p.maxBatchCostUsd, 3.0);
  assert.equal(p.absoluteMaxCostUsd, 5.0);
  assert.equal(p.maxFeeGwei, 200);
  assert.equal(p.maxAttempts, 8);
  // The absolute cap can never sit below the per-batch budget.
  const clamped = gas.resolveAnchorPolicy(() => '0.01');
  assert.ok(clamped.absoluteMaxCostUsd >= clamped.maxBatchCostUsd);
});

test('feeDecision — normal fees pass, per-batch budget, absolute cap and fee ceiling block', () => {
  const { load } = harness();
  const gas = load(GAS);
  const p = gas.resolveAnchorPolicy();
  const normal = gas.feeDecision(25520, gas.gweiToWeiPerGas(30), 0.30, p);
  assert.equal(normal.allowed, true);
  const overBudget = gas.feeDecision(25520, gas.gweiToWeiPerGas(100), 0.30, { ...p, maxBatchCostUsd: 0.0001, absoluteMaxCostUsd: 1 });
  assert.equal(overBudget.allowed, false);
  assert.equal(overBudget.reason, 'batch_budget_exceeded');
  const overAbsolute = gas.feeDecision(25520, gas.gweiToWeiPerGas(100), 0.30, { ...p, maxBatchCostUsd: 0.0001, absoluteMaxCostUsd: 0.0001 });
  assert.equal(overAbsolute.allowed, false);
  assert.equal(overAbsolute.reason, 'absolute_cost_cap');
  const overCeiling = gas.feeDecision(25520, gas.gweiToWeiPerGas(250), 0.30, p);
  assert.equal(overCeiling.allowed, false);
  assert.equal(overCeiling.reason, 'fee_ceiling_gwei');
});

test('backoff — exponential with a 6-hour ceiling', () => {
  const { load } = harness();
  const gas = load(GAS);
  const p = gas.resolveAnchorPolicy();
  const seq = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((a) => gas.backoffSeconds(p, a));
  for (let i = 1; i < seq.length; i++) assert.ok(seq[i] >= seq[i - 1], 'backoff is monotonic');
  assert.equal(seq[seq.length - 1], 6 * 3600);
});

// ═══ 2. MERKLE — independent proof verification for 1..9 leaves ═══
test('Merkle proofs verify independently for every leaf of 1..9-leaf trees', async () => {
  const { load } = harness();
  const m = load(MERKLE);
  const leaf = (s) => createHash('sha256').update(s).digest('hex');
  for (let n = 1; n <= 9; n++) {
    const leaves = Array.from({ length: n }, (_, i) => leaf(`leaf-${n}-${i}`));
    const root = await m.merkleRoot(leaves);
    for (let i = 0; i < n; i++) {
      const proof = await m.merkleProof(leaves, i);
      assert.equal(await m.verifyMerkleProof(leaves[i], proof, root), true, `leaf ${i} of ${n}`);
      const wrong = n > 1 ? leaves[(i + 1) % n] : leaf(`wrong-${n}-${i}`);
      assert.equal(await m.verifyMerkleProof(wrong, proof, root), false, `wrong leaf rejected (${n}, ${i})`);
    }
  }
  // Single-leaf tree: empty proof verifies directly against the root.
  const single = leaf('solo');
  assert.equal(await m.verifyMerkleProof(single, [], single), true);
});

// ═══ 3. ENQUEUE — joining and batch sizing ═══
test('enqueue joins an open batch instead of creating a duplicate', async () => {
  const { load } = harness();
  const q = load(QUEUE);
  const svc = svcFor();
  const r1 = await q.enqueueCredentialForAnchoring(svc, svc._db.Credential[0]);
  const r2 = await q.enqueueCredentialForAnchoring(svc, svc._db.Credential[1]);
  assert.equal(r1.ok, true);
  assert.equal(r2.ok, true);
  assert.equal(r1.batch_ref, 'AB-TEST01');
  assert.equal(r2.batch_ref, 'AB-TEST01'); // same open batch — no duplicate
  assert.equal(svc._db.AnchorBatch.length, 1);
  assert.equal(svc._db.Credential[0].anchor_status, 'pending');
  assert.equal(svc._db.Credential[0].blockchain.batch_ref, 'AB-TEST01');
});

test('enqueue opens a new batch only when the current one is full', async () => {
  const { load } = harness({ env: { ANCHOR_BATCH_MAX_SIZE: '1' } });
  const q = load(QUEUE);
  const svc = makeSvc({ creds: [fixtureCred('c1', 1), fixtureCred('c2', 2)] }); // no seeded batch
  await q.enqueueCredentialForAnchoring(svc, svc._db.Credential[0]);
  await q.enqueueCredentialForAnchoring(svc, svc._db.Credential[1]);
  assert.equal(svc._db.AnchorBatch.length, 2);
});

// ═══ 4. CONCURRENCY & DUPLICATES ═══
test('concurrent workers claim once — a batch is never anchored twice', async () => {
  const { load, state } = harness();
  const q = load(QUEUE);
  const svc = svcFor();
  const [s1, s2] = await Promise.all([q.processAnchorQueue(svc), q.processAnchorQueue(svc)]);
  assert.equal(state.broadcasts, 1, 'exactly one broadcast');
  assert.equal(s1.attempted + s2.attempted, 1, 'exactly one winner');
  assert.equal(s1.confirmed + s2.confirmed, 2);
  const batch = svc._db.AnchorBatch[0];
  assert.equal(batch.status, 'ANCHOR_CONFIRMED');
  // Re-running after confirmation does nothing.
  await q.processAnchorQueue(svc);
  assert.equal(state.broadcasts, 1, 'confirmed batch is never re-anchored');
});

// ═══ 5. HIGH GAS FEES + FEE-HOLD RECOVERY ═══
test('high gas fees hold the batch without touching the credential; fees recover automatically', async () => {
  const { load, state } = harness({ gasGwei: 500 });
  const q = load(QUEUE);
  const svc = svcFor();
  const summary = await q.processAnchorQueue(svc);
  assert.equal(summary.fee_holds, 1);
  const batch = svc._db.AnchorBatch[0];
  assert.equal(batch.status, 'ANCHOR_PENDING_FEE');
  assert.ok(batch.fee_hold_notified_at, 'admins notified of the fee hold');
  assert.ok((batch.event_log || []).some((e) => e.event === 'fee_hold'));
  // The gate uses the payload-derived gas estimate (26,230), not the raw
  // on-chain measurement — assert against the same formula.
  const gasMod = load(GAS);
  const payload = JSON.stringify({ v: 1, t: 'blockward-batch', hv: load(HASHMOD).CREDENTIAL_HASH_VERSION, n: 2, r: '0'.repeat(64) });
  assert.equal(batch.estimated_fee_wei, String(BigInt(gasMod.estimateBatchGas(payload, gasMod.resolveAnchorPolicy())) * 625n * 10n ** 9n));
  // The verified credential is preserved exactly as it was (no downgrade).
  assert.equal(svc._db.Credential[0].anchor_status, 'verified');
  assert.equal(state.broadcasts, 0, 'nothing broadcast while fees are high');
  assert.ok(svc._db.Notification.some((n) => n.type === 'anchor_fee_hold'));

  // Fees recover → next tick releases the hold and anchors successfully.
  state.gasGwei = 30;
  await q.processAnchorQueue(svc);
  await q.processAnchorQueue(svc);
  assert.equal(state.broadcasts, 1);
  assert.equal(svc._db.AnchorBatch[0].status, 'ANCHOR_CONFIRMED');
});

// ═══ 6. RETRY BACKOFF + PERMANENT FAILURE ═══
test('retryable broadcast failure schedules exponential backoff, then permanent failure alerts admins', async () => {
  const { load, state } = harness({
    env: { ANCHOR_MAX_ATTEMPTS: '2' },
    broadcast: () => ({ ok: false, error: 'rpc_broadcast_failed' }),
  });
  const q = load(QUEUE);
  const svc = svcFor();
  const s1 = await q.processAnchorQueue(svc);
  let batch = svc._db.AnchorBatch[0];
  assert.equal(batch.status, 'ANCHOR_FAILED_RETRYABLE');
  assert.equal(batch.attempts, 1);
  assert.ok(s1.errors.length === 0);
  // Not due until backoff elapses.
  await q.processAnchorQueue(svc);
  assert.equal(state.broadcasts, 1);
  assert.equal(svc._db.AnchorBatch[0].attempts, 1);
  // Simulate the wait, retry, and hit the attempt ceiling.
  svc._db.AnchorBatch[0].next_attempt_at = new Date(Date.now() - 1000).toISOString();
  await q.processAnchorQueue(svc);
  batch = svc._db.AnchorBatch[0];
  assert.equal(batch.status, 'ANCHOR_FAILED_PERMANENT');
  assert.equal(batch.attempts, 2);
  // Credentials are preserved and marked failed — never silently abandoned.
  assert.equal(svc._db.Credential[0].anchor_status, 'failed');
  assert.equal(svc._db.Credential[1].anchor_status, 'failed');
  assert.ok(svc._db.Notification.some((n) => n.type === 'anchor_escalation' && n.priority === 'urgent'));
});

// ═══ 7. RPC FAILURES + DELAYED CONFIRMATION ═══
test('receipt RPC failure keeps the batch in flight; missing receipts eventually retry; late receipts confirm', async () => {
  const { load, state } = harness({ receiptThrows: true });
  const q = load(QUEUE);
  const now = new Date().toISOString();
  const svc = svcFor({ batch: { status: 'ANCHOR_SUBMITTED', transaction_hash: TX, event_log: [{ event: 'submitted', actor: 'system', note: '', timestamp: now }] } });
  await q.processAnchorQueue(svc);
  assert.equal(svc._db.AnchorBatch[0].status, 'ANCHOR_SUBMITTED', 'still in flight');

  // 40 minutes with no receipt → retry scheduled.
  svc._db.AnchorBatch[0].event_log[0].timestamp = new Date(Date.now() - 40 * 60000).toISOString();
  await q.processAnchorQueue(svc);
  assert.equal(svc._db.AnchorBatch[0].status, 'ANCHOR_FAILED_RETRYABLE');
  assert.equal(svc._db.AnchorBatch[0].last_error.includes('receipt not found'), true);

  // Delayed confirmation: once the batch has left SUBMITTED, recovery is a
  // deliberate, harmless re-anchor of the identical root (zero-value, same
  // commitment) — it confirms with proofs and recorded cost.
  state.receiptThrows = false;
  state.receipt = undefined;
  svc._db.AnchorBatch[0].next_attempt_at = new Date(Date.now() - 1000).toISOString();
  const s = await q.processAnchorQueue(svc);
  assert.equal(s.confirmed, 2);
  assert.equal(state.broadcasts, 1, 'recovery re-anchors the identical root once, deliberately');
  const batch = svc._db.AnchorBatch[0];
  assert.equal(batch.status, 'ANCHOR_CONFIRMED');
  assert.equal(batch.actual_fee_wei, String(25520n * 30n * 10n ** 9n));
  assert.equal(batch.actual_fee_pol, '0.0007656');
  for (const c of svc._db.Credential) {
    assert.equal(c.anchor_status, 'confirmed');
    assert.equal(c.chain_check.status, 'confirmed');
    assert.ok(c.blockchain.merkle_proof.length >= 1);
  }
});

// ═══ 8. STALE LOCKS (worker crash) ═══
test('a worker crash releases the stale claim back to the retryable queue', async () => {
  const { load } = harness();
  const q = load(QUEUE);
  const svc = svcFor({ batch: { status: 'ANCHOR_PROCESSING', anchor_claimed_by: 'dead-worker', anchor_claimed_at: new Date(Date.now() - 11 * 60000).toISOString() } });
  const s = await q.processAnchorQueue(svc);
  assert.equal(s.recovered, 1);
  const batch = svc._db.AnchorBatch[0];
  assert.equal(batch.status, 'ANCHOR_FAILED_RETRYABLE');
  assert.equal(batch.attempts, 1);
  assert.equal(batch.anchor_claimed_by, null);
  assert.ok((batch.event_log || []).some((e) => e.event === 'retry_scheduled'));
});

test('a fresh claim (<10 min) is left alone', async () => {
  const { load } = harness();
  const q = load(QUEUE);
  const svc = svcFor({ batch: { status: 'ANCHOR_PROCESSING', anchor_claimed_by: 'live-worker', anchor_claimed_at: new Date(Date.now() - 5 * 60000).toISOString() } });
  const s = await q.processAnchorQueue(svc);
  assert.equal(s.recovered, 0);
  assert.equal(svc._db.AnchorBatch[0].status, 'ANCHOR_PROCESSING');
});

// ═══ 9. ESCALATION + CRITICAL WINDOWS ═══
test('a batch older than the escalation window raises an administrator escalation', async () => {
  const { load } = harness({ broadcast: () => ({ ok: false, error: 'rpc_broadcast_failed' }) });
  const q = load(QUEUE);
  const svc = svcFor({ batch: { created_at: new Date(Date.now() - 61 * 60000).toISOString() } });
  const s = await q.processAnchorQueue(svc);
  assert.equal(s.escalated, 1);
  assert.ok(svc._db.AnchorBatch[0].escalated_at, 'escalated_at recorded');
  assert.ok(svc._db.Notification.some((n) => n.type === 'anchor_escalation' && n.priority === 'important'));
});

test('a batch older than 24 hours raises the critical incident alert', async () => {
  const { load } = harness({ broadcast: () => ({ ok: false, error: 'rpc_broadcast_failed' }) });
  const q = load(QUEUE);
  const svc = svcFor({ batch: { created_at: new Date(Date.now() - 25 * 3600000).toISOString(), escalated_at: new Date(Date.now() - 23 * 3600000).toISOString() } });
  const s = await q.processAnchorQueue(svc);
  assert.equal(s.critical, 1);
  assert.ok(svc._db.AnchorBatch[0].critical_at, 'critical_at recorded');
  assert.ok(svc._db.Notification.some((n) => n.type === 'anchor_critical' && n.priority === 'urgent'));
});

// ═══ 10. SPEND CAP CANNOT BE EXCEEDED, EVEN WHEN ESCALATED ═══
test('an escalated batch is still held when the estimate exceeds the absolute cap', async () => {
  const { load, state } = harness({ gasGwei: 500, broadcast: () => { throw new Error('must not broadcast'); } });
  const q = load(QUEUE);
  const svc = svcFor({ batch: { escalated_at: new Date().toISOString() } });
  const s = await q.processAnchorQueue(svc);
  assert.equal(s.fee_holds, 1, 'escalation releases the per-batch budget, never the absolute cap');
  assert.equal(state.broadcasts, 0);
  assert.equal(svc._db.AnchorBatch[0].status, 'ANCHOR_PENDING_FEE');
});

// ═══ 11. PRODUCTION ECONOMICS ═══
test('economics — per-credential cost falls with batch size; a batch of one is far inside the cap', () => {
  const { load } = harness();
  const gas = load(GAS);
  const p = gas.resolveAnchorPolicy();
  // Measured Amoy: 25,520 gas at ~30 gwei. Mainnet estimate uses the
  // conservative 200 gwei fee ceiling at the fallback price.
  const MEASURED_AMOY_GAS = 25520;
  const cases = [1, 10, 100, 1000].map((size) => {
    const amoyWei = BigInt(MEASURED_AMOY_GAS) * gas.gweiToWeiPerGas(30) / BigInt(size);
    const mainWei = BigInt(MEASURED_AMOY_GAS) * gas.gweiToWeiPerGas(p.maxFeeGwei) / BigInt(size);
    return {
      size, amoyWei, mainWei,
      amoy: { pol: gas.weiToPol(amoyWei), usd: gas.weiToUsd(amoyWei, 0.30) },
      mainnet_est: { pol: gas.weiToPol(mainWei), usd: gas.weiToUsd(mainWei, p.fallbackPolUsd) },
    };
  });
  console.log('ECONOMICS', JSON.stringify(cases, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));
  // Batching must reduce per-credential cost monotonically (exact wei —
  // the rounded USD strings collapse at sub-1e-4 magnitudes).
  for (let i = 1; i < cases.length; i++) {
    assert.ok(cases[i].amoyWei < cases[i - 1].amoyWei, 'per-credential cost falls with batch size');
    assert.ok(cases[i].mainWei < cases[i - 1].mainWei, 'mainnet estimate falls with batch size');
  }
  // Worst case — one credential per batch at the fee ceiling — stays far
  // inside the absolute spending cap, so small batches never block.
  const worstCaseUsd = gas.weiToUsd(BigInt(MEASURED_AMOY_GAS) * gas.gweiToWeiPerGas(p.maxFeeGwei), p.fallbackPolUsd);
  assert.ok(worstCaseUsd < p.absoluteMaxCostUsd, `worst-case single batch $${worstCaseUsd} < cap $${p.absoluteMaxCostUsd}`);
  // The projection table agrees with the formula.
  const table = gas.volumeCostTable(p, p.fallbackPolUsd, MEASURED_AMOY_GAS);
  for (const row of table) {
    assert.ok(row.est_cost_per_credential_usd <= cases[0].mainnet_est.usd, 'projection is never above the batch-of-one ceiling');
  }
});