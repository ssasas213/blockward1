import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { verifyTestSuperUser } from '../../shared/testMode.ts';
import { provisionProfile } from '../../shared/profileProvisioning.ts';
import { createSchoolForAdmin } from '../../shared/schoolSetup.ts';

// seedDemoOrganisation — one-action seeding of a COMPLETE demo organisation
// for testing all three roles. Every account goes through provisionProfile
// (role derived server-side from the join code — the request NEVER carries a
// role) and the school through createSchoolForAdmin (the setupSchool path) —
// the exact code paths real users take. RLS is never bypassed and user_type
// is never written directly.
//
// Seeded: 1 owner admin (super_admin, unverified organisation), 2 teachers
// (pending_approval — so the approve-teacher flow can be tested), 20 students
// with enrolments, 1 class, a Mon–Fri timetable, 5 days of attendance
// history, and 3 achievement requests at different lifecycle stages.
//
// Every record is scoped to the demo school and tracked by a DemoSeedRun
// record, so `action: 'remove'` deletes the whole organisation cleanly.
//
// Authorization: the Test Super User, or a real profile with
// user_type 'admin' + admin_level 'super_admin'. Also runnable from the
// Base44 console.
//
// Actions: 'seed' | 'remove' | 'status'

const DEMO_DOMAIN = 'demo.blockward.test';
const DEMO_SCHOOL_NAME = 'Riverside Demo Academy';
const DEMO_ADMIN = { email: `amelia.foster@${DEMO_DOMAIN}`, first_name: 'Amelia', last_name: 'Foster' };
const DEMO_TEACHERS = [
  { email: `daniel.brooks@${DEMO_DOMAIN}`, first_name: 'Daniel', last_name: 'Brooks', dob: '1988-06-10' },
  { email: `sara.kim@${DEMO_DOMAIN}`, first_name: 'Sara', last_name: 'Kim', dob: '1990-02-22' },
];
const STUDENT_FIRSTS = ['Aiden', 'Basil', 'Cleo', 'Dalia', 'Emir', 'Farah', 'Gabriel', 'Hana', 'Ivan', 'Jude', 'Kaya', 'Liam', 'Maya', 'Noor', 'Omar', 'Priya', 'Quinn', 'Rania', 'Sami', 'Tara'];
const STUDENT_LASTS = ['Haddad', 'Iqbal', 'Jackson', 'Kaur', 'Lowe', 'Mansour', 'Novak', 'Okafor', 'Patel', 'Quintero', 'Rahman', 'Sato', 'Tan', 'Uddin', 'Vega', 'Wong', 'Youssef', 'Zaid', 'Abboud', 'Choi'];

// Everything created by the seed is scoped to the demo school — purging by
// school_id is what makes removal clean and complete.
const PURGE_ENTITIES = ['SchoolCode', 'AdminSchoolMembership', 'StaffMembership', 'Enrollment', 'Class', 'TimetableEntry', 'AttendanceSession', 'AttendanceRecord', 'AchievementRequest', 'AuditLog'];

async function authorize(base44) {
  // 1) Test Super User (server-authorised by secret)
  const check = await verifyTestSuperUser(base44);
  if (check.authorized) return { ok: true, email: check.user.email };
  // 2) A real super admin
  const user = await base44.auth.me();
  if (!user) return { ok: false, status: 401, reason: 'Not authenticated' };
  const svc = base44.asServiceRole;
  const profiles = await svc.entities.UserProfile.filter({ user_email: user.email });
  const p = profiles[0];
  if (!p || p.user_type !== 'admin' || p.admin_level !== 'super_admin') {
    return { ok: false, status: 403, reason: 'Only super admins can manage demo data' };
  }
  return { ok: true, email: user.email };
}

