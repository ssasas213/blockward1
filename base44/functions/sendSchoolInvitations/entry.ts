import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getCallerProfile, requireStaff, requireSameSchool } from '../../shared/staffAuth.ts';
import { parseEmails, resolveAppUrl, runInvitationFlow } from '../../shared/invitations.ts';

// Sends school invitations by email — the People-page canonical entry. Sole
// write path for SchoolInvitation (entity create/update locked to
// __service_role_only__). Email delivery uses Resend via shared/invitations.ts.
// (rebuilt to pick up Resend sendInviteEmail)
// write path for SchoolInvitation (entity create/update locked to
// __service_role_only__). Verifies user_type === 'admin' and school scope.
//
// Body: { action, role, emails, school_id?, resend?, invitation_id? }
//   action 'send'  — invite (role must be 'teacher' | 'admin'; students join
//                   with a class code). resend=true re-sends an existing invite.
//   action 'revoke' — set invitation_id status to 'revoked'.
//
// Returns distinct outcomes: { ok, sent_count, skipped_count, failed_count,
// sent, skipped, failed }. email_status recorded on each SchoolInvitation.
export default async function(req: Request): Promise<Response> {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

    const base44 = createClientFromRequest(req);
    const { user, profile, error } = await getCallerProfile(base44);
    if (error) return Response.json({ error: error.error }, { status: error.status });
    const staffErr = requireStaff(profile, ['admin']);
    if (staffErr) return Response.json({ error: staffErr.error }, { status: staffErr.status });
    if (!profile.school_id) return Response.json({ error: 'No school linked to your account' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'send';
    const svc = base44.asServiceRole;

    if (action === 'revoke') {
      if (!body.invitation_id) return Response.json({ error: 'invitation_id is required' }, { status: 400 });
      const found = await svc.entities.SchoolInvitation.filter({ id: body.invitation_id });
      const inv = found[0];
      if (!inv) return Response.json({ error: 'Invitation not found' }, { status: 404 });
      const sameErr = requireSameSchool(profile, inv.school_id);
      if (sameErr) return Response.json({ error: sameErr.error }, { status: sameErr.status });
      await svc.entities.SchoolInvitation.update(inv.id, { status: 'revoked' });
      return Response.json({ ok: true });
    }

    if (action !== 'send') return Response.json({ error: 'Unknown action' }, { status: 400 });

    const role = body.role;
    if (!['teacher', 'admin'].includes(role)) {
      return Response.json({ error: 'Invitations are only for teachers or administrators — students join with a class code' }, { status: 400 });
    }
    const emails = parseEmails(body.emails);
    if (emails.length === 0) return Response.json({ error: 'Please enter at least one valid email address' }, { status: 400 });

    const schoolId = body.school_id || profile.school_id;
    const sameErr = requireSameSchool(profile, schoolId);
    if (sameErr) return Response.json({ error: sameErr.error }, { status: sameErr.status });

    const schools = await svc.entities.School.filter({ id: schoolId });
    const school = schools[0];
    if (!school) return Response.json({ error: 'School not found' }, { status: 404 });

    const inviterName = profile.first_name
      ? `${profile.first_name} ${profile.last_name || ''}`.trim()
      : user.email;

    const outcome = await runInvitationFlow(svc, {
      user, schoolId, schoolName: school.name, inviterName, role, emails,
      resend: !!body.resend, appUrl: resolveAppUrl(req),
    });

    return Response.json({ ok: true, ...outcome });
  } catch (error) {
    console.error('sendSchoolInvitations error:', error);
    return Response.json({ error: error?.message || 'Failed to send invitations' }, { status: 500 });
  }
}