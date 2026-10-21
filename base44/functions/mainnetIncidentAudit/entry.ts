// mainnetIncidentAudit — READ-ONLY forensic audit of the production anchor
// wallet's recent mainnet self-transactions. Identifies the four synthetic
// transactions broadcast by the original validation harness incident, their
// gas expenditure, timestamps, and whether each is an orphan (no matching
// AnchorBatch record = synthetic) or a legitimate production anchor.
//
// SAFETY: this function performs NO signing, NO broadcast, NO entity writes.
// It reads the anchor wallet's PUBLIC address + RPC URL, queries PolygonScan's
// public API for the wallet's recent outgoing transactions, decodes the batch
// calldata, and cross-references each transaction hash against AnchorBatch
// records (service-role read). A transaction with no matching AnchorBatch is
// an orphan — the synthetic incident record was deleted in cleanup, but the
// on-chain transaction is immutable and remains identifiable.
//
// Auth: internal admin only.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { requireInternalAdmin } from '../../shared/internalAdmin.ts';

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

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (req.method !== 'POST' && req.method !== 'GET') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const base44 = createClientFromRequest(req);
    const { error } = await requireInternalAdmin(base44);
    if (error) return error;

    const svc = base44.asServiceRole;
    const anchorAddress = (Deno.env.get('POLYGON_MAINNET_ANCHOR_ADDRESS') || '').trim();
    const rpc = (Deno.env.get('POLYGON_MAINNET_RPC_URL') || '').trim();
    if (!anchorAddress) return Response.json({ ok: false, error: 'anchor_address_not_configured' }, { status: 500 });

    // Query PolygonScan's public API for the anchor wallet's recent transactions.
    // The public endpoint (no API key) is rate-limited but returns data for
    // low-volume wallets. A 10s timeout keeps the audit responsive.
    const apiUrl = `https://api.polygonscan.com/api?module=account&action=txlist&address=${anchorAddress}&startblock=0&endblock=99999999&page=1&offset=100&sort=desc`;
    let polyScanResult: any = null;
    try {
      const r = await fetch(apiUrl, { signal: AbortSignal.timeout(10000) });
      polyScanResult = await r.json();
    } catch (e) {
      polyScanResult = { status: 'fetch_error', message: String(e?.message || e).slice(0, 200) };
    }

    const rawTxs = Array.isArray(polyScanResult?.result) ? polyScanResult.result : [];
    // Filter: self-transactions (from === to === anchor), zero value, batch calldata.
    const selfBatchTxs = rawTxs.filter((t: any) =>
      String(t.from || '').toLowerCase() === anchorAddress.toLowerCase()
      && String(t.to || '').toLowerCase() === anchorAddress.toLowerCase()
      && String(t.value || '0') === '0'
      && String(t.input || '').toLowerCase().startsWith(BATCH_PAYLOAD_PREFIX)
    );

    // Cross-reference each tx hash against AnchorBatch records. An orphan
    // (no matching batch) is a synthetic incident transaction — the batch
    // record was deleted in cleanup, but the on-chain tx is immutable.
    const txHashes = selfBatchTxs.map((t: any) => String(t.hash));
    let batchByTx: Record<string, any> = {};
    if (txHashes.length) {
      const rows = await svc.entities.AnchorBatch.filter({ transaction_hash: { $in: txHashes } }, { limit: 100 });
      const items = rows?.items || rows || [];
      for (const b of items) batchByTx[String(b.transaction_hash).toLowerCase()] = b;
    }

    const findings = selfBatchTxs.map((t: any) => {
      const payload = parseBatchPayload(t.input);
      const txHash = String(t.hash);
      const matchedBatch = batchByTx[txHash.toLowerCase()] || null;
      const gasUsed = Number(t.gasUsed || 0);
      const gasPriceGwei = Number(t.gasPrice || 0) / 1e9;
      const feeWei = BigInt(t.gasUsed || 0) * BigInt(t.gasPrice || 0);
      const feePol = Number(feeWei) / 1e18;
      return {
        transaction_hash: txHash,
        block_number: Number(t.blockNumber || 0),
        timestamp: new Date(Number(t.timeStamp || 0) * 1000).toISOString(),
        gas_used: gasUsed,
        gas_price_gwei: Math.round(gasPriceGwei * 100) / 100,
        fee_pol: feePol,
        fee_usd_estimate: Math.round(feePol * 0.30 * 100000) / 100000, // fallback POL price
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
      rpc_configured: !!rpc,
      poly_scan_status: polyScanResult?.status || 'unknown',
      poly_scan_message: polyScanResult?.message || null,
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