export default async function(req) {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

    const base44 = createClientFromRequest(req);
    const auth = await authorize(base44);
    if (!auth.ok) return Response.json({ error: auth.reason }, { status: auth.status });
    const callerEmail = auth.email;

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'status';
    const svc = base44.asServiceRole;

    // ── status ────────────────────────────────────────────────────────────
    if (action === 'status') {
      const runs = await svc.entities.DemoSeedRun.filter({ status: 'active' });
      return Response.json({ ok: true, active_runs: runs.length, run: runs[0] || null });
    }

    // ── remove ────────────────────────────────────────────────────────────
    if (action === 'remove') {
      const runs = await svc.entities.DemoSeedRun.filter({ status: 'active' });
      if (runs.length === 0) return Response.json({ error: 'No active demo organisation found' }, { status: 404 });
      const deleted = {};
      for (const run of runs) {
        const schoolId = run.school_id;
        // Never delete the caller's own profile even if they switched their
        // active school to the demo one while browsing it.
        const protectedEmails = new Set([callerEmail, (run.created_by_email || '').toLowerCase()].map(e => (e || '').toLowerCase()));

        // Teacher emails must be read BEFORE the StaffMembership purge —
        // pending teachers carry no school_id on their profile.
        const staff = await svc.entities.StaffMembership.filter({ school_id: schoolId });
        const teacherEmails = new Set([
          ...(run.teacher_emails || []),
          ...staff.map(s => s.user_email).filter(Boolean),
        ].map(e => e.toLowerCase()));

        for (const name of PURGE_ENTITIES) {
          try {
            const items = await svc.entities[name].filter({ school_id: schoolId });
            if (items.length > 0) await svc.entities[name].deleteMany({ school_id: schoolId });
            deleted[name] = (deleted[name] || 0) + items.length;
          } catch (e) {
            deleted[name] = -1;
          }
        }

        // Profiles linked to the school (students + the demo owner admin)
        let profileCount = 0;
        const linked = await svc.entities.UserProfile.filter({ school_id: schoolId });
        const linkedIds = new Set();
        for (const p of linked) {
          linkedIds.add(p.id);
          if (protectedEmails.has((p.user_email || '').toLowerCase())) continue;
          await svc.entities.UserProfile.delete(p.id);
          profileCount++;
        }
        // Pending teachers (profile school_id is null) — delete by email
        for (const email of teacherEmails) {
          if (protectedEmails.has(email)) continue;
          const found = await svc.entities.UserProfile.filter({ user_email: email });
          const p = found[0];
          if (p && !linkedIds.has(p.id)) {
            await svc.entities.UserProfile.delete(p.id);
            profileCount++;
          }
        }
        deleted.UserProfile = (deleted.UserProfile || 0) + profileCount;

        await svc.entities.School.delete(schoolId);
        deleted.School = (deleted.School || 0) + 1;

        await svc.entities.DemoSeedRun.update(run.id, {
          status: 'removed',
          removed_at: new Date().toISOString(),
        });
      }
      return Response.json({ ok: true, deleted });
    }

    if (action !== 'seed') return Response.json({ error: 'Unknown action. Use seed | remove | status.' }, { status: 400 });

    // ── seed ─────────────────────────────────────────────────────────────
    const existingRuns = await svc.entities.DemoSeedRun.filter({ status: 'active' });
    if (existingRuns.length > 0) {
      return Response.json({ error: 'A demo organisation is already seeded. Remove it first with { "action": "remove" }.' }, { status: 409 });
    }

    // 1 — School + owner admin through the REAL setupSchool path
    const created = await createSchoolForAdmin(svc, {
      user: { email: DEMO_ADMIN.email, full_name: `${DEMO_ADMIN.first_name} ${DEMO_ADMIN.last_name}` },
      profile: null,
      name: DEMO_SCHOOL_NAME,
      school_type: 'secondary_school',
      country: 'United Arab Emirates',
      city: 'Dubai',
      contact_email: DEMO_ADMIN.email,
      admin_full_name: `${DEMO_ADMIN.first_name} ${DEMO_ADMIN.last_name}`,
      admin_job_title: 'Principal',
    });
    const school = created.school;

    // Registry FIRST — even a partial seed is always removable.
    const run = await svc.entities.DemoSeedRun.create({
      run_label: 'demo-' + Date.now(),
      school_id: school.id,
      school_name: school.name,
      created_by_email: callerEmail,
      status: 'active',
      teacher_emails: DEMO_TEACHERS.map(t => t.email),
    });

    // 2 — Two teachers through the real teacher-code path → pending_approval
    // (deliberately left pending so the admin approval flow can be tested)
    const teacherProfiles = [];
    for (const t of DEMO_TEACHERS) {
      const r = await provisionProfile(svc, { email: t.email, full_name: `${t.first_name} ${t.last_name}` }, {
        first_name: t.first_name,
        last_name: t.last_name,
        join_code: created.codes.teacher,
        date_of_birth: t.dob,
      });
      teacherProfiles.push(r.profile);
    }

    // 3 — Twenty students through the real student-code path, provisioned in
    // small batches: 20 simultaneous signups overload the database (the join-
    // code lookup inside provisionProfile is school-wide), so we pace them.
    const students = [];
    const studentSpecs = STUDENT_FIRSTS.map((first, i) => ({
      email: `student${String(i + 1).padStart(2, '0')}@${DEMO_DOMAIN}`,
      first,
      last: STUDENT_LASTS[i],
      dob: `2010-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 27) + 1).padStart(2, '0')}`,
    }));
    for (let c = 0; c < studentSpecs.length; c += 5) {
      const batch = await Promise.all(studentSpecs.slice(c, c + 5).map(spec =>
        provisionProfile(svc, { email: spec.email, full_name: `${spec.first} ${spec.last}` }, {
          first_name: spec.first,
          last_name: spec.last,
          join_code: created.codes.student,
          date_of_birth: spec.dob,
        }).then(r => ({ email: spec.email, profile: r.profile, name: `${spec.first} ${spec.last}` }))
      ));
      students.push(...batch);
    }

    // 4 — One class taught by teacher 1
    const cls = await svc.entities.Class.create({
      school_id: school.id,
      name: '10A Mathematics',
      subject: 'Mathematics',
      teacher_email: DEMO_TEACHERS[0].email,
      student_emails: students.map(s => s.email),
      grade_level: 'Year 10',
      room: 'M-101',
      join_code: 'DEMO10A',
      status: 'active',
    });

    // Mirror the class on the students' profiles (as joinClassByCode does)
    await svc.entities.UserProfile.bulkUpdate(students.map(s => ({ id: s.profile.id, class_ids: [cls.id] })));

    // 5 — Enrolments
    await svc.entities.Enrollment.bulkCreate(students.map(s => ({
      school_id: school.id,
      class_id: cls.id,
      class_name: cls.name,
      student_email: s.email,
      student_name: s.name,
      status: 'active',
    })));

    // 6 — Timetable: one Mathematics lesson Mon–Fri
    await svc.entities.TimetableEntry.bulkCreate([0, 1, 2, 3, 4].map(day => ({
      school_id: school.id,
      class_id: cls.id,
      class_name: cls.name,
      teacher_email: DEMO_TEACHERS[0].email,
      day_of_week: day,
      start_time: '09:00',
      end_time: '10:00',
      room: 'M-101',
      subject: 'Mathematics',
      period_number: day + 1,
    })));

    // 7 — Attendance history: the last 5 weekdays
    const statusFor = (i) => (i % 10 === 3 ? 'late' : (i % 10 === 7 ? 'absent' : 'present'));
    const lessonDates = [];
    const cursor = new Date();
    while (lessonDates.length < 5) {
      cursor.setDate(cursor.getDate() - 1);
      const dow = cursor.getDay();
      if (dow !== 0 && dow !== 6) lessonDates.push(cursor.toISOString().slice(0, 10));
    }
    for (const date of lessonDates) {
      const counts = { present: 0, absent: 0, late: 0 };
      students.forEach((s, i) => { counts[statusFor(i)]++; });
      const session = await svc.entities.AttendanceSession.create({
        school_id: school.id,
        class_id: cls.id,
        class_name: cls.name,
        teacher_email: DEMO_TEACHERS[0].email,
        date,
        session_start_time: '09:00',
        session_end_time: '10:00',
        created_by_email: DEMO_TEACHERS[0].email,
        created_at: new Date(date + 'T09:00:00Z').toISOString(),
        marks_count: students.length,
        present_count: counts.present,
        absent_count: counts.absent,
        late_count: counts.late,
      });
      await svc.entities.AttendanceRecord.bulkCreate(students.map((s, i) => ({
        school_id: school.id,
        class_id: cls.id,
        class_name: cls.name,
        student_email: s.email,
        student_name: s.name,
        date,
        status: statusFor(i),
        marked_by_email: DEMO_TEACHERS[0].email,
        marked_by_name: `${DEMO_TEACHERS[0].first_name} ${DEMO_TEACHERS[0].last_name}`,
        marked_at: new Date(date + 'T09:05:00Z').toISOString(),
        attendance_session_id: session.id,
      })));
    }

    // 8 — Achievement requests at different lifecycle stages
    const teacher1 = DEMO_TEACHERS[0];
    const teacher1Name = `${teacher1.first_name} ${teacher1.last_name}`;
    const nowMs = Date.now();
    const ago = (days) => new Date(nowMs - days * 86400000).toISOString();
    const baseReq = (student, extra) => ({
      school_id: school.id,
      school_name: school.name,
      student_id: student.profile.id,
      student_email: student.email,
      student_name: student.name,
      verification_mode: 'organisation',
      verification_tier: 1,
      nominated_verifier_id: teacherProfiles[0] ? teacherProfiles[0].id : null,
      nominated_verifier_email: teacher1.email,
      nominated_verifier_name: teacher1Name,
      ...extra,
    });
    await Promise.all([
      // Stage 1 — freshly submitted, waiting for the verifier
      svc.entities.AchievementRequest.create(baseReq(students[0], {
        category: 'academic',
        credential_type_title: 'Gold Award — Mathematics Challenge',
        title: 'Gold Award — Mathematics Challenge',
        description: 'Top score in the inter-school mathematics challenge final.',
        date_achieved: lessonDates[3] || lessonDates[0],
        status: 'submitted',
        submitted_at: ago(4),
        event_log: [
          { event: 'created', timestamp: ago(5), actor_email: students[0].email },
          { event: 'submitted', timestamp: ago(4), actor_email: students[0].email, actor_role: 'student' },
        ],
      })),
      // Stage 2 — verifier signed AND admin approved
      svc.entities.AchievementRequest.create(baseReq(students[1], {
        category: 'sports',
        credential_type_title: 'Regional Swimming Gala — 1st Place',
        title: 'Regional Swimming Gala — 1st Place',
        description: 'Won the 100m freestyle final at the regional schools gala.',
        date_achieved: lessonDates[4] || lessonDates[0],
        status: 'approved',
        submitted_at: ago(10),
        approved_at: ago(3),
        verifier_signoff: {
          signer_id: teacherProfiles[0] ? teacherProfiles[0].id : null,
          signer_email: teacher1.email,
          signer_name: teacher1Name,
          signer_role: 'teacher',
          method: 'witnessed_in_person',
          attestation: true,
          signature: teacher1Name,
          signed_at: ago(5),
        },
        admin_signoff: {
          signer_email: DEMO_ADMIN.email,
          signer_name: `${DEMO_ADMIN.first_name} ${DEMO_ADMIN.last_name}`,
          signer_role: 'admin',
          method: 'official_records',
          attestation: true,
          signature: `${DEMO_ADMIN.first_name} ${DEMO_ADMIN.last_name}`,
          signed_at: ago(3),
        },
        event_log: [
          { event: 'submitted', timestamp: ago(10), actor_email: students[1].email, actor_role: 'student' },
          { event: 'verifier_signed', timestamp: ago(5), actor_email: teacher1.email, actor_role: 'teacher' },
          { event: 'admin_approved', timestamp: ago(3), actor_email: DEMO_ADMIN.email, actor_role: 'admin' },
        ],
      })),
      // Stage 3 — sent back to the student for changes
      svc.entities.AchievementRequest.create(baseReq(students[2], {
        category: 'leadership',
        credential_type_title: 'Debate Team Captain',
        title: 'Debate Team Captain — Autumn Term',
        description: 'Elected captain of the senior debate team for the autumn term.',
        date_achieved: lessonDates[2] || lessonDates[0],
        status: 'changes_requested',
        submitted_at: ago(7),
        changes_requested_reason: 'Please attach evidence from the final debate and confirm the election date.',
        event_log: [
          { event: 'submitted', timestamp: ago(7), actor_email: students[2].email, actor_role: 'student' },
          { event: 'changes_requested', timestamp: ago(2), actor_email: teacher1.email, actor_role: 'teacher' },
        ],
      })),
    ]);

    // 9 — Give the seeder member access to the demo school so they can browse
    // it (member, not owner — the owner is the demo admin).
    const callerProfiles = await svc.entities.UserProfile.filter({ user_email: callerEmail });
    const callerProfile = callerProfiles[0];
    await svc.entities.AdminSchoolMembership.create({
      admin_user_id: callerProfile ? callerProfile.id : callerEmail,
      admin_email: callerEmail,
      admin_name: callerProfile ? `${callerProfile.first_name} ${callerProfile.last_name}`.trim() : callerEmail,
      school_id: school.id,
      school_name: school.name,
      role: 'admin',
      status: 'active',
      is_primary: false,
      joined_at: new Date().toISOString(),
    });

    await svc.entities.DemoSeedRun.update(run.id, {
      student_count: students.length,
      seeded_at: new Date().toISOString(),
    });

    return Response.json({
      ok: true,
      school: { id: school.id, name: school.name },
      admin: { email: DEMO_ADMIN.email, admin_level: 'super_admin', verification_status: 'unverified' },
      teachers: DEMO_TEACHERS.map(t => ({ email: t.email, status: 'pending_approval' })),
      teacher_join_code: created.codes.teacher,
      student_join_code: created.codes.student,
      class: { id: cls.id, name: cls.name },
      students: students.length,
      achievement_requests: 3,
      note: 'Teachers are pending_approval on purpose — approve them from People to exercise the staff approval flow.',
    });
  } catch (error) {
    console.error('seedDemoOrganisation error:', error);
    return Response.json({ error: error.message || 'Seed failed' }, { status: 500 });
  }
}