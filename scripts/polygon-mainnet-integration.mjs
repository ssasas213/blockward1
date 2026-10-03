// Local operator CLI only. Never imported by Base44 or credential issuance.
// Node 24+. Importing this module does not inspect environment or create clients.
import { createHash, randomBytes } from 'node:crypto';
import { openSync, writeSync, ftruncateSync, fsyncSync, closeSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Wallet, JsonRpcProvider, Transaction, keccak256 } from 'ethers';
import { INTEGRATION_ID, DEFAULT_MAX_FEE_POL, feeCeilingWei } from '../base44/shared/mainnetIntegrationPolicy.ts';

export const COMMITMENT = '0x' + createHash('sha256').update(INTEGRATION_ID).digest('hex');
const PLAN_TTL_MS = 5 * 60 * 1000;
export class IntegrationError extends Error {}
function requireThat(condition, code) { if (!condition) throw new IntegrationError(code); }
const address = value => typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value);
const sameAddress = (a, b) => address(a) && address(b) && a.toLowerCase() === b.toLowerCase();
const uint = value => typeof value === 'string' && /^(0|[1-9]\d{0,77})$/.test(value);
const hash = value => typeof value === 'string' && /^0x[0-9a-fA-F]{64}$/.test(value);

export function authorizationFor(plan) {
  // This public value binds deliberate operator confirmation to the entire
  // reviewed plan. It is not an authentication credential or a private secret.
  return createHash('sha256').update(JSON.stringify(plan)).digest('hex');
}

function validateConfig(config) {
  requireThat(address(config.expectedAddress), 'INVALID_EXPECTED_ADDRESS');
  requireThat(Number(config.chainId ?? 137) === 137, 'CONFIGURED_CHAIN_NOT_137');
  requireThat(['', 'amoy', 'polygon_amoy'].includes(String(config.normalNetwork || '').trim().toLowerCase()), 'NORMAL_ISSUANCE_NOT_AMOY');
  const cap = feeCeilingWei(config.maxFeePol ?? DEFAULT_MAX_FEE_POL);
  requireThat(cap !== null, 'INVALID_FEE_CEILING');
  return cap;
}

export async function prepareIntegration(io, config, options = {}) {
  const cap = validateConfig(config);
  requireThat(await io.chainId() === 137, 'LIVE_CHAIN_NOT_137');
  const from = await io.address(); // derive public sender from configured key
  requireThat(sameAddress(from, config.expectedAddress), 'SIGNER_MISMATCH');
  requireThat(await io.code(from) === '0x', 'SELF_ANCHOR_MUST_HAVE_NO_CODE');
  const latest = await io.nonce(from, 'latest');
  const pending = await io.nonce(from, 'pending');
  requireThat(Number.isSafeInteger(latest) && latest >= 0 && latest === pending, 'PENDING_OR_INVALID_NONCE');
  const tx = { from, to: from, value: 0n, data: COMMITMENT };
  const estimate = await io.estimateGas(tx);
  const fees = await io.fees();
  requireThat(typeof estimate === 'bigint' && estimate > 0n, 'INVALID_GAS_ESTIMATE');
  requireThat(typeof fees?.maxFeePerGas === 'bigint' && fees.maxFeePerGas > 0n
    && typeof fees.maxPriorityFeePerGas === 'bigint' && fees.maxPriorityFeePerGas >= 0n
    && fees.maxPriorityFeePerGas <= fees.maxFeePerGas, 'INVALID_EIP1559_FEES');
  const gas = (estimate * 120n + 99n) / 100n;
  const cost = gas * fees.maxFeePerGas;
  requireThat(cost <= cap, 'FEE_CEILING_EXCEEDED');
  requireThat(await io.balance(from) >= cost, 'INSUFFICIENT_BALANCE');
  const createdAt = options.now?.() ?? Date.now();
  return {
    verification_version: 1, integration_id: INTEGRATION_ID, chainId: 137, type: 2,
    from, to: from, value: '0', data: COMMITMENT, nonce: latest,
    gas: gas.toString(), maxFeePerGas: fees.maxFeePerGas.toString(),
    maxPriorityFeePerGas: fees.maxPriorityFeePerGas.toString(), feeCeilingWei: cap.toString(),
    createdAt, expiresAt: createdAt + PLAN_TTL_MS,
    challenge: options.challenge?.() ?? randomBytes(32).toString('hex'),
  };
}

