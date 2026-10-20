// activationSafetyState — READ-ONLY activation state probe for the operator
// handoff. Performs NO transaction, NO signing, NO entity writes, NO secret
// reads beyond booleans.
//
// Returns ONLY safe state:
//   kill_switch_enabled          — MAINNET_BROADCAST_ENABLED is strictly 'true'
//   selector_configured          — POLYGON_NETWORK is explicitly set
//   effective_issuance_network   — what the resolver resolves NOW ('polygon_amoy' | 'polygon_mainnet' | null)
//   mainnet_broadcast_possible   — true ONLY when kill switch is on AND the
//                                  selector resolves to mainnet (fail-closed
//                                  resolution would otherwise refuse mainnet)
//   unsupported_selector_value   — set ONLY when POLYGON_NETWORK holds an
//                                  unknown explicit value (fail-closed state)
//
// NEVER returned: any secret value, key, RPC URL, or allowlist content.
// Internal-admin only (same gate as polygonMainnetHealth).
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { mainnetBroadcastEnabled, resolvePolygonTarget } from '../../shared/chainPolygon.ts';
import { requireInternalAdmin } from '../../shared/internalAdmin.ts';

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (req.method !== 'POST' && req.method !== 'GET') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const base44 = createClientFromRequest(req);
    const { error } = await requireInternalAdmin(base44);
    if (error) return error;

    const killSwitch = mainnetBroadcastEnabled();
    const resolved = resolvePolygonTarget();

    const raw = String(Deno.env.get('POLYGON_NETWORK') || '').trim().toLowerCase();
    const selectorConfigured = raw !== '';

    let effectiveIssuance: string | null = null;
    let unsupportedSelectorValue: string | null = null;
    let mainnetBroadcastPossible = false;

    if ('unsupported' in resolved) {
      // Fail-closed state. The resolver's value is a NETWORK LABEL (e.g.
      // 'mainnet_broadcast_disabled') — safe to surface, never a secret.
      unsupportedSelectorValue = resolved.value;
    } else {
      effectiveIssuance = resolved.target;
      mainnetBroadcastPossible = killSwitch && resolved.target === 'polygon_mainnet';
    }

    return Response.json({
      checked_at: new Date().toISOString(),
      kill_switch_enabled: killSwitch,
      selector_configured: selectorConfigured,
      effective_issuance_network: effectiveIssuance,
      mainnet_broadcast_possible: mainnetBroadcastPossible,
      unsupported_selector_value: unsupportedSelectorValue,
      // Operator-facing interpretation, booleans only:
      activation_state: mainnetBroadcastPossible ? 'ACTIVATED_MAINNET'
        : (effectiveIssuance === 'polygon_amoy' ? 'TESTNET_MODE' : 'FAIL_CLOSED'),
    });
  } catch {
    return Response.json({ error: 'activation_state_check_failed' }, { status: 500 });
  }
}