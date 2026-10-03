// Offline regression tests: no SDK, network transport, wallet or real key is
// available inside the VM. Execute the actual backend source after TS erasure.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto, createHash } = require('node:crypto');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');
const POLYGON = 'base44/shared/chainPolygon.ts';
const PREFLIGHT = 'base44/functions/polygonMainnetIntegrationTest/entry.ts';
const A = '0x1111111111111111111111111111111111111111';
const B = '0x2222222222222222222222222222222222222222';
const TX = '0x' + 'a'.repeat(64);
const BLOCK = '0x' + 'b'.repeat(64);
const hex = (s) => '0x' + Buffer.from(s, 'utf8').toString('hex');
const fields = {
  verification_id: 'SYNTHETIC-ONLY', version: 1,
  achievement_title: 'Synthetic test', achievement_category: 'test',
  achievement_description: 'synthetic', date_achieved: '2000-01-01',
};
// Independent reference digest, not calculated by the implementation under test.
const HASH = createHash('sha256').update(JSON.stringify(Object.values(fields).map(String))).digest('hex');
const payload = { v: 1, t: 'blockward-anchor', id: fields.verification_id, hv: 1, h: HASH };
const credential = () => ({
  bw_id: fields.verification_id, title: fields.achievement_title,
  category: fields.achievement_category, description: fields.achievement_description,
  date_achieved: fields.date_achieved, hash_version: 1, anchor_status: 'confirmed',
  blockchain: { chain_id: 80002, network: 'polygon_amoy', transaction_hash: TX, anchor_mode: 'calldata' },
});

function harness(options = {}) {
  const env = Object.freeze({
    ISSUER_PRIVATE_KEY: 'AMOY_TEST_STUB',
    POLYGON_MAINNET_ISSUER_PRIVATE_KEY: 'MAINNET_TEST_STUB',
    POLYGON_MAINNET_ANCHOR_ADDRESS: B,
    POLYGON_MAINNET_RPC_URL: 'https://mainnet.invalid',
    ...options.env,
  });
  const calls = [], clients = [], estimates = [];
  const transaction = { hash: TX, blockNumber: 1n, blockHash: BLOCK, from: A, to: A,
    value: 0n, input: hex(JSON.stringify(payload)), ...options.tx };
  const receipt = { transactionHash: TX, blockNumber: 1n, blockHash: BLOCK,
    status: 'success', from: A, to: A, ...options.receipt };
  const publicClient = new Proxy({}, { get: (_, method) => async (args) => {
    calls.push(method);
    if (options.fail === method) throw new Error('Synthetic RPC failure');
    switch (method) {
      case 'getChainId': return options.chain ?? 80002;
      case 'getTransaction': return options.noTx ? null : transaction;
      case 'getTransactionReceipt': return options.noReceipt ? null : receipt;
      case 'getBalance': return options.balance ?? 10n ** 18n;
      case 'estimateGas': estimates.push(args); return options.gas ?? 22000n;
      case 'estimateFeesPerGas': return options.fees ?? { maxFeePerGas: 30000000000n, maxPriorityFeePerGas: 1000000000n };
      default: throw new Error('Forbidden RPC method: ' + String(method));
    }
  } });
  const cache = {};
  const viem = {
    defineChain: (x) => x, parseAbi: (x) => x, stringToHex: hex,
    isAddress: (x) => /^0x[0-9a-fA-F]{40}$/.test(x), getAddress: (x) => x,
    http: (url) => ({ url }),
    createPublicClient: (config) => { clients.push(config); return publicClient; },
    createWalletClient: () => { throw new Error('Wallet creation forbidden in these tests'); },
  };
  function load(file) {
    if (cache[file]) return cache[file];
    const output = {};
    cache[file] = output;
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    assert.equal(parsed.parseDiagnostics.length, 0, file + ' must parse');
    const js = ts.transpileModule(source, { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    } }).outputText;
    vm.runInNewContext(js, {
      exports: output, Response, Request, TextEncoder, TextDecoder, Uint8Array,
      crypto: webcrypto, Deno: { env: { get: (key) => env[key] } },
      console: { log: () => {} },
      require: (id) => {
        if (id === 'npm:viem@2.7.0') return viem;
        if (id === 'npm:viem@2.7.0/accounts') return { privateKeyToAccount: (key) => {
          if (key === 'AMOY_TEST_STUB') return { address: A };
          if (key === 'MAINNET_TEST_STUB') return { address: B };
          throw new Error('Invalid synthetic key');
        } };
        if (id.startsWith('npm:@base44/sdk')) return { createClientFromRequest: () => ({}) };
        if (id.endsWith('/internalAdmin.ts')) return { requireInternalAdmin: async () => ({
          error: options.denied ? Response.json({ error: 'denied' }, { status: 403 }) : null,
        }) };
        if (id.startsWith('.')) return load(path.posix.normalize(path.posix.join(path.posix.dirname(file), id)));
        throw new Error('Forbidden import: ' + id);
      },
    }, { timeout: 1000 });
    return output;
  }
  return { load, calls, clients, estimates, env };
}