function validatePlan(plan, config, authorization, now) {
  const cap = validateConfig(config);
  requireThat(plan && typeof plan === 'object' && !Array.isArray(plan), 'INVALID_PLAN');
  requireThat(typeof authorization === 'string' && /^[0-9a-f]{64}$/.test(authorization)
    && authorization === authorizationFor(plan), 'EXPLICIT_AUTHORIZATION_REQUIRED');
  requireThat(plan.verification_version === 1 && plan.integration_id === INTEGRATION_ID
    && plan.chainId === 137 && plan.type === 2 && plan.value === '0' && plan.data === COMMITMENT
    && sameAddress(plan.from, config.expectedAddress) && sameAddress(plan.to, plan.from), 'PLAN_FIELDS_MISMATCH');
  requireThat(Number.isSafeInteger(plan.nonce) && plan.nonce >= 0, 'INVALID_PLAN_NONCE');
  requireThat(Number.isSafeInteger(plan.createdAt) && Number.isSafeInteger(plan.expiresAt)
    && plan.expiresAt === plan.createdAt + PLAN_TTL_MS && now >= plan.createdAt && now < plan.expiresAt
    && /^[0-9a-f]{64}$/.test(plan.challenge), 'PLAN_EXPIRED_OR_INVALID');
  requireThat(['gas', 'maxFeePerGas', 'maxPriorityFeePerGas', 'feeCeilingWei'].every(k => uint(plan[k])), 'INVALID_PLAN_UNITS');
  requireThat(BigInt(plan.gas) > 0n && BigInt(plan.maxFeePerGas) > 0n
    && BigInt(plan.maxPriorityFeePerGas) <= BigInt(plan.maxFeePerGas)
    && BigInt(plan.feeCeilingWei) === cap
    && BigInt(plan.gas) * BigInt(plan.maxFeePerGas) <= cap, 'PLAN_FEE_CEILING_EXCEEDED');
}

function transactionRequest(plan) {
  // Explicit allowlist; request cannot inject a recipient, access list or data.
  return { chainId: 137, type: 2, to: plan.to, nonce: plan.nonce, value: 0n,
    data: COMMITMENT, gasLimit: BigInt(plan.gas), maxFeePerGas: BigInt(plan.maxFeePerGas),
    maxPriorityFeePerGas: BigInt(plan.maxPriorityFeePerGas) };
}

function matchesTransaction(tx, plan) {
  return tx && Number(tx.chainId) === 137 && tx.type === 2 && tx.nonce === plan.nonce
    && sameAddress(tx.from, plan.from) && sameAddress(tx.to, plan.to)
    && tx.value === 0n && tx.data === COMMITMENT
    && tx.gasLimit === BigInt(plan.gas) && tx.maxFeePerGas === BigInt(plan.maxFeePerGas)
    && tx.maxPriorityFeePerGas === BigInt(plan.maxPriorityFeePerGas);
}

