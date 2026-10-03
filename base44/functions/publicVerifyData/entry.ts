// publicVerifyData — the PUBLIC verification page and the homepage lookup
// tool's data source. Public and anonymous: given a Blockward Credential ID,
// returns only public fields — never the holder's email or private files —
// plus the live credential-integrity check against the Polygon PoS anchor.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { verifyCredentialAnchor } from '../../shared/chainPolygon.ts';
import { calculateCredentialTrust } from '../../shared/credentialTrust.ts';
import { rateLimit, methodLabel } from '../../shared/verificationFlow.ts';
import { methodLabel as emailMethodLabel } from '../../shared/issuerEmails.ts';

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const body = await req.json().catch(() => ({}));
    const raw = String(body.bw_id || '').trim().toUpperCase().replace(/\s+/g, '');
    if (!raw) return Response.json({ error: 'Enter a Blockward Credential ID' }, { status: 400 });
    if (!rateLimit('pv', 60, 60000)) return Response.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 });

    // Accept "BW-7F92K3" or a bare "7F92K3".
    const bwId = raw.startsWith('BW-') ? raw : `BW-${raw}`;

    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const rows = await svc.entities.Credential.filter({ bw_id: bwId });
    const cred = rows?.[0];
    if (!cred || cred.is_public === false) {
      // Do not distinguish private vs unknown — no credential enumeration.
      return Response.json({ found: false });
    }

    // Credential integrity — recompute the hash from CURRENT content and
    // compare against the on-chain commitment.
    const integrity = await verifyCredentialAnchor(svc, cred);

    // The canonical layered trust calculation (§34). Reuses the integrity
    // result above so no second RPC is made (§42). Additive — all existing
    // response fields are preserved, this attaches a `trust` object.
    const trust = await calculateCredentialTrust(svc, cred, { integrity });

    // Expiry-derived validity — an expired credential is never "currently valid".
    const today = new Date().toISOString().slice(0, 10);
    let validity = 'valid';
    if (cred.status === 'revoked') validity = 'revoked';
    else if (cred.expires_at && cred.expires_at < today) validity = 'expired';
    else if (cred.expires_at && new Date(cred.expires_at).getTime() - Date.now() < 30 * 86400000) validity = 'expiring_soon';

    return Response.json({
      found: true,
      trust,
      credential: {
        bw_id: cred.bw_id,
        holder_display_name: cred.holder_display_name,
        issuer_org: cred.issuer_org,
        issuer_website: cred.issuer_website || null,
        title: cred.title,
        category: cred.category,
        description: cred.description || '',
        date_achieved: cred.date_achieved || null,
        expires_at: cred.expires_at || null,
        verified_at: cred.verified_at || null,
        verification_method_label: emailMethodLabel(cred.verification_method),
        schema_version: cred.schema_version || 1,
        status: cred.status,
        validity,
      },
      blockchain: {
        secured: trust.integrity_status === 'confirmed',
        status: cred.blockchain?.status || 'pending',
        network: integrity.network,
        testnet: integrity.testnet !== false,
        anchor_mode: cred.blockchain?.anchor_mode || null,
        transaction_hash: cred.blockchain?.transaction_hash || null,
        block_number: cred.blockchain?.block_number ?? null,
        block_timestamp: cred.blockchain?.block_timestamp || null,
        contract_address: cred.blockchain?.contract_address || null,
        explorer_url: cred.blockchain?.transaction_hash
          ? `https://${integrity.network === 'polygon' ? '' : 'amoy.'}polygonscan.com/tx/${cred.blockchain.transaction_hash}`
          : null,
      },
      integrity: {
        status: trust.integrity_status === 'confirmed' ? 'confirmed' : (integrity.status === 'confirmed' ? 'pending' : integrity.status),
        checked_at: integrity.checked_at || null,
        committed_hash: integrity.committed_hash || null,
      },
    });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to verify credential' }, { status: 500 });
  }
}