async function verify(options = {}, cred = credential()) {
  const h = harness(options);
  const result = await h.load(POLYGON).verifyCredentialAnchor(null, cred);
  return { h, result };
}

test('correct sender/recipient, successful mined receipt and exact hash confirm', async () => {
  const { h, result } = await verify();
  assert.equal(result.status, 'confirmed');
  assert.equal(result.committed_hash, HASH);
  assert.deepEqual(h.calls, ['getChainId', 'getTransaction', 'getTransactionReceipt']);
});

for (const [name, options] of [
  ['wrong transaction sender', { tx: { from: B } }],
  ['wrong receipt sender', { receipt: { from: B } }],
  ['wrong transaction recipient', { tx: { to: B } }],
  ['wrong receipt recipient', { receipt: { to: B } }],
  ['contract creation recipient', { tx: { to: null } }],
  ['failed receipt', { receipt: { status: 'reverted' } }],
  ['missing receipt', { noReceipt: true }],
  ['unmined transaction', { tx: { blockNumber: null, blockHash: null } }],
  ['unmined receipt', { receipt: { blockNumber: null, blockHash: null } }],
  ['missing transaction', { noTx: true }],
  ['wrong live chain', { chain: 137 }],
  ['wrong transaction chain', { tx: { chainId: 137 } }],
  ['different transaction hash', { tx: { hash: BLOCK } }],
  ['different receipt transaction hash', { receipt: { transactionHash: BLOCK } }],
  ['different mined block', { receipt: { blockHash: TX } }],
  ['different block number', { receipt: { blockNumber: 2n } }],
  ['nonzero value', { tx: { value: 1n } }],
  ['missing Amoy signer configuration', { env: { ISSUER_PRIVATE_KEY: '' } }],
  ...['getChainId', 'getTransaction', 'getTransactionReceipt'].map((fail) => ['RPC error: ' + fail, { fail }]),
]) test(name + ' cannot confirm even with a matching embedded hash', async () => {
  assert.notEqual((await verify(options)).result.status, 'confirmed');
});

for (const [name, change] of [
  ['id', { id: 'OTHER' }], ['missing id', { id: undefined }],
  ['payload version', { v: 2 }], ['missing payload version', { v: undefined }],
  ['type', { t: 'other' }], ['hash version', { hv: 2 }], ['missing hash version', { hv: undefined }],
  ['credential revision ver', { ver: 2 }], ['credential revision version', { version: 2 }],
  ['digest', { h: '0'.repeat(64) }], ['noncanonical digest', { h: HASH.toUpperCase() }],
]) test('mismatched ' + name + ' is rejected', async () => {
  const { result } = await verify({ tx: { input: hex(JSON.stringify({ ...payload, ...change })) } });
  assert.notEqual(result.status, 'confirmed');
});