export async function verifyExecutedTransaction(io, plan, txHash) {
  requireThat(await io.chainId() === 137, 'POST_BROADCAST_WRONG_CHAIN');
  const tx = await io.transaction(txHash);
  const receipt = await io.receipt(txHash);
  requireThat(hash(txHash) && tx?.hash === txHash && receipt?.hash === txHash
    && matchesTransaction(tx, plan), 'POST_BROADCAST_TRANSACTION_MISMATCH');
  requireThat(receipt.status === 1 && Number.isSafeInteger(tx.blockNumber) && tx.blockNumber >= 0
    && tx.blockNumber === receipt.blockNumber && hash(tx.blockHash) && tx.blockHash === receipt.blockHash
    && sameAddress(receipt.from, plan.from) && sameAddress(receipt.to, plan.to), 'POST_BROADCAST_RECEIPT_INVALID');
  requireThat(typeof receipt.gasUsed === 'bigint' && typeof receipt.gasPrice === 'bigint'
    && receipt.gasUsed >= 0n && receipt.gasPrice >= 0n
    && receipt.gasUsed <= BigInt(plan.gas) && receipt.gasPrice <= BigInt(plan.maxFeePerGas)
    && receipt.gasUsed * receipt.gasPrice <= BigInt(plan.feeCeilingWei), 'POST_BROADCAST_FEE_INVALID');
  return { hash: txHash, blockNumber: receipt.blockNumber, feeWei: (receipt.gasUsed * receipt.gasPrice).toString() };
}

export async function executeIntegration(io, config, plan, authorization, journal, options = {}) {
  const now = options.now ?? Date.now;
  validatePlan(plan, config, authorization, now());
  const fresh = await prepareIntegration(io, config, { now });
  requireThat(sameAddress(fresh.from, plan.from) && fresh.nonce === plan.nonce, 'PLAN_NONCE_OR_SENDER_CHANGED');
  requireThat(BigInt(fresh.gas) <= BigInt(plan.gas) && BigInt(fresh.maxFeePerGas) <= BigInt(plan.maxFeePerGas)
    && BigInt(fresh.maxPriorityFeePerGas) <= BigInt(plan.maxPriorityFeePerGas), 'FRESH_ESTIMATE_EXCEEDS_PLAN');
  // Balance must cover the REVIEWED upper bound, not just a lower fresh estimate.
  requireThat(await io.balance(plan.from) >= BigInt(plan.gas) * BigInt(plan.maxFeePerGas), 'INSUFFICIENT_BALANCE');
  const lock = journal.reserve(plan); // exclusive and durable; never auto-deleted
  let txHash = null;
  try {
    validatePlan(plan, config, authorization, now());
    requireThat(await io.chainId() === 137, 'LIVE_CHAIN_NOT_137');
    requireThat(await io.nonce(plan.from, 'pending') === plan.nonce, 'NONCE_CHANGED');
    const signed = await io.sign(transactionRequest(plan));
    requireThat(matchesTransaction(Transaction.from(signed), plan), 'SIGNED_TRANSACTION_MISMATCH');
    txHash = keccak256(signed);
    lock.record({ state: 'signed', hash: txHash, nonce: plan.nonce });
    validatePlan(plan, config, authorization, now());
    requireThat(await io.chainId() === 137, 'LIVE_CHAIN_NOT_137');
    // Exactly one send call; never retry after transport/receipt ambiguity.
    requireThat(await io.broadcast(signed) === txHash, 'BROADCAST_HASH_MISMATCH');
    lock.record({ state: 'broadcast', hash: txHash, nonce: plan.nonce });
    const mined = await io.waitReceipt(txHash);
    requireThat(mined?.status === 1, 'MINED_RECEIPT_NOT_SUCCESSFUL');
    const result = await verifyExecutedTransaction(io, plan, txHash);
    lock.record({ state: 'confirmed', ...result });
    return result;
  } catch (error) {
    lock.record({ state: 'stopped_manual_reconciliation_required', hash: txHash });
    throw error;
  } finally { lock.close(); }
}

export function fileJournal(directory) {
  return { reserve(plan) {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const filename = join(directory, `polygon-137-integration-v1-${plan.from.toLowerCase()}.json`);
    let fd;
    try { fd = openSync(filename, 'wx', 0o600); }
    catch { throw new IntegrationError('ONE_SHOT_JOURNAL_EXISTS_OR_UNAVAILABLE'); }
    const record = state => {
      const data = JSON.stringify({ integration_id: INTEGRATION_ID, authorization: authorizationFor(plan), ...state });
      const length = Buffer.byteLength(data);
      requireThat(writeSync(fd, data, 0, 'utf8') === length, 'JOURNAL_WRITE_INCOMPLETE');
      ftruncateSync(fd, length); fsyncSync(fd);
    };
    try { record({ state: 'reserved', nonce: plan.nonce }); }
    catch (error) { closeSync(fd); throw error; }
    return { record, close: () => closeSync(fd) };
  } };
}

