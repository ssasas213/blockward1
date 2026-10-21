// mainnetSmokeTest — controlled fictional-credential smoke test (Phase 3).
//
// PURPOSE: after the authorised operator's mainnet activation, verify the
// COMPLETE production pipeline end-to-end with entirely fictional, clearly
// labelled data. Issuer verification is satisfied in the controlled test
// environment exactly as in the prior Amoy E2E batch (synthetic @blockward.test
// holders, "Blockward Test Issuer") — no production trust records are modified
// and no issuer-authority checks are bypassed: the credentials enter the queue
// through the SINGLE production issuance pipeline (issueCredential), which
// generates the BW-HASH-V1 commitment and enqueues via the real Merkle batching
// queue. Anchoring, fee policy and confirmation are then driven by the normal
// 5-minute worker — this function signs NOTHING and broadcasts NOTHING.
//
// PRODUCTION AUTHORISATION BOUNDARY (incident §7): this function creates real
// credentials that the 5-minute worker WILL anchor on mainnet (under the
// approved fee ceiling) when POLYGON_NETWORK is polygon_mainnet. It therefore
// requires an EXPLICIT opt-in: body.liveBroadcastConsent === true. Without it,
// the function refuses immediately — no credentials are created, no queue
// entries are added, no mainnet transaction is possible. Consent is never
// inferred from env, test mode or admin role.
//
// Auth: internal admin only + explicit liveBroadcastConsent. Safe to re-run:
// each call creates new synthetic credentials and joins/opens the current open
// batch (idempotent at queue level).
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { requireInternalAdmin } from '../../shared/internalAdmin.ts';
import { issueCredential } from '../../shared/credentialIssuance.ts';
import { computeCredentialHash } from '../../shared/credentialHash.ts';
import { resolvePolygonTarget } from '../../shared/chainPolygon.ts';

const nowIso = () => new Date().toISOString();

const FICTIONAL = [
  {
    holder_email: 'smoke-holder-1@blockward.test',
    holder_id: 'test-holder-smoke-1',
    holder_name: 'Smoke Test Holder One (Fictional)',
    title: 'Blockward Smoke Test Achievement One (Mainnet Validation)',
    category: 'other',
    description: 'FICTIONAL smoke-test achievement with no real personal data — mainnet pipeline validation only.',
    date_achieved: '2026-10-21',
    method: 'reviewed_evidence',
  },
  {
    holder_email: 'smoke-holder-2@blockward.test',
    holder_id: 'test-holder-smoke-2',
    holder_name: 'Smoke Test Holder Two (Fictional)',
    title: 'Blockward Smoke Test Achievement Two (Mainnet Validation)',
    category: 'other',
    description: 'FICTIONAL smoke-test achievement with no real personal data — mainnet pipeline validation only.',
    date_achieved: '2026-10-21',
    method: 'witnessed_in_person',
  },
];

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const base44 = createClientFromRequest(req);
    const { error } = await requireInternalAdmin(base44);
    if (error) return error;

    const body = await req.json().catch(() => ({}));
    // Explicit production authorisation boundary — no consent, no credentials,
    // no queue entries, no mainnet transaction (incident §7).
    if (body.liveBroadcastConsent !== true) {
      return Response.json({
        ok: false,
        error: 'live_broadcast_consent_required',
        detail: 'This function creates real credentials that the 5-minute worker will anchor on mainnet. Pass { liveBroadcastConsent: true } to authorise.',
      }, { status: 403 });
    }

    const svc = base44.asServiceRole;
    const resolved = resolvePolygonTarget();
    const target = 'target' in resolved ? resolved.target : `unsupported:${resolved.value}`;
    const results: any[] = [];

    for (const spec of FICTIONAL) {
      const ts = nowIso();
      // Fictional achievement — issuer verification satisfied in the controlled
      // test environment (synthetic test issuer; clearly labelled fictional).
      const ach = await svc.entities.Achievement.create({
        holder_email: spec.holder_email,
        holder_id: spec.holder_id,
        holder_name: spec.holder_name,
        title: spec.title,
        issuer_org: 'Blockward Test Issuer',
        issuer_email: 'smoke-issuer@blockward.test',
        category: spec.category,
        description: spec.description,
        date_achieved: spec.date_achieved,
        is_public: false,
        status: 'issuer_confirmed',
        event_log: [{ event: 'issuer_confirmed', actor: 'mainnetSmokeTest', note: 'Fictional smoke-test credential — issuer verification satisfied in controlled test environment', timestamp: ts }],
      });

      const issued = await issueCredential(svc, {
        ach,
        vr: null,
        method: spec.method,
        verifiers: [{ name: 'Smoke Test Verifier (Fictional)', title: 'Test Issuer', signed_at: ts }],
        methodNote: 'Controlled mainnet smoke test',
        actorEmail: 'mainnetSmokeTest',
      });

      // Recompute the BW-HASH-V1 leaf for the record that was committed.
      const leaf = await computeCredentialHash({
        verification_id: issued.cred.bw_id,
        version: 1,
        achievement_title: spec.title,
        achievement_category: spec.category,
        achievement_description: spec.description,
        date_achieved: spec.date_achieved,
      });

      results.push({
        achievement_id: ach.id,
        bw_id: issued.bwId,
        credential_id: issued.cred.id,
        queue_result: issued.anchor,
        bw_hash_v1_leaf: leaf,
      });
    }

    return Response.json({
      ok: true,
      target_network: target,
      credentials: results,
      note: 'Fictional credentials only. Anchoring runs via the standard 5-minute worker under the approved 200 Gwei fee ceiling.',
    });
  } catch (e) {
    return Response.json({ ok: false, error: String(e?.message || e).slice(0, 300) }, { status: 500 });
  }
}