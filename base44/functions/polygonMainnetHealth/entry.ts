// polygonMainnetHealth — READ-ONLY mainnet readiness check. Performs NO
// transaction and NO signing. Reports whether the production RPC is reachable,
// reports chain ID 137, can read the latest block, and whether the expected
// anchor public address + signing key are configured. NEVER returns private
// keys, RPC API keys, or secret-bearing URLs. Admin-only.
//
// Used to confirm production infrastructure is wired without activating
// mainnet issuance (NETWORK remains polygon_amoy).
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { createPublicClient, http, defineChain } from 'npm:viem@2.7.0';
import { requireInternalAdmin } from '../../shared/internalAdmin.ts';

const polygonMainnet = defineChain({
  id: 137,
  name: 'Polygon',
  nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
  rpcUrls: { default: { http: ['https://polygon-rpc.com'] } },
  blockExplorers: { default: { name: 'PolygonScan', url: 'https://polygonscan.com' } },
});

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (req.method !== 'POST' && req.method !== 'GET') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const base44 = createClientFromRequest(req);
    const { error } = await requireInternalAdmin(base44);
    if (error) return error;

    const rpc = Deno.env.get('POLYGON_MAINNET_RPC_URL') || null;
    const expectedAddress = Deno.env.get('POLYGON_MAINNET_ANCHOR_ADDRESS') || null;
    const signerConfigured = !!Deno.env.get('POLYGON_MAINNET_ISSUER_PRIVATE_KEY');

    const out: Record<string, unknown> = {
      network: 'polygon_mainnet',
      configured_chain_id: 137,
      chain_id: null,
      rpc_configured: !!rpc,
      rpc_reachable: false,
      latest_block_readable: false,
      expected_anchor_address_configured: !!expectedAddress,
      signer_configured: signerConfigured,
      ready_to_sign: false,
    };

    if (!rpc) return Response.json(out); // fail closed — no RPC to probe

    try {
      const pub = createPublicClient({ chain: polygonMainnet, transport: http(rpc) });
      const cid = await pub.getChainId().catch(() => null);
      out.chain_id = cid;
      if (cid !== 137) {
        // Wrong chain — do NOT sign against it. Read-only report only.
        return Response.json(out);
      }
      out.rpc_reachable = true;
      const bn = await pub.getBlockNumber().catch(() => null);
      out.latest_block_readable = bn != null;
      out.ready_to_sign = out.rpc_reachable && out.latest_block_readable && !!expectedAddress && signerConfigured;
      return Response.json(out);
    } catch {
      // RPC unreachable — never expose the URL or key. Read-only failure.
      return Response.json(out);
    }
  } catch (error) {
    return Response.json({ error: 'health_check_failed' }, { status: 500 });
  }
}