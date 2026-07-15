import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
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
    const { code, role_type } = body;

    if (!code?.trim()) {
      return Response.json({ error: 'A school code is required' }, { status: 400 });
    }

    const normalizedCode = code.trim().toUpperCase();

    // Look up code (case-insensitive — fetch active codes and match)
    const allCodes = await base44.asServiceRole.entities.SchoolCode.filter({
      status: 'active'
    });
    const schoolCode = allCodes.find(c =>
      (c.code || '').toUpperCase() === normalizedCode
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
    const schools = await base44.asServiceRole.entities.School.filter({ id: schoolCode.school_id });
    if (schools.length === 0) {
      return Response.json({ error: 'School no longer exists.' }, { status: 404 });
    }
    const school = schools[0];
    if (school.status !== 'active') {
      return Response.json({ error: 'This school is no longer active.' }, { status: 403 });
    }

    // Check code role_type matches the requested role
    if (role_type && schoolCode.role_type !== 'all' && schoolCode.role_type !== role_type) {
      return Response.json({
        error: `This code is for ${schoolCode.role_type}s, not ${role_type}s.`
      }, { status: 403 });
    }

    // Ensure UserProfile exists
    let profile = null;
    const profiles = await base44.asServiceRole.entities.UserProfile.filter({ user_email: user.email });
    if (profiles.length > 0) {
      profile = profiles[0];
    } else {
      const nameParts = (user.full_name || user.email || 'User').split(/\s+/);
      profile = await base44.asServiceRole.entities.UserProfile.create({
        user_email: user.email,
        user_type: role_type || 'teacher',
        first_name: nameParts[0] || 'User',
        last_name: nameParts.slice(1).join(' ') || '',
        status: 'active',
        total_achievement_points: 0,
        total_behaviour_points: 0,
      });
    }

    const effectiveRole = role_type || schoolCode.role_type || profile.user_type || 'teacher';

    // Check if user is already linked to this school
    if (effectiveRole === 'teacher' || effectiveRole === 'admin') {
      // Check StaffMembership for teachers
      if (effectiveRole === 'teacher') {
        const existingStaff = await base44.asServiceRole.entities.StaffMembership.filter({
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
          await base44.asServiceRole.entities.StaffMembership.update(mem.id, {
            status: 'pending',
            joined_via_code: schoolCode.code,
            requested_at: new Date().toISOString(),
            reviewed_by: null,
            reviewed_at: null,
            rejection_reason: null,
          });
          await incrementUseCount(base44, schoolCode);
          return Response.json({
            success: true,
            status: 'pending',
            school_name: school.name,
            message: 'Your request has been sent to the school administrator.'
          });
        }
      }

      // Check AdminSchoolMembership for admins
      if (effectiveRole === 'admin') {
        const existingAdmin = await base44.asServiceRole.entities.AdminSchoolMembership.filter({
          admin_email: user.email,
          school_id: schoolCode.school_id
        });
        if (existingAdmin.length > 0) {
          const mem = existingAdmin[0];
          if (mem.status === 'active') {
            return Response.json({ error: 'You are already linked to this school.' }, { status: 409 });
          }
          if (mem.status === 'pending') {
            return Response.json({ error: 'Your join request is already pending admin approval.' }, { status: 409 });
          }
        }
      }
    }

    // Create membership based on role
    if (effectiveRole === 'teacher') {
      // Create StaffMembership with pending status
      await base44.asServiceRole.entities.StaffMembership.create({
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
      await base44.asServiceRole.entities.AuditLog.create({
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

      await incrementUseCount(base44, schoolCode);

      return Response.json({
        success: true,
        status: 'pending',
        school_name: school.name,
        message: 'Your request has been sent to the school administrator.'
      });

    } else if (effectiveRole === 'admin') {
      // Admin join requests always require approval
      await base44.asServiceRole.entities.AdminSchoolMembership.create({
        admin_user_id: profile.id,
        admin_email: user.email,
        admin_name: `${profile.first_name} ${profile.last_name}`,
        school_id: schoolCode.school_id,
        school_name: school.name,
        role: 'admin',
        status: 'pending',
        is_primary: !profile.school_id,
        joined_at: new Date().toISOString(),
      });

      await base44.asServiceRole.entities.AuditLog.create({
        record_id: schoolCode.school_id,
        school_id: schoolCode.school_id,
        actor_email: user.email,
        actor_name: `${profile.first_name} ${profile.last_name}`,
        actor_role: 'admin',
        action: 'join_request_submitted',
        new_status: 'pending',
        notes: `Admin requested to join ${school.name} via code ${schoolCode.code}`,
        timestamp: new Date().toISOString(),
      });

      await incrementUseCount(base44, schoolCode);

      return Response.json({
        success: true,
        status: 'pending',
        school_name: school.name,
        message: 'Your admin access request has been sent to the school owner for approval.'
      });

    } else {
      // Student — auto-link to school (no approval needed, they join classes via class codes)
      if (profile.school_id === schoolCode.school_id) {
        return Response.json({ error: 'You are already linked to this school.' }, { status: 409 });
      }

      await base44.asServiceRole.entities.UserProfile.update(profile.id, {
        school_id: schoolCode.school_id,
        active_school_id: schoolCode.school_id,
        user_type: 'student',
        admin_email: school.admin_email,
      });

      await incrementUseCount(base44, schoolCode);

      return Response.json({
        success: true,
        status: 'active',
        school_name: school.name,
        message: `You have been linked to ${school.name}. Join a class using a class code to get started.`
      });
    }

  } catch (error) {
    console.error('joinSchoolByCode error:', error);
    return Response.json({ error: error.message || 'Failed to join school' }, { status: 500 });
  }
});

async function incrementUseCount(base44, schoolCode) {
  try {
    await base44.asServiceRole.entities.SchoolCode.update(schoolCode.id, {
      use_count: (schoolCode.use_count || 0) + 1,
    });
  } catch (e) {
    console.error('Failed to increment use count:', e);
  }
}