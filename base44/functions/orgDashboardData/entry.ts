// orgDashboardData — role-scoped data for the Issuer Organisation dashboard:
// overview stats, verification queue, credentials, verifiers, policies,
// signature status and the audit trail. Membership is resolved server-side.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { authActor, getMemberships } from '../../shared/orgVerification.ts';

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const base44 = createClientFromRequest(req);
    const { email, error } = await authActor(base44);
    if (error) return error;
    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const orgId = String(body.org_id || '');

    const memberships = await getMemberships(svc, email);
    const usable = memberships.filter((m: any) => ['invited', 'active'].includes(m.status));
    if (!usable.length) return Response.json({ ok: true, memberships: [], org: null });
    const membership = orgId ? usable.find((m: any) => m.org_id === orgId) : usable.find((m: any) => m.status === 'active') || usable[0];
    if (!membership) return Response.json({ ok: true, memberships: usable.map((m: any) => ({ org_id: m.org_id, org_name: m.org_name, role: m.role, status: m.status })), org: null });

    const orgRows = await svc.entities.IssuerOrganisation.filter({ id: membership.org_id });
    const org = orgRows?.[0];
    if (!org) return Response.json({ ok: true, memberships: usable, org: null });
    const isOwner = membership.role === 'owner';

    // ── Members ──
    const members = await svc.entities.OrganisationMember.filter({ org_id: org.id, status: { $in: ['invited', 'active', 'suspended'] } }, '-created_date', 100);
    const activeVerifierEmails = (members || []).filter((m: any) => m.status === 'active').map((m: any) => (m.user_email || '').toLowerCase());

    // ── Verification queue ──
    const reqs = await svc.entities.VerificationRequest.filter({ org_id: org.id, status: { $in: ['pending', 'opened'] } }, '-created_date', 50);
    const completed = await svc.entities.VerificationRequest.filter({ org_id: org.id, status: 'approved' }, '-responded_at', 10);
    const rejected = await svc.entities.VerificationRequest.filter({ org_id: org.id, status: 'rejected' }, '-responded_at', 5);

    // Full request detail (evidence) for the review screen.
    const achIds = [...new Set([...(reqs || []), ...(completed || [])].map((r: any) => r.achievement_id))];
    const achievements = [];
    for (const aid of achIds.slice(0, 60)) {
      const rows = await svc.entities.Achievement.filter({ id: aid });
      if (rows?.[0]) achievements.push(rows[0]);
    }
    const achById = new Map(achievements.map((a: any) => [a.id, a]));

    // Signatures for all listed requests.
    const reqIds = [...new Set([...(reqs || []), ...(completed || []), ...(rejected || [])].map((r: any) => r.id))];
    const allSignatures = [];
    for (const rid of reqIds.slice(0, 60)) {
      const rows = await svc.entities.VerificationSignature.filter({ request_id: rid });
      for (const s of rows || []) allSignatures.push(s);
    }
    const sigsByRequest = new Map<string, any[]>();
    for (const s of allSignatures) {
      const arr = sigsByRequest.get(s.request_id) || [];
      arr.push({ verifier_email: s.verifier_email, verifier_name: s.verifier_name, verifier_title: s.verifier_title, signed_at: s.signed_at, signature_image_url: s.signature_image_url, verification_method: s.verification_method });
      sigsByRequest.set(s.request_id, arr);
    }

    const myEmail = email;
    const shape = (r: any) => {
      const ach = achById.get(r.achievement_id);
      return {
        id: r.id,
        status: r.status,
        holder_name: r.holder_name,
        achievement_title: r.achievement_title,
        created_date: r.created_date,
        required_signatures: r.required_signatures || 1,
        signature_count: r.signature_count || 0,
        policy_id: r.policy_id || null,
        achievement: ach ? {
          id: ach.id, title: ach.title, category: ach.category, description: ach.description,
          date_achieved: ach.date_achieved, external_credential_id: ach.external_credential_id,
          certificate_name: ach.certificate_name, certificate_url: ach.certificate_url,
          evidence: ach.evidence || [],
        } : null,
        signatures: sigsByRequest.get(r.id) || [],
        signed_by_me: (sigsByRequest.get(r.id) || []).some((s: any) => (s.verifier_email || '').toLowerCase() === myEmail),
      };
    };

    // ── Credentials issued by this org ──
    const creds = await svc.entities.Credential.filter({ org_id: org.id }, '-created_date', 20);

    // ── Stats ──
    const monthStart = new Date();
    monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const monthIso = monthStart.toISOString();
    const verifiedThisMonth = (creds || []).filter((c: any) => c.anchor_status === 'confirmed' && c.verified_at && c.verified_at >= monthIso).length;
    const totalCredentials = (creds || []).length; // dashboard page of 20; count for accuracy
    let totalCredCount = totalCredentials;
    try { totalCredCount = await svc.entities.Credential.count({ org_id: org.id }); } catch { /* fallback */ }

    const policies = isOwner
      ? await svc.entities.VerificationPolicy.filter({ org_id: org.id })
      : [];

    // ── My signature for this org ──
    const sigRows = await svc.entities.VerifierSignature.filter({ user_email: email, active: true });
    const mySignature = (sigRows || []).find((s: any) => !s.org_id || s.org_id === org.id) || null;

    return Response.json({
      ok: true,
      memberships: usable.map((m: any) => ({ org_id: m.org_id, org_name: m.org_name, role: m.role, status: m.status })),
      org: {
        id: org.id, name: org.name, org_type: org.org_type, website: org.website, country: org.country,
        logo_url: org.logo_url, description: org.description, email_domain: org.email_domain,
        contact_email: org.contact_email, handle: org.handle, status: org.status,
        verified_at: org.verified_at, event_log: org.event_log || [],
      },
      me: { email, role: membership.role, status: membership.status, membership_id: membership.id, job_title: membership.job_title },
      is_owner: isOwner,
      my_signature: mySignature,
      members: (members || []).map((m: any) => ({ id: m.id, user_email: m.user_email, full_name: m.full_name, job_title: m.job_title, role: m.role, status: m.status, invited_at: m.invited_at, joined_at: m.joined_at })),
      policies: (policies || []).map((p: any) => ({ id: p.id, name: p.name, required_signatures: p.required_signatures, specific_verifier_emails: p.specific_verifier_emails || [], categories: p.categories || [], is_active: p.is_active })),
      queue: (reqs || []).map(shape),
      recent_completed: (completed || []).map(shape).slice(0, 6),
      recent_rejected: (rejected || []).map(shape).slice(0, 4),
      credentials: (creds || []).map((c: any) => ({
        id: c.id, bw_id: c.bw_id, title: c.title, holder_display_name: c.holder_display_name,
        category: c.category, verified_at: c.verified_at, anchor_status: c.anchor_status,
        status: c.status, verifiers: c.verifiers || [], blockchain: c.blockchain || {},
        verify_url: `/verify/${c.bw_id}`,
      })),
      stats: {
        pending_requests: (reqs || []).filter((r: any) => (r.signature_count || 0) === 0).length,
        awaiting_signatures: (reqs || []).filter((r: any) => (r.signature_count || 0) > 0 && (r.signature_count || 0) < (r.required_signatures || 1)).length,
        verified_this_month: verifiedThisMonth,
        total_credentials: totalCredCount,
        active_verifiers: activeVerifierEmails.length,
      },
    });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to load organisation data' }, { status: 500 });
  }
}