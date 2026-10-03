// polygonMainnetIntegrationTest — FIRST Polygon PoS MAINNET integration test,
// PRE-BROADCAST ONLY. This function performs NO signing, NO broadcast, NO
// blockchain writes, NO credential/achievement changes. Reads POLYGON_NETWORK
// only to verify issuance remains on Amoy; never changes the selector.
//
// It builds a deterministic, PII-free test commitment and runs the SAME
// calldata anchoring architecture as production (self-transaction, value=0,
// calldata-only) ONLY as a gas estimate against that exact calldata — never
// sent. A final pre-broadcast readiness report is returned.
//
// Calldata is ONLY the raw 32-byte SHA-256 of the fixed, domain-separated
// synthetic preimage below. No readable marker or credential references.
// It does NOT reuse BW-HASH-V1 (unchanged) or call normal credential issuance.
//
// Admin-only. Returns ONLY public/safe fields:
//   MAINNET_TEST_READY, chain_id, signer_matches, balance_sufficient,
//   normal_issuance_network, estimated_gas, estimated_max_fee_POL,
//   payload_contains_PII, transaction_broadcast (always false), fee ceiling,
//   and a public unsigned transaction proposal. Gas/fee quantities are exact
//   decimal strings; estimated_max_fee_POL is the proposal's maximum cost.
// Never returns: private key, partial key, key length, RPC API key, or
// secret-bearing URL.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { createPublicClient, http, defineChain, getAddress, isAddress } from 'npm:viem@2.7.0';
import { privateKeyToAccount } from 'npm:viem@2.7.0/accounts';
import { requireInternalAdmin } from '../../shared/internalAdmin.ts';
import { resolvePolygonTarget } from '../../shared/chainPolygon.ts';
import { sha256Hex } from '../../shared/credentialHash.ts';
import { INTEGRATION_ID as TEST_PREIMAGE, DEFAULT_MAX_FEE_POL, feeCeilingWei, formatPol } from '../../shared/mainnetIntegrationPolicy.ts';

const polygonMainnet = defineChain({
  id: 137,
  name: 'Polygon',
  nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
  rpcUrls: { default: { http: ['https://polygon-rpc.com'] } },
  blockExplorers: { default: { name: 'PolygonScan', url: 'https://polygonscan.com' } },
});

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
    const feeCap = feeCeilingWei(Deno.env.get('POLYGON_MAINNET_TEST_MAX_FEE_POL') ?? DEFAULT_MAX_FEE_POL);
    const testCalldata = `0x${await sha256Hex(TEST_PREIMAGE)}` as `0x${string}`;

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
      payload_contains_PII: false, // fixed synthetic preimage; calldata is its digest only
      fee_within_ceiling: false,
      maximum_fee_POL: feeCap == null ? null : formatPol(feeCap),
      proposed_transaction: null,
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
    if (feeCap == null) {
      report.config_error = 'invalid_test_fee_ceiling';
      return Response.json(report);
    }
    if (normalIssuanceTarget !== 'polygon_amoy') return Response.json(report);
    if (configError) return Response.json(report);
    if (!rpc || !expectedAddress) return Response.json(report);
    if (!signerKeyValid || !signerMatches) return Response.json(report);

    // ── Gate 1 + 2: RPC reachable + chain ID exactly 137 ──
    try {
      const pub = createPublicClient({ chain: polygonMainnet, transport: http(rpc) });
      const liveChainId = await pub.getChainId().catch(() => null);
      report.chain_id = liveChainId;
      if (liveChainId !== 137 || liveChainId !== configuredChainId) return Response.json(report);

      // ── Gate 5: balance covers the proposal's maximum gas cost ──
      // Exact calldata this test WOULD send (never sent here): self-transaction,
      // value=0, data=testCalldata. Gas estimate uses that same calldata.
      const signer = derivedAddress as `0x${string}`;
      let balanceWei: bigint | null = null;
      try { balanceWei = await pub.getBalance({ address: signer }); } catch { balanceWei = null; }

      let gasEstimate: bigint | null = null;
      try {
        gasEstimate = await pub.estimateGas({
          account: signer,
          to: signer,
          value: 0n,
          data: testCalldata,
        });
      } catch {
        gasEstimate = null;
      }

      const fees = await pub.estimateFeesPerGas({ type: 'eip1559' }).catch(() => null);
      if (gasEstimate == null || gasEstimate <= 0n || !fees
        || typeof fees.maxFeePerGas !== 'bigint' || fees.maxFeePerGas <= 0n
        || typeof fees.maxPriorityFeePerGas !== 'bigint' || fees.maxPriorityFeePerGas < 0n
        || fees.maxPriorityFeePerGas > fees.maxFeePerGas) return Response.json(report);

      // Explicit gas limit (20% margin) and EIP-1559 fee caps bound the entire
      // proposed zero-value transaction, not merely its current expected fee.
      const gasLimit = (gasEstimate * 120n + 99n) / 100n;
      const maxFeeWei = gasLimit * fees.maxFeePerGas;
      report.estimated_gas = gasEstimate.toString();
      report.estimated_max_fee_POL = formatPol(maxFeeWei);
      const feeWithinCeiling = maxFeeWei <= feeCap;
      report.fee_within_ceiling = feeWithinCeiling;
      if (!feeWithinCeiling) return Response.json(report);

      // Public unsigned proposal only. A future broadcaster MUST re-run all
      // gates and preserve these gas/fee limits; this function cannot send it.
      report.proposed_transaction = {
        chainId: 137, type: 'eip1559', from: signer, to: signer,
        value: '0', data: testCalldata, gas: gasLimit.toString(),
        maxFeePerGas: fees.maxFeePerGas.toString(),
        maxPriorityFeePerGas: fees.maxPriorityFeePerGas.toString(),
      };
      const balanceSufficient = balanceWei != null && balanceWei >= maxFeeWei;
      report.balance_sufficient = balanceSufficient;

      // ── Gate 7: payload contains no PII (already computed) ──
      const piiOk = report.payload_contains_PII === false;

      // ── FINAL pre-broadcast readiness: ALL gates must pass ──
      const allReady =
        liveChainId === 137 &&
        signerMatches &&
        balanceSufficient &&
        feeWithinCeiling &&
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
