/**
 * orgMembershipAction — the cross-organisation membership flow.
 *
 * Students can belong to many organisations (school + clubs, academies…):
 *  - 'search'   : every organisation on BlockWard, with the caller's status
 *  - 'my'       : the caller's memberships with org details
 *  - 'request'  : request membership of an existing organisation (org approves)
 *  - 'invite'   : bring a NEW organisation onto BlockWard — creates the org,
 *                 queues the student's pending membership, and emails the
 *                 org's admin an invitation to set it up
 *  - 'pending'  : (admin) membership requests awaiting this org's approval
 *  - 'approve' / 'decline' : (admin) resolve a membership request
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { resolveEffectiveActor } from '../../shared/testMode.ts';
import { logRoleGrant } from '../../shared/profileProvisioning.ts';
import { runInvitationFlow, resolveAppUrl, parseEmails } from '../../shared/invitations.ts';
import { requestEmailHtml, notifyRequest } from '../../shared/achievementRequests.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'content-type': 'application/json',
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = body.action;

    const actor = await resolveEffectiveActor(base44);
    if (!actor.authorized) {
      return Response.json({ ok: false, error: actor.reason || 'Unauthorized' }, { status: actor.status || 401, headers: CORS });
    }
    const svc = base44.asServiceRole;
    const email = actor.actor_email;
    const role = actor.actor_role;
    const actorName = `${actor.first_name || ''} ${actor.last_name || ''}`.trim() || email;
    const now = new Date().toISOString();
    const appUrl = resolveAppUrl(req);

    const myMemberships = async () => {
      try { return await svc.entities.StudentOrgMembership.filter({ student_email: email }); } catch (e) { return []; }
    };
    const orgById = async (id: string) => {
      try { const rows = await svc.entities.School.filter({ id }); return rows[0] || null; } catch (e) { return null; }
    };
    const bad = (msg: string, status = 400) => Response.json({ ok: false, error: msg }, { status, headers: CORS });

    // ── My memberships ──────────────────────────────────────────────────────
    if (action === 'my') {
      const rows = await myMemberships();
      const memberships = [];
      for (const m of rows) {
        const org = await orgById(m.school_id);
        memberships.push({
          id: m.id,
          school_id: m.school_id,
          school_name: (org && org.name) || m.school_name,
          org_type: (org && org.org_type) || m.org_type || null,
          city: org?.city || null,
          country: org?.country || null,
          logo_url: org?.logo_url || null,
          status: m.status,
          origin: m.origin || 'student_request',
          requested_at: m.requested_at || null,
        });
      }
      return Response.json({ ok: true, memberships }, { headers: CORS });
    }

    // ── Search every organisation on BlockWard ──────────────────────────────
    if (action === 'search') {
      const q = String(body.query || '').trim().toLowerCase();
      let schools: any[] = [];
      try { schools = await svc.entities.School.list('-created_date', 300); } catch (e) { /* empty */ }
      const mine = await myMemberships();
      const statusByOrg: Record<string, string> = {};
      for (const m of mine) statusByOrg[m.school_id] = m.status;

      const orgs = schools
        .filter((s) => s.status !== 'suspended')
        .filter((s) => !q ||
          (s.name || '').toLowerCase().includes(q) ||
          (s.city || '').toLowerCase().includes(q) ||
          (s.country || '').toLowerCase().includes(q))
        .slice(0, 30)
        .map((s) => ({
          id: s.id,
          name: s.name,
          org_type: s.org_type,
          city: s.city || null,
          country: s.country || null,
          logo_url: s.logo_url || null,
          my_status: statusByOrg[s.id] || (s.id === actor.school_id ? 'active' : null),
        }));
      return Response.json({ ok: true, orgs }, { headers: CORS });
    }

    // ── Request membership of an existing organisation ───────────────────────
    if (action === 'request') {
      // 'pending' accounts (signed up with no code/invite) are prospective
      // members — the search-and-request flow is exactly for them.
      if (role !== 'student' && role !== 'pending') return bad('Only students can request membership', 403);
      const org = await orgById(body.organisation_id);
      if (!org) return bad('Organisation not found', 404);

      const existing = (await myMemberships()).filter((m) => m.school_id === org.id && ['pending', 'active'].includes(m.status));
      if (existing.length > 0) {
        return bad(existing[0].status === 'active' ? 'You already belong to this organisation' : 'Your request is already pending', 409);
      }

      const membership = await svc.entities.StudentOrgMembership.create({
        student_id: actor.actor_id,
        student_email: email,
        student_name: actorName,
        school_id: org.id,
        school_name: org.name,
        org_type: org.org_type,
        status: 'pending',
        origin: 'student_request',
        requested_at: now,
      });

      // Best-effort: tell the organisation's admins.
      let admins: any[] = [];
      try { admins = await svc.entities.UserProfile.filter({ school_id: org.id, user_type: 'admin' }); } catch (e) { /* empty */ }
      const html = requestEmailHtml(
        'New membership request',
        [`${actorName} has requested to join ${org.name}.`, 'Approve or decline it from your admin dashboard.'],
        `${appUrl}/AdminDashboard`, 'Review request',
      );
      for (const a of admins) {
        try { await notifyRequest(a.user_email, `${actorName} wants to join ${org.name}`, html); } catch (e) { /* ignore */ }
      }
      return Response.json({ ok: true, membership_id: membership.id }, { headers: CORS });
    }

    // ── Invite a NEW organisation to BlockWard ──────────────────────────────
    if (action === 'invite') {
      if (role !== 'student') return bad('Only students can invite organisations', 403);
      const name = String(body.organisation_name || '').trim();
      const adminEmail = (parseEmails(body.admin_email || '')[0] || '').toLowerCase();
      if (name.length < 2) return bad('Enter the organisation name');
      if (!adminEmail) return bad('Enter a valid admin email');

      const code = 'BW' + crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
      const school = await svc.entities.School.create({
        name,
        code,
        school_code: code,
        org_type: 'other',
        status: 'active',
        admin_email: adminEmail,
        contact_email: adminEmail,
        created_by: email,
      });

      // Queue the student's own membership for when the admin arrives.
      await svc.entities.StudentOrgMembership.create({
        student_id: actor.actor_id,
        student_email: email,
        student_name: actorName,
        school_id: school.id,
        school_name: school.name,
        org_type: 'other',
        status: 'pending',
        origin: 'org_invite',
        requested_at: now,
      });

      // Email the org admin their invitation (reuses the school invite flow).
      const result = await runInvitationFlow(svc, {
        user: { email },
        schoolId: school.id,
        schoolName: school.name,
        inviterName: actorName,
        role: 'admin',
        emails: [adminEmail],
        appUrl,
      });

      const emailStatus = result.sent_count > 0 ? 'sent' : (result.failed_count > 0 ? 'failed' : 'skipped');
      return Response.json({
        ok: true,
        school_id: school.id,
        email_status: emailStatus,
        invite_url: result.sent?.[0]?.invite_url || result.failed?.[0]?.invite_url || null,
        email_error: result.failed?.[0]?.email_error || null,
      }, { headers: CORS });
    }

    // ── Admin: pending membership requests for my organisation ──────────────
    if (action === 'pending') {
      if (role !== 'admin') return bad('Only organisation admins can review membership requests', 403);
      let rows: any[] = [];
      try { rows = await svc.entities.StudentOrgMembership.filter({ school_id: actor.school_id, status: 'pending' }); } catch (e) { /* empty */ }
      return Response.json({
        ok: true,
        requests: rows.map((m) => ({
          id: m.id,
          student_name: m.student_name || m.student_email,
          student_email: m.student_email,
          school_name: m.school_name,
          origin: m.origin || 'student_request',
          requested_at: m.requested_at || null,
        })),
      }, { headers: CORS });
    }

    // ── Admin: approve / decline a membership request ───────────────────────
    if (action === 'approve' || action === 'decline') {
      if (role !== 'admin') return bad('Only organisation admins can resolve membership requests', 403);
      let rows: any[] = [];
      try { rows = await svc.entities.StudentOrgMembership.filter({ id: body.membership_id }); } catch (e) { /* empty */ }
      const membership = rows[0] || null;
      if (!membership) return bad('Membership request not found', 404);
      if (membership.school_id !== actor.school_id) return bad('This request belongs to another organisation', 403);

      const status = action === 'approve' ? 'active' : 'declined';
      await svc.entities.StudentOrgMembership.update(membership.id, {
        status,
        responded_at: now,
        approved_by_email: email,
        approved_by_name: actorName,
      });

      // Approving a join request from a 'pending' account (new signup with no
      // code or invitation) grants the student role and links the school.
      if (action === 'approve') {
        try {
          const rows = await svc.entities.UserProfile.filter({ user_email: membership.student_email });
          const p = rows?.[0];
          if (p && p.user_type === 'pending') {
            await svc.entities.UserProfile.update(p.id, {
              user_type: 'student',
              school_id: membership.school_id,
              active_school_id: membership.school_id,
              status: 'active',
            });
            await logRoleGrant(svc, {
              record_id: p.id,
              school_id: membership.school_id,
              granted_by_email: email,
              granted_by_name: actorName,
              granted_to_email: p.user_email,
              granted_to_name: membership.student_name || p.user_email,
              role: 'student',
              old_role: 'pending',
              mechanism: 'admin approval of a school join request',
            });
          }
        } catch (e) { /* best-effort */ }
      }

      // Best-effort: tell the student.
      const verb = action === 'approve' ? 'approved' : 'declined';
      const html = requestEmailHtml(
        `Membership ${verb}`,
        [`${actorName} ${verb} your request to join ${membership.school_name}.`],
        `${appUrl}/StudentDashboard`, 'Open BlockWard',
      );
      try { await notifyRequest(membership.student_email, `Your request to join ${membership.school_name} was ${verb}`, html); } catch (e) { /* ignore */ }

      return Response.json({ ok: true, status }, { headers: CORS });
    }

    return bad('Unknown action');
  } catch (e) {
    return Response.json({ ok: false, error: e?.message || String(e) }, { status: 500, headers: CORS });
  }
});