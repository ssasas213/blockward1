// orgAction — organisation management actions: join via invite token, invite
// / suspend / remove verifiers (owner), set verification policies (owner),
// update the organisation profile (owner), and mark a request opened.
// Verifier authorisation for SIGNING lives in orgVerificationReview — this
// function can never fabricate a signature.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { authActor, requireActiveMember, isOwner, orgEvent, generateJoinToken } from '../../shared/orgVerification.ts';
import { isTestModeEnabled, getTestSuperUserEmail } from '../../shared/testMode.ts';
import { getActorProfile, pushEvent, appBaseUrl } from '../../shared/verificationFlow.ts';
import { sendTrackedEmail } from '../../shared/emailDelivery.ts';
import { verifierInviteEmail } from '../../shared/orgEmails.ts';
import { issueCredential } from '../../shared/credentialIssuance.ts';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const base44 = createClientFromRequest(req);
    const { actor, email, error } = await authActor(base44);
    if (error) return error;
    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '');
    const nowIso = new Date().toISOString();

    // ── JOIN (invitee) — the emailed token plus matching email address ──
    if (action === 'join') {
      const token = String(body.token || '').trim();
      if (token.length < 16) return Response.json({ error: 'Invalid invitation link' }, { status: 400 });
      const rows = await svc.entities.OrganisationMember.filter({ invite_token: token });
      const m = rows?.[0];
      if (!m || m.status !== 'invited') return Response.json({ error: 'This invitation is no longer valid' }, { status: 404 });
      if ((m.user_email || '').trim().toLowerCase() !== email) {
        return Response.json({ error: 'This invitation was sent to a different email address' }, { status: 403 });
      }
      const profile = await getActorProfile(svc, email);
      const updated = await svc.entities.OrganisationMember.update(m.id, {
        status: 'active',
        user_id: profile?.id || m.user_id || null,
        full_name: m.full_name || (profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : email),
        joined_at: nowIso,
        invite_token: null,
        last_active_at: nowIso,
      });
      try {
        const orgs = await svc.entities.IssuerOrganisation.filter({ id: m.org_id });
        if (orgs?.[0]) {
          await orgEvent(svc, orgs[0], 'verifier_joined', email, `${updated.full_name || email} joined as ${updated.job_title || 'Verifier'}`);
          await svc.entities.Notification.create({
            user_email: orgs[0].owner_email, title: 'New verifier joined',
            body: `${updated.full_name || email} is now an active Verifier for ${orgs[0].name}.`, type: 'org_member_joined', related_id: m.org_id,
          }).catch(() => {});
        }
      } catch { /* best-effort */ }
      return Response.json({ ok: true, org_id: m.org_id, org_name: m.org_name });
    }

    // ── Everything below needs an ACTIVE membership ──
    const orgId = String(body.org_id || '');
    const membership = await requireActiveMember(svc, email, orgId);
    if (!membership) return Response.json({ error: 'You are not an active member of this organisation' }, { status: 403 });
    const orgs = await svc.entities.IssuerOrganisation.filter({ id: orgId });
    const org = orgs?.[0];
    if (!org) return Response.json({ error: 'Organisation not found' }, { status: 404 });

    if (action === 'open_request') {
      const requestId = String(body.request_id || '');
      const reqRows = await svc.entities.VerificationRequest.filter({ id: requestId, org_id: orgId });
      const vr = reqRows?.[0];
      if (!vr) return Response.json({ error: 'Verification request not found' }, { status: 404 });
      if (['pending'].includes(vr.status)) {
        await svc.entities.VerificationRequest.update(vr.id, {
          status: 'opened',
          opened_at: vr.opened_at || nowIso,
          open_count: (vr.open_count || 0) + 1,
          event_log: pushEvent(vr.event_log, 'opened', email, `Opened by ${membership.full_name || email}`),
        });
      }
      await svc.entities.OrganisationMember.update(membership.id, { last_active_at: nowIso }).catch(() => {});
      return Response.json({ ok: true });
    }

    // ── OWNER-only actions ──
    if (!isOwner(membership)) return Response.json({ error: 'Only the Organisation Owner can do this' }, { status: 403 });

    if (action === 'invite_verifier') {
      const invName = String(body.full_name || '').trim().slice(0, 120);
      const invEmail = String(body.email || '').trim().toLowerCase();
      const jobTitle = String(body.job_title || 'Verifier').trim().slice(0, 120) || 'Verifier';
      if (!invName) return Response.json({ error: "Add the verifier's full name" }, { status: 400 });
      if (!EMAIL_RE.test(invEmail)) return Response.json({ error: 'A valid email address is required' }, { status: 400 });
      if (invEmail === (org.owner_email || '').toLowerCase()) return Response.json({ error: 'This person is already the Organisation Owner' }, { status: 409 });
      const existing = await svc.entities.OrganisationMember.filter({ org_id: orgId, user_email: invEmail, status: { $in: ['invited', 'active', 'suspended'] } });
      if (existing?.length) return Response.json({ error: 'This person is already a member of the organisation' }, { status: 409 });

      const token = generateJoinToken();
      await svc.entities.OrganisationMember.create({
        org_id: orgId, org_name: org.name, user_email: invEmail, full_name: invName,
        job_title: invEmail === email ? 'Organisation Owner' : jobTitle, role: 'verifier',
        status: 'invited', invite_token: token, invited_by_email: email, invited_at: nowIso,
      });
      const joinUrl = `${appBaseUrl()}/organisation?invite=${token}`;
      const mail = verifierInviteEmail({ orgName: org.name, inviteeName: invName, jobTitle, invitedBy: membership.full_name || email, joinUrl });
      const sent = await sendTrackedEmail(svc, { to: invEmail, subject: mail.subject, html: mail.html, event_type: 'verifier_nomination', related_type: 'invitation', related_id: orgId, retryable: true });
      await orgEvent(svc, org, 'verifier_invited', email, `${invName} (${invEmail}) invited as ${jobTitle}${sent.delivered ? '' : ` — email failed: ${sent.error || 'unknown'}`}`);
      return Response.json({ ok: true, invited: true, email_sent: !!sent.delivered });
    }

    if (action === 'set_member_status') {
      const memberId = String(body.member_id || '');
      const status = String(body.status || '');
      if (!['active', 'suspended', 'removed'].includes(status)) return Response.json({ error: 'Invalid status' }, { status: 400 });
      const rows = await svc.entities.OrganisationMember.filter({ id: memberId, org_id: orgId });
      const m = rows?.[0];
      if (!m) return Response.json({ error: 'Member not found' }, { status: 404 });
      if (m.role === 'owner') return Response.json({ error: 'The Organisation Owner cannot be suspended or removed' }, { status: 409 });
      await svc.entities.OrganisationMember.update(m.id, { status });
      await orgEvent(svc, org, 'verifier_removed', email, `${m.full_name || m.user_email} set to ${status}`);
      return Response.json({ ok: true });
    }

    if (action === 'update_org') {
      const u = body.updates || {};
      const clean: Record<string, unknown> = {};
      if (u.name !== undefined) {
        const nm = String(u.name || '').trim().slice(0, 200);
        if (nm.length < 2) return Response.json({ error: 'Organisation name is required' }, { status: 400 });
        clean.name = nm;
      }
      if (u.website !== undefined) {
        const w = String(u.website || '').trim();
        if (w && !/^https:\/\//i.test(w)) return Response.json({ error: 'Website must start with https://' }, { status: 400 });
        clean.website = w || null;
      }
      if (u.org_type !== undefined && ['company', 'university', 'school', 'certification_provider', 'training_provider', 'competition', 'sports_organisation', 'nonprofit', 'professional_organisation', 'other'].includes(u.org_type)) clean.org_type = u.org_type;
      if (u.country !== undefined) clean.country = String(u.country || '').trim().slice(0, 80) || null;
      if (u.description !== undefined) clean.description = String(u.description || '').slice(0, 1000).trim() || null;
      if (u.email_domain !== undefined) clean.email_domain = String(u.email_domain || '').trim().toLowerCase().replace(/^@/, '').slice(0, 120) || null;
      if (u.contact_email !== undefined) {
        const ce = String(u.contact_email || '').trim().toLowerCase();
        if (!EMAIL_RE.test(ce)) return Response.json({ error: 'A valid contact email is required' }, { status: 400 });
        clean.contact_email = ce;
      }
      if (u.logo_url !== undefined) {
        const l = String(u.logo_url || '').trim();
        if (l && !/^https:\/\//i.test(l)) return Response.json({ error: 'Logo must be an https URL' }, { status: 400 });
        clean.logo_url = l || null;
      }
      await svc.entities.IssuerOrganisation.update(org.id, clean);
      await orgEvent(svc, org, 'profile_updated', email);
      return Response.json({ ok: true });
    }

    if (action === 'set_policy') {
      const policyName = String(body.name || '').trim().slice(0, 120);
      if (!policyName) return Response.json({ error: 'Policy name is required' }, { status: 400 });
      const required = Math.max(1, Math.min(5, Number(body.required_signatures) || 1));
      const specific = Array.isArray(body.specific_verifier_emails)
        ? body.specific_verifier_emails.map((e: any) => String(e || '').trim().toLowerCase()).filter((e: string) => EMAIL_RE.test(e)).slice(0, 10)
        : [];
      const categories = Array.isArray(body.categories) ? body.categories.map(String).slice(0, 10) : [];
      if (body.policy_id) {
        const rows = await svc.entities.VerificationPolicy.filter({ id: body.policy_id, org_id: orgId });
        if (!rows?.[0]) return Response.json({ error: 'Policy not found' }, { status: 404 });
        await svc.entities.VerificationPolicy.update(rows[0].id, {
          name: policyName, required_signatures: required, specific_verifier_emails: specific,
          categories, is_active: body.is_active !== false,
        });
      } else {
        await svc.entities.VerificationPolicy.create({
          org_id: orgId, name: policyName, required_signatures: required,
          specific_verifier_emails: specific, categories, is_active: body.is_active !== false, created_by_email: email,
        });
      }
      await orgEvent(svc, org, 'policy_changed', email, `${policyName} — requires ${required} signature(s)`);
      return Response.json({ ok: true });
    }

    if (action === 'set_org_status') {
      // Blockward STAFF only — manual organisation verification (MVP).
      // Platform admin (User.role) or the test super user.
      const me = await base44.auth.me().catch(() => null);
      const staffOk = me?.role === 'admin' || (isTestModeEnabled() && String(me?.email || '').toLowerCase() === getTestSuperUserEmail());
      if (!staffOk) return Response.json({ error: 'Only Blockward staff can verify organisations' }, { status: 403 });
      const status = String(body.status || '');
      if (!['verified', 'rejected', 'suspended', 'pending'].includes(status)) return Response.json({ error: 'Invalid status' }, { status: 400 });
      await svc.entities.IssuerOrganisation.update(org.id, { status, verified_at: status === 'verified' ? nowIso : org.verified_at, verified_by: email });
      await orgEvent(svc, org, status, email);

      // ── On verification: resume achievements that were held while this org
      // was pending. Each had reached the verifier signature threshold, but
      // the credential was deliberately NOT minted until Blockward verified
      // the organisation. Now the full issuance pipeline runs for each —
      // credential → BW-HASH-V1 → Polygon Amoy anchor → integrity —
      // idempotently (issueCredential + anchorCredential already guard
      // against double-anchoring). ──
      if (status === 'verified') {
        try {
          const held = await svc.entities.VerificationRequest.filter({ org_id: org.id, status: 'approved' }).catch(() => []);
          for (const vr of held || []) {
            const achRows = await svc.entities.Achievement.filter({ id: vr.achievement_id, status: 'issuer_confirmed' }).catch(() => []);
            const ach = achRows?.[0];
            // Only resume truly-held achievements (no credential yet). A
            // credential that already exists is left to its own anchor state.
            if (!ach || ach.credential_id) continue;
            const sigRecords = await svc.entities.VerificationSignature.filter({ request_id: vr.id }).catch(() => []);
            const verifiers = (sigRecords || [])
              .sort((a: any, b: any) => new Date(a.signed_at).getTime() - new Date(b.signed_at).getTime())
              .map((s: any) => ({ name: s.verifier_name, title: s.verifier_title, signed_at: s.signed_at }));
            await issueCredential(svc, { ach, vr, method: vr.decision_method || 'reviewed_evidence', verifiers, actorEmail: email }).catch(() => {});
          }
        } catch { /* best-effort: the org is verified regardless */ }
      }

      return Response.json({ ok: true, status });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error?.message || 'Action failed' }, { status: 500 });
  }
}