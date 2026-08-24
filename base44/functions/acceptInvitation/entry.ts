import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { defaultAdminPermissions } from '../../shared/adminPermissions.ts';

function normalizeEmail(e) {
  return (e || '').trim().toLowerCase();
}

export default async function(req: Request): Promise<Response> {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized', code: 'auth_required' }, { status: 401 });

    const body = await req.json();
    const token = body.token;
    if (!token) return Response.json({ error: 'Missing invitation token', code: 'invalid' }, { status: 400 });

    // Look up invitation by token (service role — no RLS)
    const invitations = await base44.asServiceRole.entities.SchoolInvitation.filter({ token });
    const invitation = invitations[0];
    if (!invitation) return Response.json({ error: 'This invitation could not be found.', code: 'not_found' }, { status: 404 });

    if (invitation.status === 'accepted') {
      return Response.json({
        error: 'This invitation has already been used.',
        code: 'already_used',
        school_name: invitation.school_name,
        role: invitation.role,
      }, { status: 409 });
    }
    if (invitation.status === 'revoked') {
      return Response.json({ error: 'This invitation has been cancelled by the administrator.', code: 'revoked' }, { status: 410 });
    }
    if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
      return Response.json({ error: 'This invitation has expired. Please ask your administrator to send a new one.', code: 'expired' }, { status: 410 });
    }

    // ===== Email-match security =====
    const invitedEmail = normalizeEmail(invitation.invited_email);
    const userEmail = normalizeEmail(user.email);
    if (invitedEmail !== userEmail) {
      return Response.json({
        error: `This invitation belongs to ${invitation.invited_email}. Please sign in using the invited Google account.`,
        code: 'email_mismatch',
        invited_email: invitation.invited_email,
      }, { status: 403 });
    }

    // Validate school still exists and is active
    const schools = await base44.asServiceRole.entities.School.filter({ id: invitation.school_id });
    const school = schools[0];
    if (!school || school.status === 'suspended' || school.status === 'inactive') {
      return Response.json({ error: 'This school is no longer available.', code: 'school_unavailable' }, { status: 410 });
    }

    // ===== Already a member? =====
    const existingProfiles = await base44.asServiceRole.entities.UserProfile.filter({ user_email: user.email });
    const existingProfile = existingProfiles[0];
    if (existingProfile && existingProfile.school_id === school.id && existingProfile.status === 'active') {
      // Mark invitation accepted (idempotent) and redirect
      await base44.asServiceRole.entities.SchoolInvitation.update(invitation.id, {
        status: 'accepted', accepted_at: new Date().toISOString(), accepted_by_email: user.email,
      });
      return Response.json({
        success: true,
        already_member: true,
        role: invitation.role,
        school_name: school.name,
        redirect: dashboardFor(invitation.role),
      });
    }

    const nameParts = (user.full_name || user.email || 'User').trim().split(/\s+/);
    const firstName = nameParts[0] || 'User';
    const lastName = nameParts.slice(1).join(' ') || '';

    if (invitation.role === 'teacher') {
      let profile = existingProfile;
      if (!profile) {
        profile = await base44.asServiceRole.entities.UserProfile.create({
          user_email: user.email,
          user_type: 'teacher',
          first_name: firstName,
          last_name: lastName,
          status: 'active',
          school_id: school.id,
          active_school_id: school.id,
          total_achievement_points: 0,
          total_behaviour_points: 0,
        });
      } else {
        await base44.asServiceRole.entities.UserProfile.update(profile.id, {
          user_type: 'teacher',
          school_id: school.id,
          active_school_id: school.id,
          status: 'active',
        });
      }
      // Active staff membership — invitation IS the authorization, no approval needed
      const existingStaff = await base44.asServiceRole.entities.StaffMembership.filter({ user_email: user.email, school_id: school.id });
      if (existingStaff.length === 0) {
        await base44.asServiceRole.entities.StaffMembership.create({
          school_id: school.id,
          school_name: school.name,
          user_email: user.email,
          user_id: profile.id,
          teacher_name: `${firstName} ${lastName}`.trim(),
          role: 'TEACHER',
          status: 'active',
          joined_via_code: 'invitation',
          requested_at: new Date().toISOString(),
        });
      } else {
        await base44.asServiceRole.entities.StaffMembership.update(existingStaff[0].id, { status: 'active' });
      }
    } else if (invitation.role === 'student') {
      if (!existingProfile) {
        await base44.asServiceRole.entities.UserProfile.create({
          user_email: user.email,
          user_type: 'student',
          first_name: firstName,
          last_name: lastName,
          status: 'active',
          school_id: school.id,
          active_school_id: school.id,
          total_achievement_points: 0,
          total_behaviour_points: 0,
        });
      } else {
        await base44.asServiceRole.entities.UserProfile.update(existingProfile.id, {
          user_type: 'student',
          school_id: school.id,
          active_school_id: school.id,
          status: 'active',
        });
      }
    } else if (invitation.role === 'admin') {
      let profile = existingProfile;
      if (!profile) {
        profile = await base44.asServiceRole.entities.UserProfile.create({
          user_email: user.email,
          user_type: 'admin',
          first_name: firstName,
          last_name: lastName,
          admin_level: 'basic_admin',
          admin_permissions: defaultAdminPermissions('basic_admin'),
          status: 'active',
          school_id: school.id,
          active_school_id: school.id,
          total_achievement_points: 0,
          total_behaviour_points: 0,
        });
      } else {
        await base44.asServiceRole.entities.UserProfile.update(existingProfile.id, {
          school_id: school.id,
          active_school_id: school.id,
          status: 'active',
        });
      }
      const existingMembership = await base44.asServiceRole.entities.AdminSchoolMembership.filter({
        admin_email: user.email, school_id: school.id
      });
      if (existingMembership.length === 0) {
        await base44.asServiceRole.entities.AdminSchoolMembership.create({
          admin_user_id: profile.id,
          admin_email: user.email,
          admin_name: `${firstName} ${lastName}`.trim(),
          school_id: school.id,
          school_name: school.name,
          role: 'admin',
          status: 'active',
          is_primary: false,
          joined_at: new Date().toISOString(),
          invited_by: invitation.invited_by,
        });
      } else {
        await base44.asServiceRole.entities.AdminSchoolMembership.update(existingMembership[0].id, { status: 'active' });
      }
    }

    // Mark accepted
    await base44.asServiceRole.entities.SchoolInvitation.update(invitation.id, {
      status: 'accepted',
      accepted_at: new Date().toISOString(),
      accepted_by_email: user.email,
    });

    // Audit log
    await base44.asServiceRole.entities.AuditLog.create({
      record_id: invitation.id,
      school_id: school.id,
      actor_email: user.email,
      actor_name: `${firstName} ${lastName}`.trim(),
      actor_role: invitation.role,
      action: 'teacher_approved',
      new_status: 'active',
      notes: `Accepted invitation to join ${school.name} as ${invitation.role}`,
      timestamp: new Date().toISOString(),
    });

    return Response.json({
      success: true,
      role: invitation.role,
      school_name: school.name,
      redirect: dashboardFor(invitation.role),
    });
  } catch (error) {
    console.error('acceptInvitation error:', error);
    return Response.json({ error: error.message || 'Failed to accept invitation', code: 'server_error' }, { status: 500 });
  }
}

function dashboardFor(role) {
  if (role === 'admin') return '/AdminDashboard';
  if (role === 'teacher') return '/TeacherDashboard';
  return '/StudentDashboard';
}