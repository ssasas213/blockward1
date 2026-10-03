// polygonMainnetHealth — READ-ONLY mainnet readiness check. Performs NO
// transaction, NO signing, NO blockchain writes, NO credential changes.
//
// Confirms production infra is wired AND that the configured production
// signing key derives the PUBLIC address that exactly matches
// POLYGON_MAINNET_ANCHOR_ADDRESS — without ever exposing the key.
//
// safe fields returned:
//   signer_key_configured       — a POLYGON_MAINNET_ISSUER_PRIVATE_KEY is present
//   signer_key_valid            — viem privateKeyToAccount succeeds on it
//   signer_address_matches_anchor — derived PUBLIC address == configured anchor address
//
// ready_to_sign is true ONLY when ALL gates pass. If key derivation fails,
// signer_key_valid/signer_address_matches_anchor/ready_to_sign are false and a
// generic configuration error is reported — the invalid value is never exposed.
//
// Admin-only. Never returns: private key, partial key, key length, key hash,
// RPC API key, or secret-bearing URL. The configured PUBLIC anchor address is
// the only address returned.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { createPublicClient, http, defineChain } from 'npm:viem@2.7.0';
import { privateKeyToAccount } from 'npm:viem@2.7.0/accounts';
import { getAddress, isAddress } from 'npm:viem@2.7.0';
import { requireInternalAdmin } from '../../shared/internalAdmin.ts';

const polygonMainnet = defineChain({
  id: 137,
  name: 'Polygon',
  nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
  rpcUrls: { default: { http: ['https://polygon-rpc.com'] } },
  blockExplorers: { default: { name: 'PolygonScan', url: 'https://polygonscan.com' } },
});

// Safe case-insensitive/checksummed comparison of two EVM addresses.
function addressesMatch(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  if (!isAddress(a) || !isAddress(b)) return false;
  try { return getAddress(a).toLowerCase() === getAddress(b).toLowerCase(); }
  catch { return a.toLowerCase() === b.toLowerCase(); }
}

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (req.method !== 'POST' && req.method !== 'GET') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const base44 = createClientFromRequest(req);
    const { error } = await requireInternalAdmin(base44);
    if (error) return error;

    const rpc = Deno.env.get('POLYGON_MAINNET_RPC_URL') || null;
    const expectedAddressRaw = Deno.env.get('POLYGON_MAINNET_ANCHOR_ADDRESS') || null;
    const expectedAddress = expectedAddressRaw && isAddress(expectedAddressRaw) ? getAddress(expectedAddressRaw) : null;
    const signingKey = Deno.env.get('POLYGON_MAINNET_ISSUER_PRIVATE_KEY') || null;

    // 1-3: derive the PUBLIC address server-side from the configured key.
    // Failure → signer_key_valid=false, no value exposed.
    let signerKeyValid = false;
    let derivedAddress: string | null = null;
    let configError: string | null = null;
    if (signingKey) {
      try {
        const account = privateKeyToAccount(signingKey as `0x${string}`);
        derivedAddress = account.address; // PUBLIC address only
        signerKeyValid = true;
      } catch {
        signerKeyValid = false;
        configError = 'signer_key_invalid_format';
      }
    } else {
      configError = 'signer_key_missing';
    }

    // 4-5: compare derived PUBLIC address to configured anchor ( PUBLIC ).
    const signerMatches = addressesMatch(derivedAddress, expectedAddress);

    const out: Record<string, unknown> = {
      network: 'polygon_mainnet',
      configured_chain_id: 137,
      chain_id: null,
      rpc_configured: !!rpc,
      rpc_reachable: false,
      latest_block_readable: false,
      expected_anchor_address_configured: !!expectedAddress,
      expected_anchor_address: expectedAddress || null, // PUBLIC address — safe to return
      signer_key_configured: !!signingKey,
      signer_key_valid: signerKeyValid,
      signer_address_matches_anchor: signerMatches,
      ready_to_sign: false,
    };
    if (configError) out.config_error = configError; // generic — no value

    if (!rpc) return Response.json(out);

    // Read-only RPC probe only.
    try {
      const pub = createPublicClient({ chain: polygonMainnet, transport: http(rpc) });
      const cid = await pub.getChainId().catch(() => null);
      out.chain_id = cid;
      if (cid !== 137) return Response.json(out); // wrong chain — do not sign against it
      out.rpc_reachable = true;
      const bn = await pub.getBlockNumber().catch(() => null);
      out.latest_block_readable = bn != null;

      // 9: ready_to_sign true ONLY when every gate passes.
      out.ready_to_sign =
        !!rpc && out.rpc_reachable === true && cid === 137 &&
        out.latest_block_readable === true && !!expectedAddress &&
        !!signingKey && signerKeyValid && signerMatches;

      return Response.json(out);
    } catch {
      return Response.json(out); // RPC unreachable — read-only failure, no exposure
    }
  } catch {
    return Response.json({ error: 'health_check_failed' }, { status: 500 });
  }
}