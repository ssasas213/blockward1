// mainnetIncidentAudit — READ-ONLY forensic audit of the production anchor
// wallet's mainnet self-transactions. Identifies the four synthetic
// transactions broadcast by the original validation harness incident, their
// gas expenditure, timestamps, and whether each is an orphan (no matching
// AnchorBatch record = synthetic) or a legitimate production anchor.
//
// SAFETY: this function performs NO signing, NO broadcast, NO entity writes.
// It reads the anchor wallet's PUBLIC address + RPC URL, locates each outgoing
// transaction via a historical-nonce binary search (O(log n) RPC calls, not a
// linear block scan), decodes the batch calldata, and cross-references each
// transaction hash against AnchorBatch records (service-role read). A
// transaction with no matching AnchorBatch is an orphan — the synthetic
// incident record was deleted in cleanup, but the on-chain transaction is
// immutable and remains identifiable.
//
// Auth: internal admin only.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { requireInternalAdmin } from '../../shared/internalAdmin.ts';
import { resolvePolygonConfig } from '../../shared/chainPolygon.ts';
import { createPublicClient, http } from 'npm:viem@2.7.0';

const BATCH_PAYLOAD_PREFIX = '7b2276223a312c2274223a22626c6f636b776172642d6261746368'; // {"v":1,"t":"blockward-batch