test('optional matching credential revision is accepted', async () => {
  assert.equal((await verify({ tx: { input: hex(JSON.stringify({ ...payload, ver: 1 })) } })).result.status, 'confirmed');
});
for (const input of ['0x0', '0xzz', '0xff', hex('null'), hex('[]'), hex(hex(JSON.stringify(payload)))]) {
  test('malformed or double-encoded calldata rejected: ' + input.slice(0, 14), async () => {
    assert.equal((await verify({ tx: { input } })).result.status, 'anchor_invalid');
  });
}
test('cached hash-only confirmation cannot bypass checks', async () => {
  const cred = credential();
  cred.chain_check = { status: 'confirmed', checked_at: new Date().toISOString() };
  assert.notEqual((await verify({ tx: { from: B } }, cred)).result.status, 'confirmed');
});
test('a rejected sender overwrites an old persisted confirmation', async () => {
  const h = harness({ tx: { from: B } });
  const cred = credential(); cred.id = 'synthetic-only';
  cred.chain_check = { status: 'confirmed', checked_at: new Date().toISOString() };
  const updates = [];
  const svc = { entities: { Credential: { update: async (id, data) => updates.push({ id, data }) } } };
  const result = await h.load(POLYGON).verifyCredentialAnchor(svc, cred);
  assert.equal(result.status, 'anchor_invalid');
  assert.equal(updates.length, 1);
  assert.equal(updates[0].data.chain_check.status, 'anchor_invalid');
});
test('confirmed database flag without transaction hash cannot confirm', async () => {
  const cred = credential(); delete cred.blockchain.transaction_hash;
  assert.equal((await verify({}, cred)).result.status, 'pending');
});
test('changed credential content rejects an otherwise valid transaction', async () => {
  const cred = credential(); cred.title = 'Changed synthetic title';
  assert.equal((await verify({}, cred)).result.status, 'hash_mismatch');
});
test('unsupported persisted hash version cannot confirm', async () => {
  const cred = credential(); cred.hash_version = 2;
  assert.notEqual((await verify({}, cred)).result.status, 'confirmed');
});
test('unknown explicit pinned chain fails closed', async () => {
  const cred = credential(); cred.blockchain.chain_id = 1;
  assert.equal((await verify({}, cred)).result.reason, 'unsupported_pinned_chain');
});
test('Amoy verification remains pinned when normal issuance selector is mainnet', async () => {
  const { h, result } = await verify({ env: { POLYGON_NETWORK: 'polygon_mainnet' } });
  assert.equal(result.status, 'confirmed');
  assert.equal(h.clients[0].chain.id, 80002);
});
test('mainnet verification uses public configured anchor, never the Amoy key/selector', async () => {
  const cred = credential(); cred.blockchain.chain_id = 137; cred.blockchain.network = 'polygon';
  const { h, result } = await verify({ chain: 137, tx: { from: B, to: B }, receipt: { from: B, to: B },
    env: { POLYGON_NETWORK: 'polygon_amoy', ISSUER_PRIVATE_KEY: '', POLYGON_MAINNET_ISSUER_PRIVATE_KEY: '' } }, cred);
  assert.equal(result.status, 'confirmed'); assert.equal(h.clients[0].chain.id, 137);
});
test('mainnet missing expected address fails closed', async () => {
  const cred = credential(); cred.blockchain.chain_id = 137;
  assert.notEqual((await verify({ chain: 137, env: { POLYGON_MAINNET_ANCHOR_ADDRESS: '' } }, cred)).result.status, 'confirmed');
});
test('network-name fallback still pins historical mainnet records', async () => {
  const cred = credential(); delete cred.blockchain.chain_id; cred.blockchain.network = 'polygon';
  assert.equal((await verify({ chain: 137, tx: { from: B, to: B }, receipt: { from: B, to: B } }, cred)).result.status, 'confirmed');
});

