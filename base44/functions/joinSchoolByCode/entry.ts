import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  provisionProfile, logRoleGrant, roleFromCode,
  normalizeJoinCode, ensureTeacherMembership,
} from '../../shared/profileProvisioning.ts';
import { resolveEffectiveActor } from '../../shared/testMode.ts';

// joinSchoolByCode — join (or switch to) a school with a join code.
// SECURITY: the role comes from the SchoolCode RECORD, never the request body.
// Codes can only ever grant teacher (with admin approval) or student.
// Profile creation goes through provisionProfile — the single server-side path.
export default async function(req: Request): Promise<Response> {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

    const base44 = createClientFromRequest(req);

    // Effective actor: under Test Mode the simulated persona joins the school,
    // not the controller. A brand-new account with no profile yet cannot have
    // a persona, so it falls back to the real signed-in user and
    // provisionProfile below creates the profile.
    const actor = await resolveEffectiveActor(base44);
    let user;
    if (actor.authorized) {
      user = { id: actor.controller_user_id, email: actor.actor_email, full_name: `${actor.first_name || ''} ${actor.last_name || ''}`.trim() };
    } else if (actor.reason === 'User profile not found') {
      const me = await base44.auth.me();
      if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      user = me;
    } else {
      return Response.json({ error: actor.reason || 'Unauthorized' }, { status: actor.status || 401 });
    }

    const body = await req.json().catch(() => ({}));
    const rawCode = (body.code || '').trim();
    if (!rawCode) return Response.json({ error: 'A school code is required' }, { status: 400 });

    const svc = base44.asServiceRole;
    const normalized = normalizeJoinCode(rawCode);

    // Look up the code (status, expiry and role all come from the RECORD)
    const allCodes = await svc.entities.SchoolCode.filter({ status: 'active' });
    const schoolCode = allCodes.find(c => normalizeJoinCode(c.code) === normalized);
    if (!schoolCode) return Response.json({ error: 'Invalid school code. No school found with that code.' }, { status: 404 });
    if (schoolCode.expires_at && new Date(schoolCode.expires_at) < new Date()) {
      return Response.json({ error: 'This code has expired. Contact the school administrator.' }, { status: 410 });
    }
    if (schoolCode.max_uses && (schoolCode.use_count || 0) >= schoolCode.max_uses) {
      return Response.json({ error: 'This code has reached its usage limit.' }, { status: 429 });
    }

    // Role derived from the code record — never from the request body.
    let role;
    try {
      role = roleFromCode(schoolCode);
    } catch (e: any) {
      return Response.json({ error: e.message }, { status: 403 });
    }

    const schools = await svc.entities.School.filter({ id: schoolCode.school_id });
    const school = schools[0];
    if (!school) return Response.json({ error: 'School no longer exists.' }, { status: 404 });
    if (school.status !== 'active') return Response.json({ error: 'This school is no longer active.' }, { status: 403 });

    // Ensure the profile exists — provisionProfile is the ONLY creation path.
    const { profile, already_exists, teacher_membership } = await provisionProfile(svc, user, {
      join_code: schoolCode.code,
    });

    // ── Teacher: queued for admin approval, no school access until approved ──
    if (role === 'teacher') {
      if (!already_exists && teacher_membership === 'pending') {
        await incrementUseCount(svc, schoolCode);
        return Response.json({
          success: true, status: 'pending', role: 'teacher', school_name: school.name,
          message: 'Your request has been sent to the school administrator.',
        });
      }

      const membershipStatus = await ensureTeacherMembership(svc, {
        user, profile, school, code: schoolCode.code,
      });
      if (membershipStatus === 'already_active') {
        return Response.json({ error: 'You are already linked to this school.' }, { status: 409 });
      }
      if (membershipStatus === 'already_pending') {
        return Response.json({ error: 'Your join request is already pending admin approval.' }, { status: 409 });
      }

      // An unplaced ('pending') profile becomes a pending teacher now — a role
      // grant via code, so it is audited.
      if (already_exists && profile.user_type === 'pending') {
        await svc.entities.UserProfile.update(profile.id, {
          user_type: 'teacher', status: 'pending_approval',
        });
        await logRoleGrant(svc, {
          record_id: profile.id,
          school_id: school.id,
          granted_by_email: schoolCode.created_by || user.email,
          granted_to_email: user.email,
          granted_to_name: `${profile.first_name} ${profile.last_name}`.trim(),
          role: 'teacher',
          old_role: 'pending',
          mechanism: `school join code ${schoolCode.code}`,
        });
      }

      await incrementUseCount(svc, schoolCode);
      return Response.json({
        success: true, status: 'pending', role: 'teacher', school_name: school.name,
        message: 'Your request has been sent to the school administrator.',
      });
    }

    // ── Student: linked immediately ──
    if (!already_exists) {
      // provisionProfile created the profile already linked to the school.
      await incrementUseCount(svc, schoolCode);
      return Response.json({
        success: true, status: 'active', role: 'student', school_name: school.name,
        message: `You have joined ${school.name}.`,
      });
    }

    if (profile.school_id === schoolCode.school_id) {
      return Response.json({ error: 'You are already linked to this school.' }, { status: 409 });
    }

    const oldRole = profile.user_type;
    await svc.entities.UserProfile.update(profile.id, {
      school_id: school.id,
      active_school_id: school.id,
      user_type: 'student',
      admin_email: school.admin_email,
    });
    if (oldRole !== 'student') {
      await logRoleGrant(svc, {
        record_id: profile.id,
        school_id: school.id,
        granted_by_email: schoolCode.created_by || user.email,
        granted_to_email: user.email,
        granted_to_name: `${profile.first_name} ${profile.last_name}`.trim(),
        role: 'student',
        old_role: oldRole,
        mechanism: `school join code ${schoolCode.code}`,
      });
    }

    await incrementUseCount(svc, schoolCode);
    return Response.json({
      success: true, status: 'active', role: 'student', school_name: school.name,
      message: `You have joined ${school.name}.`,
    });
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