function hexToUtf8(hex: string): string {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(h.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

function parseBatchPayload(input: string): { root: string; memberCount: number } | null {
  try {
    const text = hexToUtf8(input);
    const meta = JSON.parse(text);
    if (meta?.v !== 1 || meta?.t !== 'blockward-batch' || meta?.hv !== 1
      || !Number.isInteger(meta?.n) || meta.n < 1
      || typeof meta.r !== 'string' || !/^[0-9a-f]{64}$/.test(meta.r)) return null;
    return { root: meta.r, memberCount: meta.n };
  } catch { return null; }
}

// Binary search for the earliest block where the anchor wallet's nonce first
// reaches `target` — i.e., the block that contains the outgoing transaction
// whose nonce is (target - 1). Returns null when the nonce never reaches that
// value in the search range. O(log n) RPC calls, not a linear block scan.
async function findNonceTransitionBlock(pub: any, address: string, target: bigint, lo: bigint, hi: bigint): Promise<bigint | null> {
  let left = lo, right = hi, result: bigint | null = null;
  while (left <= right) {
    const mid = left + (right - left) / 2n;
    let n = 0n;
    try { n = BigInt(await pub.getTransactionCount({ address: address as `0x${string}`, blockNumber: mid })); }
    catch { n = 0n; }
    if (n >= target) { result = mid; right = mid - 1n; }
    else { left = mid + 1n; }
  }
  return result;
}

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (req.method !== 'POST' && req.method !== 'GET') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const base44 = createClientFromRequest(req);
    const { error } = await requireInternalAdmin(base44);
    if (error) return error;

    const svc = base44.asServiceRole;
    const anchorAddress = (Deno.env.get('POLYGON_MAINNET_ANCHOR_ADDRESS') || '').trim();
    if (!anchorAddress) return Response.json({ ok: false, error: 'anchor_address_not_configured' }, { status: 500 });

    const cfg = resolvePolygonConfig('polygon_mainnet');
    const pub = createPublicClient({ chain: (cfg as any).chain, transport: http(cfg.rpc as string) });

    const currentBlock = await pub.getBlockNumber();
    const nonce = await pub.getTransactionCount({ address: anchorAddress as `0x${string}` });

    // The anchor wallet is low-volume: its nonce equals its total outgoing tx
    // count. For each nonce value (0..nonce-1), binary-search the block where
    // the nonce first reached (value+1) — that block contains the tx. The
    // search range widens forward from the previous tx's block, because the
    // nonce increases monotonically with block height.
    const selfBatchTxs: any[] = [];
    const anchorLower = anchorAddress.toLowerCase();
    let lowerBound = 0n; // advances forward as each tx block is found
    for (let n = 0n; n < nonce; n++) {
      const txBlock = await findNonceTransitionBlock(pub, anchorAddress, n + 1n, lowerBound, currentBlock);
      if (txBlock === null) break;
      lowerBound = txBlock + 1n; // next tx is in a later block
      let block: any = null;
      try { block = await pub.getBlock({ blockNumber: txBlock, includeTransactions: true }); } catch { continue; }
      for (const tx of (block?.transactions || []) as any[]) {
        const from = String(tx.from || '').toLowerCase();
        if (from !== anchorLower) continue; // any outgoing tx from the anchor wallet
        const to = String(tx.to || '').toLowerCase();
        const input = String(tx.input || '').toLowerCase();
        const inputNoPrefix = input.startsWith('0x') ? input.slice(2) : input;
        selfBatchTxs.push({
          hash: String(tx.hash),
          block_number: Number(block.number),
          timestamp: new Date(Number(block.timestamp) * 1000).toISOString(),
          to_address: to || null,
          value_wei: tx.value != null ? String(tx.value) : '0',
          gas_used: Number(tx.gas || 0),
          gas_price_wei: tx.gasPrice ? String(tx.gasPrice) : null,
          gas_price_gwei: tx.gasPrice ? Number(tx.gasPrice) / 1e9 : 0,
          input: String(tx.input || ''),
          is_batch_calldata: inputNoPrefix.startsWith(BATCH_PAYLOAD_PREFIX),
          nonce: Number(tx.nonce || 0),
        });
      }
    }
    selfBatchTxs.sort((a, b) => a.nonce - b.nonce);

    // Cross-reference each tx hash against AnchorBatch records. An orphan
    // (no matching batch) is a synthetic incident transaction — the batch
    // record was deleted in cleanup, but the on-chain tx is immutable.
    const txHashes = selfBatchTxs.map((t) => t.hash);
    let batchByTx: Record<string, any> = {};
    if (txHashes.length) {
      const rows = await svc.entities.AnchorBatch.filter({ transaction_hash: { $in: txHashes } }, { limit: 100 });
      const items = rows?.items || rows || [];
      for (const b of items) batchByTx[String(b.transaction_hash).toLowerCase()] = b;
    }

    const findings = selfBatchTxs.map((t) => {
      const payload = t.is_batch_calldata ? parseBatchPayload(t.input) : null;
      const matchedBatch = batchByTx[t.hash.toLowerCase()] || null;
      const gasUsed = Number(t.gas_used || 0);
      const gasPriceGwei = Number(t.gas_price_gwei || 0);
      const feeWei = BigInt(gasUsed) * BigInt(Math.round(gasPriceGwei * 1e9));
      const feePol = Number(feeWei) / 1e18;
      return {
        transaction_hash: t.hash,
        block_number: t.block_number,
        timestamp: t.timestamp,
        nonce: t.nonce,
        to_address: t.to_address,
        value_wei: t.value_wei,
        gas_used: gasUsed,
        gas_price_gwei: Math.round(gasPriceGwei * 100) / 100,
        fee_pol: feePol,
        fee_usd_estimate: Math.round(feePol * 0.30 * 100000) / 100000, // fallback POL price
        is_batch_calldata: t.is_batch_calldata,
        parsed_root: payload?.root || null,
        parsed_member_count: payload?.memberCount || null,
        matched_batch_ref: matchedBatch?.batch_ref || null,
        matched_batch_status: matchedBatch?.status || null,
        orphaned: !matchedBatch, // no AnchorBatch record = synthetic incident tx
      };
    });

    const orphaned = findings.filter((f) => f.orphaned);
    const legit = findings.filter((f) => !f.orphaned);

    return Response.json({
      ok: true,
      anchor_address: anchorAddress,
      rpc_configured: !!cfg.rpc,
      scan_method: 'rpc_nonce_binary_search',
      current_block: Number(currentBlock),
      anchor_nonce: nonce,
      total_self_batch_txs: findings.length,
      orphaned_count: orphaned.length,
      legit_count: legit.length,
      orphaned_transactions: orphaned,
      legit_transactions: legit,
      note: 'Orphaned transactions have no matching AnchorBatch record — they are the synthetic incident transactions (batch records were deleted in cleanup, but on-chain transactions are immutable). Zero signing, zero broadcast, zero entity writes in this audit.',
    });
  } catch (error) {
    return Response.json({ ok: false, error: String(error?.message || error).slice(0, 300) }, { status: 500 });
  }
}