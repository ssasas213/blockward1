import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  verifyTestSuperUser, TEST_SCHOOL_NAME, TEST_SCHOOL_CODE, TEST_CLASS_NAME,
  PERSONA_EMAILS, PERSONA_NAMES, isValidPersona,
} from '../../shared/testMode.ts';

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

    // 1. Ensure test school
    let schools = await svc.entities.School.filter({ code: TEST_SCHOOL_CODE });
    let school = schools[0];
    if (!school) {
      school = await svc.entities.School.create({
        name: TEST_SCHOOL_NAME, code: TEST_SCHOOL_CODE, school_code: TEST_SCHOOL_CODE,
        org_type: 'school', school_type: 'other', admin_email: user.email,
        status: 'active', created_by: user.email, contact_email: user.email,
      });
    }

    // 2. Ensure the THREE test persona profiles (distinct emails + IDs)
    const personaIds = { student: null, teacher: null, admin: null };
    const personas = {};
    for (const role of ['student', 'teacher', 'admin']) {
      const email = PERSONA_EMAILS[role];
      const name = PERSONA_NAMES[role];
      let found = await svc.entities.UserProfile.filter({ user_email: email });
      let p = found[0];
      if (!p) {
        p = await svc.entities.UserProfile.create({
          user_email: email, user_type: role,
          first_name: name.first_name, last_name: name.last_name,
          school_id: school.id, active_school_id: school.id,
          admin_email: user.email, status: 'active',
          test_persona_of: user.email,
          total_achievement_points: 0, total_behaviour_points: 0,
        });
      } else {
        const upd: any = {};
        if (p.school_id !== school.id) { upd.school_id = school.id; upd.active_school_id = school.id; }
        if (p.status !== 'active') upd.status = 'active';
        if (p.first_name !== name.first_name) upd.first_name = name.first_name;
        if (p.last_name !== name.last_name) upd.last_name = name.last_name;
        if (!p.test_persona_of) upd.test_persona_of = user.email;
        if (Object.keys(upd).length) p = await svc.entities.UserProfile.update(p.id, upd);
      }
      personaIds[role] = p.id;
      personas[role] = { id: p.id, email: p.user_email, name: `${name.first_name} ${name.last_name}`, first_name: name.first_name, last_name: name.last_name, role };
    }

    // 3. Ensure test class (teacher assigned, student enrolled)
    let classes = await svc.entities.Class.filter({ school_id: school.id, name: TEST_CLASS_NAME });
    let testClass = classes[0];
    if (!testClass) {
      testClass = await svc.entities.Class.create({
        school_id: school.id, name: TEST_CLASS_NAME, subject: 'General',
        teacher_email: PERSONA_EMAILS.teacher,
        student_emails: [PERSONA_EMAILS.student],
        status: 'active',
      });
    } else {
      const upd: any = {};
      if (testClass.teacher_email !== PERSONA_EMAILS.teacher) upd.teacher_email = PERSONA_EMAILS.teacher;
      const enrolled = testClass.student_emails || [];
      if (!enrolled.includes(PERSONA_EMAILS.student)) upd.student_emails = [...enrolled, PERSONA_EMAILS.student];
      if (Object.keys(upd).length) testClass = await svc.entities.Class.update(testClass.id, upd);
    }

    // 4. Ensure teacher StaffMembership
    const teacherMembership = await svc.entities.StaffMembership.filter({ school_id: school.id, user_email: PERSONA_EMAILS.teacher });
    if (teacherMembership.length === 0) {
      await svc.entities.StaffMembership.create({
        school_id: school.id, school_name: school.name,
        user_email: PERSONA_EMAILS.teacher, user_id: personaIds.teacher,
        teacher_name: `${PERSONA_NAMES.teacher.first_name} ${PERSONA_NAMES.teacher.last_name}`,
        role: 'TEACHER', class_ids: [testClass.id], status: 'active',
      });
    }

    // 5. Ensure admin AdminSchoolMembership
    const adminMembership = await svc.entities.AdminSchoolMembership.filter({ admin_email: PERSONA_EMAILS.admin, school_id: school.id });
    if (adminMembership.length === 0) {
      await svc.entities.AdminSchoolMembership.create({
        admin_user_id: personaIds.admin, admin_email: PERSONA_EMAILS.admin,
        admin_name: `${PERSONA_NAMES.admin.first_name} ${PERSONA_NAMES.admin.last_name}`,
        school_id: school.id, school_name: school.name,
        role: 'owner', status: 'active', is_primary: true,
        joined_at: new Date().toISOString(), invited_by: user.email,
      });
    }

    // 6. Ensure signature profiles for teacher + admin personas
    for (const role of ['teacher', 'admin']) {
      const email = PERSONA_EMAILS[role];
      const name = PERSONA_NAMES[role];
      const existing = await svc.entities.SignatureProfile.filter({ user_email: email, school_id: school.id });
      if (existing.length === 0) {
        await svc.entities.SignatureProfile.create({
          user_email: email, school_id: school.id, user_role: role,
          display_name: `${name.first_name} ${name.last_name}`,
          title: role === 'teacher' ? 'Test Teacher' : 'Test Administrator',
          signature_type: 'typed', signature_value: `${name.first_name} ${name.last_name}`.replace(' (TEST MODE)', ''),
          created_at: new Date().toISOString(),
        });
      }
    }

    // 7. Ensure the controller profile (the real Google account) + link persona IDs
    let controllerProfiles = await svc.entities.UserProfile.filter({ user_email: user.email });
    let controller = controllerProfiles[0];
    const activePersona = (controller?.active_test_persona && isValidPersona(controller.active_test_persona)) ? controller.active_test_persona : 'admin';
    if (!controller) {
      const name = PERSONA_NAMES[activePersona];
      controller = await svc.entities.UserProfile.create({
        user_email: user.email, user_type: 'admin',
        first_name: name.first_name, last_name: name.last_name,
        school_id: school.id, active_school_id: school.id, admin_email: user.email,
        status: 'active', test_super_user: true, active_test_persona: activePersona,
        test_persona_ids: personaIds,
        total_achievement_points: 0, total_behaviour_points: 0,
      });
    } else {
      // Force-promote the controller to admin and link the test school, overwriting
      // any stale role/school from prior onboarding (e.g. a student signup). This is
      // idempotent and preserves the profile record + its id; only role/school/persona
      // metadata is normalised so the super user always lands on the Admin Dashboard.
      const upd: any = {
        test_super_user: true,
        user_type: 'admin',
        active_test_persona: activePersona,
        school_id: school.id,
        active_school_id: school.id,
        test_persona_ids: personaIds,
      };
      if (controller.status !== 'active') upd.status = 'active';
      controller = await svc.entities.UserProfile.update(controller.id, upd);
    }

    return Response.json({
      test_mode_enabled: true,
      is_test_super_user: true,
      active_persona: activePersona,
      test_school: { id: school.id, name: school.name },
      test_class: { id: testClass.id, name: testClass.name },
      personas,
      profile_id: controller.id,
    });
  } catch (error) {
    return Response.json({ error: error.message, test_mode_enabled: false, is_test_super_user: false }, { status: 500 });
  }
}