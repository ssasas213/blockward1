// ============================================================================
// config — resolve the staging environment from AMOY_STAGING_* secrets ONLY.
//
// ISOLATION: reads exclusively from process.env. Never accesses Base44 secrets,
// the Base44 SDK, or any production credential. The only supported chain is
// Polygon Amoy (chain ID 80002) — hardcoded, never configurable.
// ============================================================================

export const AMOY_CHAIN_ID = 80002;

export interface StagingConfig {
  signingKey: string;
  signerAddress: string;
  rpc: string;
  chainId: number;
}

export type ConfigResult =
  | { ok: true; config: StagingConfig }
  | { ok: false; error: 'staging_config_missing'; missing: string[] };

export function resolveConfig(
  env: Record<string, string | undefined> = process.env
): ConfigResult {
  const missing: string[] = [];
  const signingKey = env.AMOY_STAGING_PRIVATE_KEY;
  const signerAddress = env.AMOY_STAGING_ANCHOR_ADDRESS;
  const rpc = env.AMOY_STAGING_RPC_URL;

  if (!signingKey) missing.push('AMOY_STAGING_PRIVATE_KEY');
  if (!signerAddress) missing.push('AMOY_STAGING_ANCHOR_ADDRESS');
  if (!rpc) missing.push('AMOY_STAGING_RPC_URL');

  if (missing.length > 0) {
    return { ok: false, error: 'staging_config_missing', missing };
  }

  return {
    ok: true,
    config: {
      signingKey: signingKey as string,
      signerAddress: signerAddress as string,
      rpc: rpc as string,
      chainId: AMOY_CHAIN_ID,
    },
  };
}