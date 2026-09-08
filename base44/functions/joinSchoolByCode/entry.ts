import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { provisionProfile, logRoleGrant, roleFromCode } from '../../shared/profileProvisioning.ts';

// Join a school with a code. SECURITY: the granted role is read from the
// SchoolCode RECORD — a role in the request body is ignored, and codes can
// never grant admin. Teachers land as pending_approval with a pending
// StaffMembership; students are linked immediately. Profile creation goes
// through the shared provisionProfile path only.
export default async function(req: Request): Promise<Response> {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204 });
    }
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const code = (body.code || '').trim().toUpperCase();
    if (!code) {
      return Response.json({ error: 'A school code is required' }, { status: 400 });
    }
    // NOTE: body.role_type is deliberately ignored — the role comes from the
    // code record below. Never trust a client-supplied role.

    const svc = base44.asServiceRole;

    // Look up the code (case-insensitive — fetch active codes and match)
    const allCodes = await svc.entities.SchoolCode.filter({
      status: 'active'
    });
    const schoolCode = allCodes.find(c =>
      (c.code || '').toUpperCase() === code
    );

    if (!schoolCode) {
      return Response.json({ error: 'Invalid school code. No school found with that code.' }, { status: 404 });
    }

    // Check expiry
    if (schoolCode.expires_at && new Date(schoolCode.expires_at) < new Date()) {
      return Response.json({ error: 'This code has expired. Contact the school administrator.' }, { status: 410 });
    }

    // Check max uses
    if (schoolCode.max_uses && (schoolCode.use_count || 0) >= schoolCode.max_uses) {
      return Response.json({ error: 'This code has reached its usage limit.' }, { status: 429 });
    }

    // Verify school is active
    const schools = await svc.entities.School.filter({ id: schoolCode.school_id });
    if (schools.length === 0) {
      return Response.json({ error: 'School no longer exists.' }, { status: 404 });
    }
    const school = schools[0];
    if (school.status !== 'active') {
      return Response.json({ error: 'This school is no longer active.' }, { status: 403 });
    }

    // Role comes from the code RECORD — teacher or student, never admin.
    const role = roleFromCode(schoolCode);

    // Ensure the profile exists through the single creation path.
    const { profile, already_exists } = await provisionProfile(svc, user, { join_code: schoolCode.code });

    if (role === 'teacher') {
      // Check StaffMembership for existing requests
      const existingStaff = await svc.entities.StaffMembership.filter({
        user_email: user.email,
        school_id: schoolCode.school_id
      });
      if (existingStaff.length > 0) {
        const mem = existingStaff[0];
        if (mem.status === 'active') {
          return Response.json({ error: 'You are already linked to this school.' }, { status: 409 });
        }
        if (mem.status === 'pending') {
          return Response.json({ error: 'Your join request is already pending admin approval.' }, { status: 409 });
        }
        // rejected — allow re-request by updating
        await svc.entities.StaffMembership.update(mem.id, {
          status: 'pending',
          joined_via_code: schoolCode.code,
          requested_at: new Date().toISOString(),
          reviewed_by: null,
          reviewed_at: null,
          rejection_reason: null,
        });
        await incrementUseCount(svc, schoolCode);
        return Response.json({
          success: true,
          status: 'pending',
          role: 'teacher',
          school_name: school.name,
          message: 'Your request has been sent to the school administrator.'
        });
      }

      // An account still in the 'pending' holding state becomes a teacher
      // awaiting approval. Anyone else keeps their existing role until the
      // admin approves the membership below.
      if (already_exists && profile.user_type === 'pending') {
        await svc.entities.UserProfile.update(profile.id, {
          user_type: 'teacher',
          status: 'pending_approval',
        });
        await logRoleGrant(svc, {
          record_id: profile.id,
          school_id: schoolCode.school_id,
          granted_by_email: schoolCode.created_by || user.email,
          granted_to_email: user.email,
          granted_to_name: `${profile.first_name} ${profile.last_name}`.trim(),
          role: 'teacher',
          old_role: 'pending',
          mechanism: `school join code ${schoolCode.code}`,
        });
      }

      // Create StaffMembership with pending status — no access until approved
      await svc.entities.StaffMembership.create({
        school_id: schoolCode.school_id,
        school_name: school.name,
        user_email: user.email,
        user_id: profile.id,
        teacher_name: `${profile.first_name} ${profile.last_name}`,
        role: 'TEACHER',
        class_ids: [],
        status: 'pending',
        joined_via_code: schoolCode.code,
        requested_at: new Date().toISOString(),
      });

      // Create audit log
      await svc.entities.AuditLog.create({
        record_id: schoolCode.school_id,
        school_id: schoolCode.school_id,
        actor_email: user.email,
        actor_name: `${profile.first_name} ${profile.last_name}`,
        actor_role: 'teacher',
        action: 'join_request_submitted',
        new_status: 'pending',
        notes: `Teacher requested to join ${school.name} via code ${schoolCode.code}`,
        timestamp: new Date().toISOString(),
      });

      await incrementUseCount(svc, schoolCode);

      return Response.json({
        success: true,
        status: 'pending',
        role: 'teacher',
        school_name: school.name,
        message: 'Your request has been sent to the school administrator.'
      });

    } else {
      // Student — auto-link to school (no approval needed, they join classes via class codes)
      if (profile.school_id === schoolCode.school_id) {
        return Response.json({ error: 'You are already linked to this school.' }, { status: 409 });
      }

      if (already_exists) {
        const oldRole = profile.user_type;
        await svc.entities.UserProfile.update(profile.id, {
          school_id: schoolCode.school_id,
          active_school_id: schoolCode.school_id,
          user_type: 'student',
          admin_email: school.admin_email,
        });
        if (oldRole !== 'student') {
          await logRoleGrant(svc, {
            record_id: profile.id,
            school_id: schoolCode.school_id,
            granted_by_email: schoolCode.created_by || user.email,
            granted_to_email: user.email,
            granted_to_name: `${profile.first_name} ${profile.last_name}`.trim(),
            role: 'student',
            old_role: oldRole,
            mechanism: `school join code ${schoolCode.code}`,
          });
        }
      }

      await incrementUseCount(svc, schoolCode);

      return Response.json({
        success: true,
        status: 'active',
        role: 'student',
        school_name: school.name,
        message: `You have been linked to ${school.name}. Join a class using a class code to get started.`
      });
    }

  } catch (error) {
    console.error('joinSchoolByCode error:', error);
    return Response.json({ error: error.message || 'Failed to join school' }, { status: 500 });
  }
}

async function incrementUseCount(svc, schoolCode) {
  try {
    await svc.entities.SchoolCode.update(schoolCode.id, {
      use_count: (schoolCode.use_count || 0) + 1,
    });
  } catch (e) {
    console.error('Failed to increment use count:', e);
  }
}