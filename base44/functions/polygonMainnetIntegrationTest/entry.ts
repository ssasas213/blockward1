// polygonMainnetIntegrationTest — FIRST Polygon PoS MAINNET integration test,
// PRE-BROADCAST ONLY. This function performs NO signing, NO broadcast, NO
// blockchain writes, NO credential/achievement changes, and NEVER reads or
// touches POLYGON_NETWORK as an issuance selector.
//
// It builds a deterministic, PII-free test commitment and runs the SAME
// calldata anchoring architecture as production (self-transaction, value=0,
// calldata-only) ONLY as a gas estimate against that exact calldata — never
// sent. A final pre-broadcast readiness report is returned.
//
// Deterministic test payload ( NOTHING ELSE ):
//   { v:1, t:'blockward-mainnet-integration-test',
//     label:'BLOCKWARD MAINNET INTEGRATION TEST', pii:false }
// No hashes, no token ids, no credential references. It does NOT reuse
// BW-HASH-V1 (unchanged) and does NOT call normal credential issuance.
//
// Admin-only. Returns ONLY public/safe fields:
//   MAINNET_TEST_READY, chain_id, signer_matches, balance_sufficient,
//   normal_issuance_network, estimated_gas, estimated_max_fee_POL,
//   payload_contains_PII, transaction_broadcast (always false).
// Never returns: private key, partial key, key length, RPC API key, or
// secret-bearing URL.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { createPublicClient, http, defineChain, stringToHex, getAddress, isAddress } from 'npm:viem@2.7.0';
import { privateKeyToAccount } from 'npm:viem@2.7.0/accounts';
import { requireInternalAdmin } from '../../shared/internalAdmin.ts';
import { resolvePolygonTarget } from '../../shared/chainPolygon.ts';

const polygonMainnet = defineChain({
  id: 137,
  name: 'Polygon',
  nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
  rpcUrls: { default: { http: ['https://polygon-rpc.com'] } },
  blockExplorers: { default: { name: 'PolygonScan', url: 'https://polygonscan.com' } },
});

// The ONE deterministic test commitment. Nothing on-chain beyond this.
const TEST_LABEL = 'BLOCKWARD MAINNET INTEGRATION TEST';
const TEST_PAYLOAD = JSON.stringify({
  v: 1,
  t: 'blockward-mainnet-integration-test',
  label: TEST_LABEL,
  pii: false,
});
const TEST_CALLDATA = stringToHex(TEST_PAYLOAD);

// PII scan: the test payload is a fixed constant with no free text. We still
// verify it contains no email/phone/name-ish tokens before any broadcast.
const PII_PATTERNS = [/@/i, /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/, /\b(name|email|phone|address|dob|ssn)\b/i];
function payloadContainsPii(s: string): boolean {
  return PII_PATTERNS.some((re) => re.test(s));
}

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
    const configuredChainId = Number(Deno.env.get('POLYGON_MAINNET_CHAIN_ID') || 137);

    // ── Gate 3 + 4: signing key valid + derived PUBLIC address matches anchor ──
    let signerKeyValid = false;
    let derivedAddress: string | null = null;
    let configError: string | null = null;
    if (signingKey) {
      try {
        const account = privateKeyToAccount(signingKey as `0x${string}`);
        derivedAddress = account.address; // PUBLIC only
        signerKeyValid = true;
      } catch {
        signerKeyValid = false;
        configError = 'signer_key_invalid_format';
      }
    } else {
      configError = 'signer_key_missing';
    }
    const signerMatches = addressesMatch(derivedAddress, expectedAddress);

    // Pre-init a report object with all gates false.
    const report: Record<string, unknown> = {
      MAINNET_TEST_READY: false,
      chain_id: null,
      signer_matches: signerMatches,
      balance_sufficient: false,
      normal_issuance_network: null,
      estimated_gas: null,
      estimated_max_fee_POL: null,
      payload_contains_PII: payloadContainsPii(TEST_PAYLOAD),
      transaction_broadcast: false,
      config_error: configError,
    };

    // ── Gate 6: normal issuance network MUST stay polygon_amoy ──
    // resolvePolygonTarget() reads POLYGON_NETWORK; this test must NOT
    // change it and must refuse if it is not the documented current default.
    const resolved = resolvePolygonTarget();
    const normalIssuanceTarget = 'target' in resolved ? resolved.target : (`unsupported:${resolved.value}`);
    report.normal_issuance_network = normalIssuanceTarget;

    // Hard pre-conditions before any RPC work.
    if (configError) return Response.json(report);
    if (!rpc || !expectedAddress) return Response.json(report);
    if (!signerKeyValid || !signerMatches) return Response.json(report);

    // ── Gate 1 + 2: RPC reachable + chain ID exactly 137 ──
    try {
      const pub = createPublicClient({ chain: polygonMainnet, transport: http(rpc) });
      const liveChainId = await pub.getChainId().catch(() => null);
      report.chain_id = liveChainId;
      if (liveChainId !== 137 || liveChainId !== configuredChainId) return Response.json(report);

      // ── Gate 5: balance > estimated gas requirement ──
      // Exact calldata this test WOULD send (never sent here): self-transaction,
      // value=0, data=TEST_CALLDATA. Gas estimate uses that same calldata.
      const signer = derivedAddress as `0x${string}`;
      let balanceWei: bigint | null = null;
      try { balanceWei = await pub.getBalance({ address: signer }); } catch { balanceWei = null; }

      let gasEstimate: bigint | null = null;
      try {
        gasEstimate = await pub.estimateGas({
          account: signer,
          to: signer,
          value: 0n,
          data: TEST_CALLDATA,
        });
      } catch {
        gasEstimate = null;
      }

      const gasPrice = await pub.getGasPrice().catch(() => null);

      const estimatedGas = gasEstimate != null ? Number(gasEstimate) : null;
      const maxFeeWei = gasEstimate != null && gasPrice != null ? gasEstimate * gasPrice : null;
      const maxFeePol = maxFeeWei != null ? Number(maxFeeWei) / 1e18 : null;

      report.estimated_gas = estimatedGas;
      report.estimated_max_fee_POL = maxFeePol != null ? Number(maxFeePol.toFixed(8)) : null;

      const balanceSufficient =
        balanceWei != null && maxFeeWei != null && balanceWei > maxFeeWei;
      report.balance_sufficient = balanceSufficient;

      // ── Gate 7: payload contains no PII (already computed) ──
      const piiOk = report.payload_contains_PII === false;

      // ── FINAL pre-broadcast readiness: ALL gates must pass ──
      const allReady =
        liveChainId === 137 &&
        signerMatches &&
        balanceSufficient &&
        normalIssuanceTarget === 'polygon_amoy' &&
        piiOk &&
        report.transaction_broadcast === false;

      report.MAINNET_TEST_READY = allReady;
      return Response.json(report);
    } catch {
      return Response.json(report);
    }
  } catch {
    return Response.json({ error: 'integration_test_preflight_failed' }, { status: 500 });
  }
}