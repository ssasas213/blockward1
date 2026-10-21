// remediateAnchorIncident — controlled remediation of the synthetic
// confirmation incident (AB-5FBCA1 / BW-H5CHBVHE). Returns a preview of the
// exact field-level changes + correction notification by default; applies them
// only when the operator passes approved=true. No production records are
// modified and no notification is sent until explicit approval.
//
// Auth: Blockward internal admin only (server-side enforced). The caller's
// platform role is irrelevant — the internal-admin allowlist is the gate.
//
// The function never initiates a blockchain transaction. Re-enqueuing the
// credential places it in a new Merkle batch; the fee-gated queue worker
// decides when (and whether) to broadcast, exactly as for any new credential.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { requireInternalAdmin } from '../../shared/internalAdmin.ts';
import { previewRemediation, executeRemediation } from '../../shared/incidentRemediation.ts';

const INCIDENT_DEFAULTS = { batch_ref: 'AB-5FBCA1', bw_id: 'BW-H5CHBVHE' };

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const base44 = createClientFromRequest(req);
    const { error } = await requireInternalAdmin(base44);
    if (error) return error;
    const svc = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const approved = body?.approved === true;
    const batchRef = (typeof body?.batch_ref === 'string' && body.batch_ref.trim() ? body.batch_ref : INCIDENT_DEFAULTS.batch_ref).trim().toUpperCase();
    const bwId = (typeof body?.bw_id === 'string' && body.bw_id.trim() ? body.bw_id : INCIDENT_DEFAULTS.bw_id).trim().toUpperCase();

    const result = approved
      ? await executeRemediation(svc, { batchRef, bwId })
      : await previewRemediation(svc, { batchRef, bwId });

    if (!result.ok) return Response.json(result, { status: result.error?.includes('not_found') ? 404 : 500 });
    return Response.json(result);
  } catch (error) {
    return Response.json({ ok: false, error: error?.message || 'Remediation failed' }, { status: 500 });
  }
}