// adminConsoleData — Blockward INTERNAL admin console data. Every request is
// authorized via requireInternalAdmin (server-side). Returns overview metrics,
// the organisation review queue, recent credentials, failed anchors, and the
// admin audit trail. Optional `action: 'org_detail'` returns a single org's
// members, policies, issued credentials and audit history for the review drawer.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { requireInternalAdmin } from '../../shared/internalAdmin.ts';

const norm = (r: any): any[] => Array.isArray(r) ? r : (r?.items || []);
const STATUS_FLOW: Record<string, string> = {
  pending: 'Pending review', verified: 'Verified', rejected: 'Rejected', suspended: 'Suspended',
};
const ANCHOR_FLOW: Record<string, string> = {
  pending: 'Pending', processing: 'Processing', confirmed: 'Confirmed', failed: 'Failed',
};

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const base44 = createClientFromRequest(req);
    const { me, error } = await requireInternalAdmin(base44);
    if (error) return error;
    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '');

    // ── Organisation detail (review drawer) ──
    if (action === 'org_detail') {
      const orgId = String(body.org_id || '');
      if (!orgId) return Response.json({ error: 'org_id required' }, { status: 400 });
      const org = (await svc.entities.IssuerOrganisation.filter({ id: orgId }))?.[0];
      if (!org) return Response.json({ error: 'Not found' }, { status: 404 });
      const [members, policies, creds, audit] = await Promise.all([
        svc.entities.OrganisationMember.filter({ org_id: orgId }),
        svc.entities.VerificationPolicy.filter({ org_id: orgId }),
        svc.entities.Credential.filter({ org_id: orgId }),
        svc.entities.AdminAuditLog.filter({ org_id: orgId }),
      ]);
      return Response.json({
        ok: true,
        org,
        members: norm(members).sort((a: any, b: any) => (a.role === 'owner' ? -1 : 1) - (b.role === 'owner' ? -1 : 1)),
        policies: norm(policies),
        credentials: norm(creds).sort((a: any, b: any) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime()),
        audit: norm(audit).sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
      });
    }

    // ── Credential search ──
    if (action === 'search_credentials') {
      const q = String(body.q || '').trim();
      const status = String(body.status || '').trim();
      const query: any = {};
      if (status && ['active', 'revoked'].includes(status)) query.status = status;
      if (q) {
        const rx: any = { $regex: q, $options: 'i' };
        query.$or = [{ bw_id: rx }, { holder_display_name: rx }, { issuer_org: rx }, { title: rx }];
      }
      const res = await svc.entities.Credential.filter(query, { sort: '-created_date', limit: 50 });
      const list: any[] = norm(res);
      return Response.json({ ok: true, credentials: list, anchor_labels: ANCHOR_FLOW });
    }

    // ── Overview + queues ──
    const [orgs, recentCreds, failedCreds, audit] = await Promise.all([
      svc.entities.IssuerOrganisation.filter({}, { sort: '-created_date', limit: 200 }),
      svc.entities.Credential.filter({}, { sort: '-created_date', limit: 12 }),
      svc.entities.Credential.filter({ anchor_status: 'failed' }, { sort: '-created_date', limit: 20 }),
      svc.entities.AdminAuditLog.filter({}, { sort: '-timestamp', limit: 25 }),
    ]);
    const orgList: any[] = norm(orgs);
    const credList: any[] = norm(recentCreds);
    const failedList: any[] = norm(failedCreds);
    const auditList: any[] = norm(audit);

    const counts = { pending: 0, verified: 0, rejected: 0, suspended: 0 };
    for (const o of orgList) counts[o.status as string] = (counts[o.status as string] || 0) + 1;

    return Response.json({
      ok: true,
      admin: { email: me?.email, name: me?.full_name || me?.email },
      overview: {
        org_counts: counts,
        pending_review: orgList.filter((o) => o.status === 'pending'),
        recently_approved: orgList.filter((o) => o.status === 'verified').slice(0, 6),
        recently_issued_credentials: credList,
        failed_anchors: failedList,
        recent_audit: auditList,
      },
      organisations: orgList,
      status_labels: STATUS_FLOW,
      anchor_labels: ANCHOR_FLOW,
    });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed' }, { status: 500 });
  }
}