async function preflight(options = {}, method = 'POST') {
  const h = harness({ chain: 137, ...options });
  const before = JSON.stringify(h.env);
  const response = await h.load(PREFLIGHT).default(new Request('https://test.invalid', { method,
    ...(method === 'POST' ? { body: JSON.stringify({ credential_id: 'ignored', data: 'ignored', to: A }) } : {}),
  }));
  const result = response.status === 204 ? null : await response.json();
  assert.equal(JSON.stringify(h.env), before);
  assert(h.calls.every((c) => ['getChainId', 'getBalance', 'estimateGas', 'estimateFeesPerGas'].includes(c)));
  return { h, result, response };
}
test('preflight proposes only a fixed raw SHA256 digest, zero value, bounded EIP1559 fees', async () => {
  const { h, result } = await preflight();
  assert.equal(result.MAINNET_TEST_READY, true);
  assert.equal(result.transaction_broadcast, false);
  const tx = result.proposed_transaction;
  const expected = '0x' + createHash('sha256').update('blockward:polygon-mainnet-integration-test:v1:synthetic-only').digest('hex');
  assert.equal(tx.data, expected); assert.equal(tx.data.length, 66);
  assert.equal(h.estimates[0].data, tx.data);
  assert.equal(tx.from, B); assert.equal(tx.to, B); assert.equal(tx.value, '0'); assert.equal(tx.chainId, 137);
  assert.equal(tx.gas, '26400');
  assert(BigInt(tx.gas) * BigInt(tx.maxFeePerGas) <= 1000000000000000n);
  assert.equal(result.estimated_max_fee_POL, '0.000792');
  assert.equal(result.maximum_fee_POL, '0.001');
});
for (const [name, options] of [
  ['fee above default ceiling', { fees: { maxFeePerGas: 100000000000n, maxPriorityFeePerGas: 1n } }],
  ['fee above lower configured ceiling', { env: { POLYGON_MAINNET_TEST_MAX_FEE_POL: '0.0001' } }],
  ['insufficient balance', { balance: 1n }], ['zero gas estimate', { gas: 0n }],
  ['wrong chain', { chain: 80002 }], ['wrong configured chain', { env: { POLYGON_MAINNET_CHAIN_ID: '80002' } }],
  ['wrong signer', { env: { POLYGON_MAINNET_ANCHOR_ADDRESS: A } }],
  ['invalid signing key', { env: { POLYGON_MAINNET_ISSUER_PRIVATE_KEY: 'invalid' } }],
  ['missing RPC', { env: { POLYGON_MAINNET_RPC_URL: '' } }],
  ['mainnet normal issuance', { env: { POLYGON_NETWORK: 'mainnet' } }],
  ['unsupported normal issuance', { env: { POLYGON_NETWORK: 'invalid' } }],
  ['invalid fee relationship', { fees: { maxFeePerGas: 1n, maxPriorityFeePerGas: 2n } }],
  ['zero maximum fee', { fees: { maxFeePerGas: 0n, maxPriorityFeePerGas: 0n } }],
  ...['getChainId', 'getBalance', 'estimateGas', 'estimateFeesPerGas'].map((fail) => ['RPC failure ' + fail, { fail }]),
  ...['', '0', '-1', 'NaN', '1e-3', '0.010000000000000001', '1', '0.0000000000000000001'].map((cap) => ['invalid cap ' + cap, { env: { POLYGON_MAINNET_TEST_MAX_FEE_POL: cap } }]),
]) test('preflight rejects ' + name, async () => {
  assert.equal((await preflight(options)).result.MAINNET_TEST_READY, false);
});
test('exact fee ceiling and exact maximum-cost balance are sufficient', async () => {
  const { result } = await preflight({ env: { POLYGON_MAINNET_TEST_MAX_FEE_POL: '0.000792' }, balance: 792000000000000n });
  assert.equal(result.MAINNET_TEST_READY, true);
});
test('fee cap exceeded exposes no usable unsigned proposal', async () => {
  assert.equal((await preflight({ env: { POLYGON_MAINNET_TEST_MAX_FEE_POL: '0.0001' } })).result.proposed_transaction, null);
});
test('preflight authorization and methods fail before RPC', async () => {
  const denied = await preflight({ denied: true }); assert.equal(denied.response.status, 403); assert.equal(denied.h.calls.length, 0);
  for (const method of ['OPTIONS', 'DELETE']) {
    const { h, response } = await preflight({}, method);
    assert.equal(response.status, method === 'OPTIONS' ? 204 : 405); assert.equal(h.calls.length, 0);
  }
});
test('GET is also preflight-only', async () => {
  assert.equal((await preflight({}, 'GET')).result.transaction_broadcast, false);
});
test('normal issuance defaults and explicit selector behavior remain unchanged', () => {
  for (const [value, target] of [['', 'polygon_amoy'], ['amoy', 'polygon_amoy'], ['polygon_amoy', 'polygon_amoy'], ['mainnet', 'polygon_mainnet']]) {
    assert.equal(harness({ env: { POLYGON_NETWORK: value } }).load(POLYGON).resolvePolygonTarget().target, target);
  }
});