async function main(args) {
  if (args.length === 0 || args[0] === '--help') {
    console.log('Node 24+: --describe | --prepare --plan <new-public-plan.json> | --broadcast --plan <reviewed-plan.json> --authorize <exact-plan-digest>');
    return;
  }
  if (args.length === 1 && args[0] === '--describe') {
    console.log(JSON.stringify({ chainId: 137, value: '0', data: COMMITMENT, defaultFeeCeilingPOL: DEFAULT_MAX_FEE_POL, hardMaximumPOL: '0.01' }));
    return;
  }
  const preparing = args.length === 3 && args[0] === '--prepare' && args[1] === '--plan';
  const broadcasting = args.length === 5 && args[0] === '--broadcast' && args[1] === '--plan' && args[3] === '--authorize';
  requireThat(preparing || broadcasting, 'INVALID_EXPLICIT_ACTION');
  const planPath = resolve(args[2]);
  const plan = broadcasting ? JSON.parse(readFileSync(planPath, 'utf8')) : null;
  // Environment is read ONLY after explicit CLI action. No dotenv loading.
  const config = { expectedAddress: process.env.POLYGON_MAINNET_ANCHOR_ADDRESS,
    normalNetwork: process.env.POLYGON_NETWORK, chainId: process.env.POLYGON_MAINNET_CHAIN_ID,
    maxFeePol: process.env.POLYGON_MAINNET_TEST_MAX_FEE_POL };
  validateConfig(config);
  if (broadcasting) validatePlan(plan, config, args[4], Date.now());
  const rpc = process.env.POLYGON_MAINNET_RPC_URL;
  requireThat(typeof rpc === 'string' && rpc.startsWith('https://'), 'HTTPS_MAINNET_RPC_REQUIRED');
  requireThat(!!process.env.POLYGON_MAINNET_ISSUER_PRIVATE_KEY, 'MAINNET_KEY_REQUIRED');
  const provider = new JsonRpcProvider(rpc, undefined, { cacheTimeout: -1, batchMaxCount: 1 });
  const wallet = new Wallet(process.env.POLYGON_MAINNET_ISSUER_PRIVATE_KEY); // offline signer
  const io = {
    chainId: async () => Number(BigInt(await provider.send('eth_chainId', []))),
    address: async () => wallet.address, code: a => provider.getCode(a),
    nonce: (a, tag) => provider.getTransactionCount(a, tag), balance: a => provider.getBalance(a),
    estimateGas: tx => provider.estimateGas(tx), fees: () => provider.getFeeData(),
    sign: tx => wallet.signTransaction(tx), broadcast: async raw => (await provider.broadcastTransaction(raw)).hash,
    waitReceipt: h => provider.waitForTransaction(h, 2, 180000),
    transaction: h => provider.getTransaction(h), receipt: h => provider.getTransactionReceipt(h),
  };
  try {
    if (preparing) {
      const proposal = await prepareIntegration(io, config);
      writeFileSync(planPath, JSON.stringify(proposal, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
      console.log(JSON.stringify({ plan: planPath, authorization: authorizationFor(proposal), transaction_broadcast: false }));
    } else {
      console.log(JSON.stringify(await executeIntegration(io, config, plan, args[4], fileJournal(join(homedir(), '.blockward-integration')))));
    }
  } finally { provider.destroy(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch(error => {
    // Never print RPC/wallet exception text: it may contain credentials or URLs.
    console.error(error instanceof IntegrationError ? error.message : 'INTEGRATION_OPERATION_FAILED');
    process.exitCode = 1;
  });
}
