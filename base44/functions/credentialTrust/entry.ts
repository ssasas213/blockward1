// credentialTrust — canonical trust lookup for a Blockward credential by its
// public BW-XXXXXX id. Anonymous and rate-limited: returns ONLY public-safe
// trust data (no holder email, no private evidence, no internal ids beyond the
// already-public credential id). This is the single endpoint every dashboard
// and the public verification page should consume (§34).
//
// It performs NO live RPC: integrity is derived from the persisted
// versioned chain_check bound to current content/anchor and younger than ten
// minutes. Legacy, stale or mismatched caches return non-confirmed trust.
// For the freshest
// integrity, callers use publicVerifyData which runs verifyCredentialAnchor and
// passes the result into the same calculateCredentialTrust.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { calculateCredentialTrust } from '../../shared/credentialTrust.ts';
import { rateLimit } from '../../shared/verificationFlow.ts';

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const body = await req.json().catch(() => ({}));
    const raw = String(body.bw_id || '').trim().toUpperCase().replace(/\s+/g, '');
    if (!raw) return Response.json({ error: 'Enter a Blockward Credential ID' }, { status: 400 });
    if (!rateLimit('ct', 60, 60000)) return Response.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 });

    const bwId = raw.startsWith('BW-') ? raw : `BW-${raw}`;
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const rows = await svc.entities.Credential.filter({ bw_id: bwId });
    const cred = rows?.[0];
    if (!cred || cred.is_public === false) {
      // No enumeration: same response for private vs unknown.
      return Response.json({ found: false });
    }

    const trust = await calculateCredentialTrust(svc, cred);

    return Response.json({
      found: true,
      bw_id: cred.bw_id,
      title: cred.title,
      status: cred.status,
      trust,
    });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to compute trust' }, { status: 500 });
  }
}
