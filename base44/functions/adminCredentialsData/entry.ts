/**
 * adminCredentialsData — the organisation admin's credential register:
 * every delivered credential their organisation issued, with anchor status,
 * revocation state and a monitor summary of pending/failed blockchain
 * registrations. Scoped to the admin's own organisation, enforced here.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveEffectiveActor } from '../../shared/testMode.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'content-type': 'application/json',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  try {
    const base44 = createClientFromRequest(req);
    const actor = await resolveEffectiveActor(base44);
    if (!actor.authorized) {
      return Response.json({ ok: false, error: actor.reason || 'Unauthorized' }, { status: actor.status || 401, headers: CORS });
    }
    if (actor.actor_role !== 'admin') {
      return Response.json({ ok: false, error: 'Only organisation admins can view the credential register' }, { status: 403, headers: CORS });
    }
    if (!actor.school_id) {
      return Response.json({ ok: false, error: 'You are not associated with an organisation' }, { status: 403, headers: CORS });
    }

    const svc = base44.asServiceRole;
    const rows = await svc.entities.BlockWardVerificationRegistry.filter({ school_id: actor.school_id }, '-created_date', 200);

    const credentials = rows.map(r => ({
      id: r.id,
      verification_id: r.verification_id,
      achievement_title: r.achievement_title,
      achievement_category: r.achievement_category,
      student_name: r.student_name,
      student_email: r.student_email,
      teacher_name: r.teacher_name,
      date_achieved: r.date_achieved || null,
      version: r.version || 1,
      approval_status: r.approval_status,
      nft_status: r.nft_status || 'pending',
      chain_status: r.chain_check?.status || null,
      blockchain_network: r.blockchain_network || null,
      transaction_hash: r.transaction_hash || null,
      is_public: r.is_public === true,
      visibility: r.visibility || 'public',
      verification_mode: r.verification_mode || 'organisation',
      is_team_credential: r.is_team_credential === true,
      revocation: r.revocation || null,
      corrected_at: r.corrected_at || null,
      created_date: r.created_date || null,
    }));

    const summary = {
      total: credentials.length,
      revoked: credentials.filter(c => c.approval_status === 'revoked').length,
      anchors: { minted: 0, pending: 0, anchoring: 0, failed: 0 },
    };
    credentials.forEach(c => {
      if (summary.anchors[c.nft_status] !== undefined) summary.anchors[c.nft_status]++;
    });

    return Response.json({ ok: true, credentials, summary }, { headers: CORS });
  } catch (e) {
    return Response.json({ ok: false, error: e?.message || String(e) }, { status: 500, headers: CORS });
  }
});