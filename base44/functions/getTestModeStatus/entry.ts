import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { verifyTestSuperUser, TEST_SCHOOL_NAME, TEST_SCHOOL_CODE, PERSONAS, isValidPersona } from '../../shared/testMode.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const check = await verifyTestSuperUser(base44);
    if (!check.authorized) {
      return Response.json({
        test_mode_enabled: false,
        is_test_super_user: false,
        reason: check.reason,
      }, { status: 200 });
    }
    const user = check.user;
    const svc = base44.asServiceRole;

    // 1. Ensure test school exists
    let schools = await svc.entities.School.filter({ code: TEST_SCHOOL_CODE });
    let school = schools[0];
    if (!school) {
      school = await svc.entities.School.create({
        name: TEST_SCHOOL_NAME,
        code: TEST_SCHOOL_CODE,
        school_code: TEST_SCHOOL_CODE,
        org_type: 'school',
        school_type: 'other',
        admin_email: user.email,
        status: 'active',
        created_by: user.email,
        contact_email: user.email,
      });
    }

    // 2. Ensure super user profile
    let profiles = await svc.entities.UserProfile.filter({ user_email: user.email });
    let profile = profiles[0];
    const activePersona = (profile?.active_test_persona && isValidPersona(profile.active_test_persona)) ? profile.active_test_persona : 'admin';
    const personaName = PERSONAS[activePersona];

    if (!profile) {
      profile = await svc.entities.UserProfile.create({
        user_email: user.email,
        user_type: 'admin',
        first_name: personaName.first_name,
        last_name: personaName.last_name,
        school_id: school.id,
        active_school_id: school.id,
        admin_email: user.email,
        status: 'active',
        test_super_user: true,
        active_test_persona: activePersona,
        total_achievement_points: 0,
        total_behaviour_points: 0,
      });
    } else {
      const updates: any = {};
      if (!profile.test_super_user) updates.test_super_user = true;
      if (!profile.school_id) { updates.school_id = school.id; updates.active_school_id = school.id; }
      if (!profile.active_test_persona) updates.active_test_persona = activePersona;
      if (!profile.user_type) updates.user_type = 'admin';
      if (profile.status !== 'active') updates.status = 'active';
      if (Object.keys(updates).length > 0) {
        profile = await svc.entities.UserProfile.update(profile.id, updates);
      }
    }

    // 3. Ensure admin membership
    const memberships = await svc.entities.AdminSchoolMembership.filter({ admin_email: user.email, school_id: school.id });
    if (memberships.length === 0) {
      await svc.entities.AdminSchoolMembership.create({
        admin_user_id: profile.id,
        admin_email: user.email,
        admin_name: `${personaName.first_name} ${personaName.last_name}`,
        school_id: school.id,
        school_name: school.name,
        role: 'owner',
        status: 'active',
        is_primary: true,
        joined_at: new Date().toISOString(),
        invited_by: user.email,
      });
    }

    return Response.json({
      test_mode_enabled: true,
      is_test_super_user: true,
      active_persona: activePersona,
      test_school: { id: school.id, name: school.name },
      profile_id: profile.id,
    });
  } catch (error) {
    return Response.json({ error: error.message, test_mode_enabled: false, is_test_super_user: false }, { status: 500 });
  }
}