// ============================================================================
// seedPitchDemo — the LIVE-PITCH demonstration world: BlockWard Demo School.
//
// PRESERVATION CONTRACT — every record is produced through the REAL code
// paths, never by faking flow entities:
//   - organisation: createSchoolForAdmin (the setupSchool path)
//   - accounts: provisionProfile (role derived server-side from join codes)
//   - teacher approval: staffApprovals.reviewStaffMembership (the real engine)
//   - achievements: shared/achievementRequestFlow (the SAME module the
//     achievementRequestAction endpoint dispatches through) — student submits
//     → nominated teacher signs → admin approves → mint → archived
//   - on-chain anchor: shared/chainAnchor.anchorCredential (the real
//     idempotent anchoring pipeline with the BW-HASH-V1 commitment)
//
// The three PITCH ACCOUNTS (admin, teacher, student) live on REAL email
// addresses the app owner controls (defaults below, overridable via
// { emails: { admin, teacher, student } }). The owner creates those inboxes,
// accepts the /invite/<token> links created here, and logs in through the
// normal authentication screen during the pitch. No login bypasses, no
// hardcoded credentials. All other cast members are clearly fictional and
// live on the reserved @demo.blockward.test domain.
//
// Idempotent/resumable: every step re-derives its own state, so re-running
// after a timeout continues where it left off. To change the three pitch
// emails: run { action: 'remove' } first, then seed with the new emails.
//
// Actions: 'seed' | 'remove' | 'status'
// ============================================================================
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { provisionProfile } from '../../shared/profileProvisioning.ts';
import { createSchoolForAdmin } from '../../shared/schoolSetup.ts';
import { reviewStaffMembership } from '../../shared/staffApprovals.ts';
import { isHandleAvailable } from '../../shared/handles.ts';
import { submitRequest, runReviewerAction } from '../../shared/achievementRequestFlow.ts';
import { makeToken } from '../../shared/invitations.ts';
import { anchorCredential } from '../../shared/chainAnchor.ts';
import {
  appUrl, ago, day, inDaysDate, fail, norm, sleep, retryRateLimit,
  gradeFor, profileByEmail, findRequest, authorizeDemo,
} from '../../shared/demoSeeding.ts';

const D = 'demo.blockward.test';
const IMG = 'https://media.base44.com/images/public/6936b840baa53bb465f68d09';

// ── The pitch cast ──
const SCHOOL_NAME = 'BlockWard Demo School';
const DEFAULT_EMAILS = {
  admin: 'blockward.demo.admin@gmail.com',
  teacher: 'blockward.demo.teacher@gmail.com',
  student: 'blockward.demo.student@gmail.com',
};
const ADMIN = { first: 'Layla', last: 'Rahman', prefix: 'Dr.', title: 'Principal' };
const TEACHER = { first: 'Sarah', last: 'Ahmed' };
const STUDENT = { first: 'Ali', last: 'Hassan', dob: '2012-06-15', handle: 'ali_hassan' };
const ADMIN_FULL = `${ADMIN.prefix} ${ADMIN.first} ${ADMIN.last}`;

// Year 9 Mathematics roster — the demo student plus seven fictional classmates
const CLASSMATES = [
  ['Maya', 'Patel'], ['Adam', 'Khan'], ['Sophia', 'Williams'], ['Daniel', 'Chen'],
  ['Sara', 'Ahmed'], ['James', 'Wilson'], ['Noah', 'Brown'],
];
// Other departments' teachers (fictional, never log in)
const OTHER_TEACHERS = [
  { first: 'Omar', last: 'Farouk', email: `omar.farouk@${D}`, subject: 'Physics' },
  { first: 'Lena', last: 'Vogt', email: `lena.vogt@${D}`, subject: 'Computer Science' },
];
const PHYSICS_STUDENTS = [['Hana', 'Yusuf'], ['Emma', 'Clarke'], ['Karim', 'Saeed'], ['Nadia', 'Kova']];
const CS_STUDENTS = [['Priya', 'Nair'], ['Tom', 'Baker'], ['Idris', 'Bello'], ['Zoe', 'Martin']];

const IMAGES = {
  mathprize: `${IMG}/64c96b7a3_generated_image.png`,
  science: `${IMG}/ddbf4de4e_generated_image.png`,
  leadership: `${IMG}/e09f85459_generated_image.png`,
  volunteering: `${IMG}/29d9fc74e_generated_image.png`,
  sports: `${IMG}/45f6dc10b_generated_image.png`,
};

// ── The demo student's five VERIFIED achievements (real workflow) ──
const ACHIEVEMENTS = [
  {
    key: 'math_award', label: 'Subject Award', category: 'academic', tier: 2, flagship: true,
    title: 'Outstanding Mathematics Achievement',
    date: '2026-09-15', backdate: 10, cover: IMAGES.mathprize,
    description: 'Awarded for exceptional performance and consistent achievement in Year 9 Mathematics, including the highest result in the class for Algebra Test 1.',
  },
  {
    key: 'football', label: 'Sports Tournament', category: 'sports', tier: 1,
    title: 'Inter-School Football Tournament — Champions',
    date: '2026-06-20', backdate: 45, cover: IMAGES.sports,
    description: 'Captain of the Year 9 team that won the inter-school football tournament, scoring the winning goal in the final.',
  },
  {
    key: 'leadership', label: 'Leadership Award', category: 'leadership', tier: 2,
    title: 'Student Leadership Award',
    date: '2026-07-01', backdate: 30, cover: IMAGES.leadership,
    description: 'Awarded for leading the Year 9 student council and mentoring new joiners through the school transition programme.',
  },
  {
    key: 'community', label: 'Volunteering Programme', category: 'community', tier: 1,
    title: 'Community Service — 100 Volunteer Hours',
    date: '2026-08-25', backdate: 20, cover: IMAGES.volunteering,
    description: 'Completed 100 verified volunteer hours with the school community programme, including the weekend reading scheme.',
  },
  {
    key: 'science', label: 'Competition Placing', category: 'academic', tier: 1,
    title: 'Regional Science Competition — Finalist',
    date: '2026-05-18', backdate: 90, cover: IMAGES.science,
    description: 'Reached the regional final of the inter-school science competition with a project on renewable energy storage.',
  },
];

// ── Two IN-FLIGHT requests left deliberately unfinished so the pitch can
// action them live: one waiting for the teacher's sign-off, one already
// teacher-signed and sitting in the admin's approval queue. ──
const PENDING_FOR_TEACHER = {
  label: 'Competition Entry', category: 'academic', tier: 1, backdate: 2,
  title: 'Mathematics Challenge — Round 2 Qualifier',
  description: 'Qualified for Round 2 of the inter-school Mathematics Challenge after placing in the top 5% of the regional round.',
  date: '2026-09-24',
};
const PENDING_FOR_ADMIN = {
  label: 'Sports Day', category: 'sports', tier: 2, backdate: 4,
  title: 'School Sports Day — 100m Champion',
  description: 'Won the Year 9 100m final at school sports day with a time of 12.8 seconds.',
  date: '2026-09-22',
};

// ── Removal manifest ──
const PURGE_BY_SCHOOL = [
  'SchoolCode', 'SchoolInvitation', 'AdminSchoolMembership', 'StaffMembership', 'Enrollment',
  'Class', 'TimetableEntry', 'AttendanceSession', 'AttendanceRecord', 'AttendanceAuditLog',
  'Assessment', 'StudentGrade', 'SeatingPlan', 'Announcement', 'AnnouncementReadReceipt',
  'AuditLog', 'Notification', 'AchievementRequest', 'StudentRecord', 'BlockWard',
  'BlockWardVerificationRegistry', 'DigitalSignature', 'JoinRequest', 'Resource', 'Assignment',
  'Submission', 'Topic', 'StreamComment', 'PointEntry', 'PointCategory', 'Event', 'YearGroup',
  'EndorsementTerm', 'EndorsementInvite', 'StudentOrgMembership', 'EmailDeliveryLog',
];
const PURGE_BY_EMAIL = [
  ['AchievementRequest', 'student_email'],
  ['StudentRecord', 'owner_student_email'],
  ['BlockWard', 'owner_student_email'],
  ['BlockWardVerificationRegistry', 'student_email'],
  ['Notification', 'user_email'],
  ['SelfReportedAchievement', 'student_email'],
  ['StudentOrgMembership', 'student_email'],
];

// ── The real organisation-verified flow: student submits → nominated teacher
// signs → (tier 2: admin approves) → mint → archived ──
async function ensureOrgCredential(svc, spec, actors, student, school) {
  let req = await findRequest(svc, student.email, spec.title);
  if (!req) {
    const res = await submitRequest(svc, actors.student, {
      action: 'submit',
      form: {
        school_id: school.id,
        custom_credential_label: spec.label,
        category: spec.category,
        verification_tier: spec.tier,
        title: spec.title,
        description: spec.description,
        image_url: spec.cover,
        date_achieved: spec.date,
        evidence: [
          { type: 'file', url: spec.cover, name: `${spec.key}.png` },
          { type: 'link', url: 'https://results.blockward-demo.example', name: 'Official record' },
        ],
        nominated_verifier_email: actors.teacher.actor_email,
        is_team: false,
      },
    }, { ip: null, country: 'AE' });
    if (res.status !== 200 || !res.payload.ok) fail(`submit ${spec.key} failed: ${JSON.stringify(res.payload)}`);
    req = res.payload.request;
    if (spec.backdate) await svc.entities.AchievementRequest.update(req.id, { submitted_at: ago(spec.backdate) });
  }

  for (let guard = 0; guard < 6; guard++) {
    if (req.status === 'archived' || req.status === 'awaiting_second_approval' && spec.stop_at_admin_queue) break;
    if (['submitted', 'under_review'].includes(req.status)) {
      const r = await runReviewerAction(svc, actors.teacher, {
        action: 'sign', request_id: req.id,
        method: 'witnessed_in_person', attestation: true, signature: `${TEACHER.first} ${TEACHER.last}`,
      }, { country: 'AE' });
      if (r.status !== 200 || !r.payload.ok) fail(`sign ${spec.key} failed: ${JSON.stringify(r.payload)}`);
    } else if (req.status === 'awaiting_second_approval') {
      const r = await runReviewerAction(svc, actors.admin, {
        action: 'admin_approve', request_id: req.id,
        method: 'official_records', attestation: true, signature: ADMIN_FULL,
      }, { country: 'AE' });
      if (r.status !== 200 || !r.payload.ok) fail(`admin_approve ${spec.key} failed: ${JSON.stringify(r.payload)}`);
    } else if (req.status === 'approved') {
      const r = await runReviewerAction(svc, actors.admin, { action: 'mint', request_id: req.id }, { country: 'AE' });
      if (r.status !== 200 || !r.payload.ok) fail(`mint ${spec.key} failed: ${JSON.stringify(r.payload)}`);
    } else {
      break;
    }
    req = (await svc.entities.AchievementRequest.filter({ id: req.id }))[0];
  }
  if (!['archived', 'awaiting_second_approval', 'submitted'].includes(req.status)) {
    fail(`request ${spec.key} ended in unexpected status ${req.status}`);
  }
  const registry = req.verification_id
    ? (await svc.entities.BlockWardVerificationRegistry.filter({ verification_id: req.verification_id }))[0] || null
    : null;
  return { request: req, registry };
}

export default async function (req) {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

    const base44 = createClientFromRequest(req);
    const auth = await authorizeDemo(base44);
    if (!auth.ok) return Response.json({ error: auth.reason }, { status: auth.status });
    const callerEmail = norm(auth.email);

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'status';
    const svc = base44.asServiceRole;

    const emails = {
      admin: norm(body.emails?.admin || DEFAULT_EMAILS.admin),
      teacher: norm(body.emails?.teacher || DEFAULT_EMAILS.teacher),
      student: norm(body.emails?.student || DEFAULT_EMAILS.student),
    };

    // ══════════════════════════ status ══════════════════════════
    if (action === 'status') {
      const run = (await svc.entities.DemoSeedRun.filter({ status: 'active' })).find((r) => r.kind === 'pitch_world') || null;
      if (!run) return Response.json({ ok: true, active: false });
      const school = (await svc.entities.School.filter({ id: run.school_id }))[0] || null;
      return Response.json({
        ok: true, active: true,
        run: { label: run.run_label, school: school ? school.name : null },
        manifest: { accounts: (run.student_emails || []).length, teachers: run.teacher_emails },
      });
    }

    // ══════════════════════════ remove ══════════════════════════
    if (action === 'remove') {
      const runs = (await svc.entities.DemoSeedRun.filter({ status: 'active' })).filter((r) => r.kind === 'pitch_world');
      if (runs.length === 0) return Response.json({ error: 'No active pitch demo world found' }, { status: 404 });
      const deleted = {};
      for (const run of runs) {
        const protectedEmails = new Set([callerEmail, (run.created_by_email || '').toLowerCase()]);
        const emailsAll = (run.student_emails || []).map((e) => e.toLowerCase()).filter((e) => !protectedEmails.has(e));

        for (const schoolId of run.school_ids || [run.school_id]) {
          for (const name of PURGE_BY_SCHOOL) {
            try {
              const items = await svc.entities[name].filter({ school_id: schoolId });
              if (items.length > 0) await svc.entities[name].deleteMany({ school_id: schoolId });
              deleted[name] = (deleted[name] || 0) + items.length;
            } catch (e) { deleted[name] = deleted[name] === undefined ? -1 : deleted[name]; }
          }
          try { await svc.entities.School.delete(schoolId); deleted.School = (deleted.School || 0) + 1; } catch (e) { /* next */ }
        }
        for (const [name, field] of PURGE_BY_EMAIL) {
          for (const email of emailsAll) {
            try {
              const items = await svc.entities[name].filter({ [field]: email });
              if (items.length > 0) await svc.entities[name].deleteMany({ [field]: email });
              deleted[name] = (deleted[name] || 0) + items.length;
            } catch (e) { /* best-effort */ }
          }
        }
        let profiles = 0;
        const seen = new Set();
        for (const email of emailsAll) {
          const p = await profileByEmail(svc, email);
          if (p && !seen.has(p.id)) { seen.add(p.id); await svc.entities.UserProfile.delete(p.id); profiles++; }
        }
        deleted.UserProfile = (deleted.UserProfile || 0) + profiles;
        await svc.entities.DemoSeedRun.update(run.id, { status: 'removed', removed_at: new Date().toISOString() });
      }
      return Response.json({ ok: true, deleted });
    }

    if (action !== 'seed') return Response.json({ error: 'Unknown action. Use seed | remove | status.' }, { status: 400 });

    // ══════════════════════════ seed ══════════════════════════
    let run = (await svc.entities.DemoSeedRun.filter({ status: 'active' })).find((r) => r.kind === 'pitch_world') || null;
    if (run && (run.student_emails || []).includes(emails.admin) === false && (run.student_emails || []).length > 3) {
      return Response.json({ error: 'A pitch world exists with different account emails. Run { "action": "remove" } first.' }, { status: 409 });
    }

    // ── 1. The school through the REAL setupSchool path ──
    let school = (await svc.entities.School.filter({ name: SCHOOL_NAME }))[0] || null;
    let schoolCodes;
    if (!school) {
      const created = await createSchoolForAdmin(svc, {
        user: { email: emails.admin, full_name: ADMIN_FULL },
        profile: null,
        name: SCHOOL_NAME,
        school_type: 'secondary_school',
        country: 'United Arab Emirates',
        city: 'Dubai',
        website: 'https://blockward.example',
        contact_email: emails.admin,
        admin_full_name: ADMIN_FULL,
        admin_job_title: ADMIN.title,
      });
      school = created.school;
      schoolCodes = created.codes;
    } else {
      const codes = await svc.entities.SchoolCode.filter({ school_id: school.id });
      schoolCodes = {
        teacher: (codes.find((c) => c.role_type === 'teacher') || {}).code,
        student: (codes.find((c) => c.role_type === 'student') || {}).code,
      };
    }
    if (!schoolCodes?.teacher || !schoolCodes?.student) fail('school join codes missing');

    // A demo school on the BlockWard platform itself is verified by BlockWard
    // (mirrors what verification staff set), so credentials are not paused.
    if (school.verification_status !== 'verified') {
      await retryRateLimit(() => svc.entities.School.update(school.id, {
        verification_status: 'verified',
        settings: { ...(school.settings || {}), academic_year: '2026/27' },
      }), 'verify school');
    }

    // ── 2. Year groups ──
    const yearNames = ['Year 9', 'Year 10', 'Year 11'];
    const yearGroups = {};
    for (const yn of yearNames) {
      let yg = (await svc.entities.YearGroup.filter({ school_id: school.id, name: yn }))[0] || null;
      if (!yg) yg = await svc.entities.YearGroup.create({ school_id: school.id, name: yn, status: 'active' });
      yearGroups[yn] = yg;
    }

    // ── 3. The removal manifest FIRST — even a partial seed is always removable ──
    const demoDomainEmails = [
      ...OTHER_TEACHERS.map((t) => t.email),
      ...CLASSMATES.map(([f, l]) => `${f}.${l}@${D}`.toLowerCase()),
      ...PHYSICS_STUDENTS.map(([f, l]) => `${f}.${l}@${D}`.toLowerCase()),
      ...CS_STUDENTS.map(([f, l]) => `${f}.${l}@${D}`.toLowerCase()),
    ];
    const allSeededEmails = [emails.admin, emails.teacher, emails.student, ...demoDomainEmails];
    if (!run) {
      run = await svc.entities.DemoSeedRun.create({
        run_label: 'pitch-' + Date.now(),
        kind: 'pitch_world',
        school_id: school.id,
        school_ids: [school.id],
        school_name: SCHOOL_NAME,
        created_by_email: callerEmail,
        status: 'active',
        teacher_emails: [emails.teacher, ...OTHER_TEACHERS.map((t) => t.email)],
        student_emails: allSeededEmails,
      });
    }

    // ── 4. Staff: the real join-code → approval-engine path ──
    const ensureTeacher = async (spec) => {
      const r = await retryRateLimit(() => provisionProfile(svc, { email: spec.email, full_name: `${spec.first} ${spec.last}` }, {
        first_name: spec.first, last_name: spec.last, join_code: schoolCodes.teacher,
      }), `provision teacher ${spec.email}`);
      let profile = r.profile;
      if (profile.user_type !== 'teacher' || profile.school_id !== school.id || profile.status !== 'active') {
        const mem = (await svc.entities.StaffMembership.filter({ school_id: school.id, user_email: spec.email }))[0];
        if (!mem) fail(`teacher ${spec.email} has no StaffMembership`);
        if (mem.status !== 'active') {
          const rr = await reviewStaffMembership(svc, {
            membership_id: mem.id, action: 'approve',
            approver: { email: emails.admin, name: ADMIN_FULL },
          });
          if (!rr.ok) fail(`teacher approval failed for ${spec.email}: ${rr.error || JSON.stringify(rr)}`);
        }
        profile = await profileByEmail(svc, spec.email);
      }
      return profile;
    };
    const sarahProfile = await ensureTeacher({ first: TEACHER.first, last: TEACHER.last, email: emails.teacher });
    for (const t of OTHER_TEACHERS) await ensureTeacher(t);

    // ── 5. Students: demo student + classmates, then other classes ──
    const ensureStudent = async (spec) => {
      const r = await retryRateLimit(() => provisionProfile(svc, { email: spec.email, full_name: `${spec.first} ${spec.last}` }, {
        first_name: spec.first, last_name: spec.last, join_code: schoolCodes.student,
        date_of_birth: spec.dob,
      }), `provision student ${spec.email}`);
      return r.profile;
    };
    let aliProfile = await ensureStudent({ first: STUDENT.first, last: STUDENT.last, email: emails.student, dob: STUDENT.dob });

    // Demo student polish — validated presets (handle availability via the real module)
    const handleCheck = await isHandleAvailable(svc, STUDENT.handle, aliProfile.id);
    if (!handleCheck.available) fail(`handle @${STUDENT.handle} unavailable: ${handleCheck.reason}`);
    await retryRateLimit(() => svc.entities.UserProfile.update(aliProfile.id, {
      handle: STUDENT.handle,
      handle_changed_at: new Date().toISOString(),
      grade_level: 'Year 9',
      student_id: 'BDS-2712',
      bio: 'Year 9 student at BlockWard Demo School. Loves mathematics, football and building things.',
      tagline: 'Year 9 · Mathematics · Football',
      theme_id: 'midnight',
      accent_colour: '#7c3aed',
      profile_layout: 'grid',
      profile_visibility: 'public',
      public_grades: true,
      parent_name: 'Imran Hassan',
      parent_email: `parent.ali@${D}`,
      parent_phone: '+971 50 123 4567',
      parent_relationship: 'father',
    }), 'student polish');
    aliProfile = await profileByEmail(svc, emails.student);

    const classmateSpecs = CLASSMATES.map(([f, l], i) => ({
      email: `${f}.${l}@${D}`.toLowerCase(), first: f, last: l,
      dob: `2012-${String((i % 9) + 1).padStart(2, '0')}-${String((i % 27) + 1).padStart(2, '0')}`,
    }));
    const classmates = [];
    for (const spec of classmateSpecs) {
      classmates.push({ email: spec.email, name: `${spec.first} ${spec.last}`, profile: await ensureStudent(spec) });
      await sleep(150);
    }
    const mathStudents = [
      { email: emails.student, name: `${STUDENT.first} ${STUDENT.last}`, profile: aliProfile },
      ...classmates,
    ];

    const otherStudents = [];
    for (const [f, l] of [...PHYSICS_STUDENTS, ...CS_STUDENTS]) {
      const spec = { email: `${f}.${l}@${D}`.toLowerCase(), first: f, last: l, dob: '2011-03-12' };
      otherStudents.push({ email: spec.email, name: `${f} ${l}`, profile: await ensureStudent(spec) });
      await sleep(150);
    }

    // ── 6. Classes + enrollments ──
    const ensureClass = async (spec, students) => {
      let cls = (await svc.entities.Class.filter({ school_id: school.id, name: spec.name }))[0] || null;
      if (!cls) {
        cls = await svc.entities.Class.create({
          school_id: school.id,
          name: spec.name,
          subject: spec.subject,
          description: spec.description,
          teacher_email: spec.teacher_email,
          student_emails: students.map((s) => s.email),
          grade_level: spec.grade_level,
          room: spec.room,
          join_code: spec.join_code,
          color: spec.color,
          status: 'active',
        });
        await svc.entities.Enrollment.bulkCreate(students.map((s) => ({
          school_id: school.id, class_id: cls.id, class_name: cls.name,
          student_email: s.email, student_name: s.name, status: 'active',
        })));
        if (students.length) await svc.entities.UserProfile.bulkUpdate(students.map((s) => ({ id: s.profile.id, class_ids: [cls.id] })));
      }
      return cls;
    };

    const mathClass = await ensureClass({
      name: 'Year 9 Mathematics', subject: 'Mathematics', teacher_email: emails.teacher,
      grade_level: 'Year 9', room: 'Room 12', join_code: 'BW9MATH', color: '#7c3aed',
      description: 'Algebra, geometry and statistics — the main demonstration class for BlockWard Demo School.',
    }, mathStudents);
    // Teacher class_ids mirrors (StaffMembership + profile) — kept in sync by the real join flow
    const sarahMem = (await svc.entities.StaffMembership.filter({ school_id: school.id, user_email: emails.teacher }))[0];
    if (sarahMem && (sarahMem.class_ids || []).length === 0) {
      await svc.entities.StaffMembership.update(sarahMem.id, { class_ids: [mathClass.id] });
    }
    if ((aliProfile.class_ids || []).join(',') !== [mathClass.id].join(',')) {
      await svc.entities.UserProfile.update(aliProfile.id, { class_ids: [mathClass.id] });
    }

    const physicsClass = await ensureClass({
      name: 'Year 10 Physics', subject: 'Physics', teacher_email: OTHER_TEACHERS[0].email,
      grade_level: 'Year 10', room: 'Lab 2', join_code: 'BW10PHY', color: '#0ea5e9',
      description: 'Forces, energy and waves.',
    }, otherStudents.slice(0, PHYSICS_STUDENTS.length));
    const csClass = await ensureClass({
      name: 'Year 11 Computer Science', subject: 'Computer Science', teacher_email: OTHER_TEACHERS[1].email,
      grade_level: 'Year 11', room: 'IT Suite', join_code: 'BW11CS', color: '#10b981',
      description: 'Algorithms, data structures and programming.',
    }, otherStudents.slice(PHYSICS_STUDENTS.length));

    // ── 7. Timetable ──
    const ensureTimetable = async (cls, teacherEmail, slots, room, subject) => {
      if ((await svc.entities.TimetableEntry.filter({ class_id: cls.id })).length > 0) return;
      await svc.entities.TimetableEntry.bulkCreate(slots.map((s, i) => ({
        school_id: school.id, class_id: cls.id, class_name: cls.name,
        teacher_email: teacherEmail, day_of_week: s.day,
        start_time: s.start, end_time: s.end, room, subject, period_number: i + 1,
      })));
    };
    await ensureTimetable(mathClass, emails.teacher, [
      { day: 0, start: '09:00', end: '10:00' }, { day: 2, start: '09:00', end: '10:00' }, { day: 4, start: '10:00', end: '11:00' },
    ], 'Room 12', 'Mathematics');
    await ensureTimetable(physicsClass, OTHER_TEACHERS[0].email, [
      { day: 1, start: '11:00', end: '12:00' }, { day: 3, start: '11:00', end: '12:00' },
    ], 'Lab 2', 'Physics');
    await ensureTimetable(csClass, OTHER_TEACHERS[1].email, [
      { day: 0, start: '13:00', end: '14:00' }, { day: 2, start: '13:00', end: '14:00' },
    ], 'IT Suite', 'Computer Science');

    // ── 8. Attendance history for the register widgets ──
    const schoolDays = (count) => {
      const dates = [];
      const cursor = new Date();
      while (dates.length < count) {
        cursor.setDate(cursor.getDate() - 1);
        const dow = cursor.getDay();
        if (dow !== 0 && dow !== 6) dates.push(cursor.toISOString().slice(0, 10));
      }
      return dates;
    };
    // Year 9 Mathematics: 8 sessions. Late marks: Adam day 3, Maya day 7; absent: Daniel day 5.
    const mathMarks = (i, d) => (i === 2 && d === 3) || (i === 1 && d === 7) ? 'late' : (i === 4 && d === 5) ? 'absent' : 'present';
    const mathDates = schoolDays(8);
    for (let d = 0; d < mathDates.length; d++) {
      const date = mathDates[d];
      await retryRateLimit(async () => {
        const existing = await svc.entities.AttendanceSession.filter({ class_id: mathClass.id, date });
        let session = existing[0];
        if (!session) {
          const counts = { present: 0, absent: 0, late: 0 };
          mathStudents.forEach((s, i) => { counts[mathMarks(i, d)]++; });
          session = await svc.entities.AttendanceSession.create({
            school_id: school.id, class_id: mathClass.id, class_name: mathClass.name,
            teacher_email: emails.teacher, date,
            session_start_time: '09:00', session_end_time: '10:00',
            created_by_email: emails.teacher,
            created_at: new Date(date + 'T09:00:00Z').toISOString(),
            marks_count: mathStudents.length, excused_count: 0,
            present_count: counts.present, absent_count: counts.absent, late_count: counts.late,
          });
        }
        const records = await svc.entities.AttendanceRecord.filter({ attendance_session_id: session.id });
        if (records.length === 0) {
          await svc.entities.AttendanceRecord.bulkCreate(mathStudents.map((s, i) => ({
            school_id: school.id, class_id: mathClass.id, class_name: mathClass.name,
            student_email: s.email, student_name: s.name, date,
            status: mathMarks(i, d),
            marked_by_email: emails.teacher, marked_by_name: `${TEACHER.first} ${TEACHER.last}`,
            marked_at: new Date(date + 'T09:05:00Z').toISOString(),
            attendance_session_id: session.id,
          })));
        }
      }, `attendance ${date}`);
      await sleep(120);
    }
    // Year 10 Physics: 3 sessions, everyone present except one late.
    const physicsStudents = otherStudents.slice(0, PHYSICS_STUDENTS.length);
    for (const date of schoolDays(3)) {
      await retryRateLimit(async () => {
        const existing = await svc.entities.AttendanceSession.filter({ class_id: physicsClass.id, date });
        let session = existing[0];
        if (!session) {
          session = await svc.entities.AttendanceSession.create({
            school_id: school.id, class_id: physicsClass.id, class_name: physicsClass.name,
            teacher_email: OTHER_TEACHERS[0].email, date,
            session_start_time: '11:00', session_end_time: '12:00',
            created_by_email: OTHER_TEACHERS[0].email,
            created_at: new Date(date + 'T11:00:00Z').toISOString(),
            marks_count: physicsStudents.length, excused_count: 0,
            present_count: physicsStudents.length - 1, absent_count: 0, late_count: 1,
          });
        }
        const records = await svc.entities.AttendanceRecord.filter({ attendance_session_id: session.id });
        if (records.length === 0) {
          await svc.entities.AttendanceRecord.bulkCreate(physicsStudents.map((s, i) => ({
            school_id: school.id, class_id: physicsClass.id, class_name: physicsClass.name,
            student_email: s.email, student_name: s.name, date,
            status: i === 0 && date === schoolDays(3)[1] ? 'late' : 'present',
            marked_by_email: OTHER_TEACHERS[0].email, marked_by_name: `${OTHER_TEACHERS[0].first} ${OTHER_TEACHERS[0].last}`,
            marked_at: new Date(date + 'T11:05:00Z').toISOString(),
            attendance_session_id: session.id,
          })));
        }
      }, `physics attendance ${date}`);
      await sleep(120);
    }

    // ── 9. Gradebook: Algebra Test 1 (Ali 43/50 = 86%) + Geometry Quiz 1 ──
    const SCORES_A = [43, 45, 38, 41, 29, 44, 31, 35]; // Ali, Maya, Adam, Sophia, Daniel, Sara, James, Noah
    const SCORES_G = [26, 27, 21, 24, 17, 25, 19, 22];
    const gradeSpecs = [
      { title: 'Algebra Test 1', type: 'test', max: 50, days: 6, weight: 40, scores: SCORES_A },
      { title: 'Geometry Quiz 1', type: 'quiz', max: 30, days: 12, weight: 20, scores: SCORES_G },
    ];
    for (const spec of gradeSpecs) {
      await retryRateLimit(async () => {
        let assessment = (await svc.entities.Assessment.filter({ class_id: mathClass.id, title: spec.title }))[0] || null;
        if (!assessment) {
          assessment = await svc.entities.Assessment.create({
            school_id: school.id, class_id: mathClass.id, class_name: mathClass.name,
            subject: 'Mathematics',
            teacher_email: emails.teacher, teacher_id: sarahProfile.id, teacher_name: `${TEACHER.first} ${TEACHER.last}`,
            title: spec.title, assessment_type: spec.type,
            description: spec.title === 'Algebra Test 1'
              ? 'Covers linear equations, expanding brackets, factorising and an introduction to quadratic expressions.'
              : 'Angles, congruence and basic circle theorems.',
            date: day(spec.days), max_score: spec.max, weighting: spec.weight,
            status: 'published', published_at: ago(spec.days - 1), published_by: emails.teacher,
          });
        }
        const existingGrades = await svc.entities.StudentGrade.filter({ assessment_id: assessment.id });
        if (existingGrades.length === 0) {
          await svc.entities.StudentGrade.bulkCreate(mathStudents.map((s, i) => {
            const pct = Math.round((spec.scores[i] / spec.max) * 100);
            return {
              school_id: school.id, student_email: s.email, student_id: s.profile.id, student_name: s.name,
              assessment_id: assessment.id, assessment_title: spec.title, assessment_type: spec.type,
              assessment_date: day(spec.days), class_id: mathClass.id, class_name: mathClass.name, subject: 'Mathematics',
              teacher_email: emails.teacher, teacher_id: sarahProfile.id, teacher_name: `${TEACHER.first} ${TEACHER.last}`,
              raw_score: spec.scores[i], max_score: spec.max, percentage: pct, grade_value: gradeFor(pct),
              teacher_comment: spec.title === 'Algebra Test 1' && i === 0
                ? 'Outstanding grasp of quadratics — best in the set.'
                : spec.title === 'Algebra Test 1' && i === 1
                  ? 'Excellent control of algebraic manipulation.'
                  : null,
              status: 'published', published_at: ago(spec.days - 2), published_by: emails.teacher,
            };
          }));
        }
      }, `gradebook ${spec.title}`);
      await sleep(150);
    }

    // ── 10. The assignment: a classwork post (Assignments page + turn-in) and a
    // matching Assessment record (homework tracker + AI), due in the future ──
    const dueIn = (days) => new Date(Date.now() + days * 86400000).toISOString();
    await retryRateLimit(async () => {
      const existing = await svc.entities.Assignment.filter({ class_id: mathClass.id, title: 'Algebra Homework — Quadratic Equations' });
      if (existing.length > 0) return;
      const post = await svc.entities.Assignment.create({
        school_id: school.id, class_id: mathClass.id, class_name: mathClass.name,
        teacher_email: emails.teacher, teacher_emails: [emails.teacher],
        type: 'assignment', title: 'Algebra Homework — Quadratic Equations',
        instructions: '<p>Solve the eight quadratic equations on the worksheet (Questions 1–8). Use factorising first; where an equation will not factorise, apply the quadratic formula. Show all working — marks are given for method, not just answers.</p><p>Due Thursday. Late work closes at the due date.</p>',
        points_possible: 20,
        due_at: dueIn(3), status: 'published', published_at: ago(1),
        assigned_to: 'all', visible_to: mathStudents.map((s) => s.email),
      });
      await svc.entities.Submission.bulkCreate(mathStudents.map((s, i) => ({
        school_id: school.id, assignment_id: post.id, assignment_title: post.title,
        class_id: mathClass.id, class_name: mathClass.name,
        teacher_emails: [emails.teacher],
        student_email: s.email, student_name: s.name,
        status: (i === 1 || i === 2) ? 'submitted' : 'assigned', // Maya + Adam already turned in
        submitted_at: (i === 1 || i === 2) ? ago(1) : null,
      })));
      // Matching entry in the assessment/homework tracker (powers the AI homework tool)
      await svc.entities.Assessment.create({
        school_id: school.id, class_id: mathClass.id, class_name: mathClass.name,
        subject: 'Mathematics',
        teacher_email: emails.teacher, teacher_id: sarahProfile.id, teacher_name: `${TEACHER.first} ${TEACHER.last}`,
        title: 'Algebra Homework — Quadratic Equations', assessment_type: 'homework',
        description: 'Solve Questions 1–8 on quadratic equations: factorising and the quadratic formula, showing full working.',
        date: day(1), due_date: inDaysDate(3), max_score: 20, weighting: 10,
        status: 'published', published_at: ago(1), published_by: emails.teacher,
      });
    }, 'assignment');

    // ── 11. Events: the assembly + a parents' evening ──
    const assemblyStart = new Date(Date.now() + 2 * 86400000);
    assemblyStart.setHours(9, 30, 0, 0);
    const assemblyEnd = new Date(assemblyStart.getTime() + 45 * 60000);
    await retryRateLimit(async () => {
      const existing = await svc.entities.Event.filter({ school_id: school.id, title: 'Academic Progress Assembly' });
      if (existing.length > 0) return;
      await svc.entities.Event.create({
        school_id: school.id, title: 'Academic Progress Assembly',
        description: 'Celebrating academic progress across the term — top performers recognised and next-step targets set for Year 9.',
        event_type: 'assembly',
        start_time: assemblyStart.toISOString(), end_time: assemblyEnd.toISOString(),
        location: 'Main Hall', organiser: ADMIN_FULL,
        audience: 'year_group', year_group_ids: [yearGroups['Year 9'].id], year_group_names: ['Year 9'],
        status: 'scheduled', created_by: emails.admin,
      });
    }, 'assembly');
    const peStart = new Date(Date.now() + 9 * 86400000);
    peStart.setHours(16, 0, 0, 0);
    const peEnd = new Date(peStart.getTime() + 3 * 3600000);
    await retryRateLimit(async () => {
      const existing = await svc.entities.Event.filter({ school_id: school.id, title: 'Year 9 Parents\' Evening' });
      if (existing.length > 0) return;
      await svc.entities.Event.create({
        school_id: school.id, title: 'Year 9 Parents\' Evening',
        description: 'Five-minute appointments with class teachers. Bookings via the school office.',
        event_type: 'event',
        start_time: peStart.toISOString(), end_time: peEnd.toISOString(),
        location: 'Main Hall', organiser: ADMIN_FULL,
        audience: 'year_group', year_group_ids: [yearGroups['Year 9'].id], year_group_names: ['Year 9'],
        status: 'scheduled', created_by: emails.admin,
      });
    }, 'parents evening');

    // ── 12. Announcements: school welcome + class assembly reminder ──
    await retryRateLimit(async () => {
      const existing = await svc.entities.Announcement.filter({ school_id: school.id, title: 'Welcome to the 2026/27 Academic Year' });
      if (existing.length > 0) return;
      await svc.entities.Announcement.create({
        school_id: school.id, title: 'Welcome to the 2026/27 Academic Year',
        body: 'A warm welcome back to all students and staff. This term our focus is consistent academic progress — effort grades go home at half term, and the first celebration assembly is in two weeks. Let\'s make it a great year.',
        body_short: 'A warm welcome back — this term\'s focus is consistent academic progress.',
        priority: 'normal', scope_type: 'SCHOOL',
        status: 'sent', sent_at: ago(10), created_by: emails.admin,
      });
    }, 'announcement school');
    await retryRateLimit(async () => {
      const existing = await svc.entities.Announcement.filter({ school_id: school.id, title: 'Reminder: Academic Progress Assembly — Thursday, Main Hall' });
      if (existing.length > 0) return;
      await svc.entities.Announcement.create({
        school_id: school.id, title: 'Reminder: Academic Progress Assembly — Thursday, Main Hall',
        body: 'Our Academic Progress Assembly is on Thursday morning in the Main Hall. Homework marks and effort awards will be recognised — make sure your Algebra Homework is submitted before the deadline.',
        body_short: 'Assembly Thursday morning — homework awards will be recognised.',
        priority: 'important', scope_type: 'CLASS',
        class_id: mathClass.id, class_name: mathClass.name,
        status: 'sent', sent_at: ago(1), created_by: emails.teacher,
      });
    }, 'announcement class');

    // ── 13. Points: two categories + entries; profile totals kept in sync ──
    const categories = [
      { name: 'Merit', type: 'achievement', default_points: 5, color: '#7c3aed', icon: 'star', description: 'Consistently excellent work' },
      { name: 'Class Contribution', type: 'achievement', default_points: 3, color: '#0ea5e9', icon: 'message-circle', description: 'Positive contribution in lessons' },
    ];
    const catIds = {};
    for (const c of categories) {
      let cat = (await svc.entities.PointCategory.filter({ school_id: school.id, name: c.name }))[0] || null;
      if (!cat) cat = await svc.entities.PointCategory.create({ school_id: school.id, ...c });
      catIds[c.name] = cat;
    }
    const pointSpecs = [
      { i: 0, cat: 'Merit', points: 5, reason: 'Consistently excellent homework all term', d: 12 },
      { i: 0, cat: 'Class Contribution', points: 3, reason: 'Great explanation of quadratic factorising to the class', d: 8 },
      { i: 0, cat: 'Merit', points: 5, reason: 'Top result in Year 9 — Algebra Test 1', d: 5 },
      { i: 1, cat: 'Merit', points: 5, reason: 'Excellent start-of-term effort', d: 12 },
      { i: 1, cat: 'Class Contribution', points: 3, reason: 'Helping classmates with revision', d: 7 },
      { i: 2, cat: 'Class Contribution', points: 3, reason: 'Always ready to answer', d: 9 },
      { i: 3, cat: 'Merit', points: 5, reason: 'Superb problem-solving work', d: 6 },
      { i: 5, cat: 'Class Contribution', points: 3, reason: 'Consistent positive attitude', d: 10 },
      { i: 6, cat: 'Class Contribution', points: 3, reason: 'Improved participation', d: 8 },
      { i: 7, cat: 'Class Contribution', points: 3, reason: 'Helpful in group work', d: 11 },
    ];
    for (const p of pointSpecs) {
      await retryRateLimit(async () => {
        const s = mathStudents[p.i];
        const existing = await svc.entities.PointEntry.filter({
          school_id: school.id, student_email: s.email, reason: p.reason,
        });
        if (existing.length > 0) return;
        await svc.entities.PointEntry.create({
          school_id: school.id, student_email: s.email, student_name: s.name,
          teacher_email: emails.teacher, teacher_name: `${TEACHER.first} ${TEACHER.last}`,
          class_id: mathClass.id, class_name: mathClass.name,
          category_id: catIds[p.cat].id, category_name: p.cat,
          type: 'achievement', points: p.points, reason: p.reason,
          timestamp: ago(p.d),
        });
      }, `points ${p.i}`);
      await sleep(100);
    }
    // Keep profile totals in sync with the entries (the real issuePoints path does this)
    const totals = {};
    for (const p of pointSpecs) totals[mathStudents[p.i].email] = (totals[mathStudents[p.i].email] || 0) + p.points;
    for (const [email, total] of Object.entries(totals)) {
      const prof = await profileByEmail(svc, email);
      if (prof && prof.total_achievement_points !== total) {
        await svc.entities.UserProfile.update(prof.id, { total_achievement_points: total });
      }
    }

    // ── 14. Achievements through the REAL workflow ──
    const actors = {
      student: {
        authorized: true, actor_id: aliProfile.id, actor_email: emails.student, actor_role: 'student',
        school_id: school.id, first_name: STUDENT.first, last_name: STUDENT.last,
      },
      teacher: {
        authorized: true, actor_id: sarahProfile.id, actor_email: emails.teacher, actor_role: 'teacher',
        school_id: school.id, first_name: TEACHER.first, last_name: TEACHER.last,
      },
      admin: (() => {
        const p = null;
        return { get: null, placeholder: p };
      })(),
    };
    const adminProfile = await profileByEmail(svc, emails.admin);
    actors.admin = {
      authorized: true, actor_id: adminProfile?.id, actor_email: emails.admin, actor_role: 'admin',
      school_id: school.id, first_name: ADMIN.first, last_name: ADMIN.last,
    };

    const registries = {};
    for (const spec of ACHIEVEMENTS) {
      const result = await retryRateLimit(() => ensureOrgCredential(svc, spec, actors, { email: emails.student }, school), `credential ${spec.key}`);
      registries[spec.key] = result.registry;
      if (result.request.status !== 'archived') fail(`credential ${spec.key} did not reach archived (${result.request.status})`);
      await sleep(300);
    }

    // Pending states for the LIVE pitch moments
    const pendingTeacherReq = await findRequest(svc, emails.student, PENDING_FOR_TEACHER.title);
    if (!pendingTeacherReq) {
      const res = await submitRequest(svc, actors.student, {
        action: 'submit',
        form: {
          school_id: school.id,
          custom_credential_label: PENDING_FOR_TEACHER.label,
          category: PENDING_FOR_TEACHER.category,
          verification_tier: PENDING_FOR_TEACHER.tier,
          title: PENDING_FOR_TEACHER.title,
          description: PENDING_FOR_TEACHER.description,
          image_url: IMAGES.mathprize,
          date_achieved: PENDING_FOR_TEACHER.date,
          evidence: [{ type: 'link', url: 'https://results.blockward-demo.example', name: 'Leaderboard' }],
          nominated_verifier_email: emails.teacher,
          is_team: false,
        },
      }, { ip: null, country: 'AE' });
      if (res.status !== 200 || !res.payload.ok) fail(`submit pending-teacher failed: ${JSON.stringify(res.payload)}`);
      await svc.entities.AchievementRequest.update(res.payload.request.id, { submitted_at: ago(PENDING_FOR_TEACHER.backdate) });
    }
    const pendingAdminResult = await retryRateLimit(() => ensureOrgCredential(svc, {
      ...PENDING_FOR_ADMIN, cover: IMAGES.sports, key: 'sports_day', stop_at_admin_queue: true,
    }, actors, { email: emails.student }, school), 'pending admin credential');

    // ── 15. Pin highlights on the demo student's public profile ──
    const pins = [registries.math_award?.id, registries.football?.id, registries.leadership?.id].filter(Boolean);
    if (pins.length === 3) {
      const fresh = await profileByEmail(svc, emails.student);
      if ((fresh.pinned_achievement_ids || []).length === 0) {
        await svc.entities.UserProfile.update(fresh.id, { pinned_achievement_ids: pins });
      }
    }

    // ── 16. The real on-chain anchor for the flagship credential ──
    let chain = { ok: false, reason: 'no registry record' };
    if (registries.math_award) {
      try {
        chain = await anchorCredential(svc, registries.math_award.id);
      } catch (e) {
        chain = { ok: false, reason: e?.message || String(e) };
      }
    }

    // ── 17. Invitation links for the three pitch accounts (no email sent —
    // the owner opens these directly; People page can resend later) ──
    const inviteUrls = {};
    for (const [role, email] of [['admin', emails.admin], ['teacher', emails.teacher], ['student', emails.student]]) {
      const existing = await svc.entities.SchoolInvitation.filter({ school_id: school.id, invited_email: email, role, status: 'pending' });
      let invitation = existing[0];
      if (!invitation) {
        invitation = await svc.entities.SchoolInvitation.create({
          school_id: school.id, school_name: SCHOOL_NAME,
          invited_email: email, role,
          invited_by: callerEmail, invited_by_name: ADMIN_FULL,
          status: 'pending', token: makeToken(),
          invited_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 14 * 86400000).toISOString(),
          email_status: 'pending',
        });
      }
      inviteUrls[role] = `${appUrl()}/invite/${invitation.token}`;
    }

    // ── 18. Caller browsing access (member, not owner) ──
    const callerProfile = await profileByEmail(svc, callerEmail);
    const callerMembership = await svc.entities.AdminSchoolMembership.filter({ admin_email: callerEmail, school_id: school.id });
    if (callerMembership.length === 0) {
      await svc.entities.AdminSchoolMembership.create({
        admin_user_id: callerProfile ? callerProfile.id : callerEmail,
        admin_email: callerEmail,
        admin_name: callerProfile ? `${callerProfile.first_name} ${callerProfile.last_name}`.trim() : callerEmail,
        school_id: school.id, school_name: school.name,
        role: 'admin', status: 'active', is_primary: false,
        joined_at: new Date().toISOString(),
      });
    }

    // ── 19. Manifest + end-to-end verification ──
    await svc.entities.DemoSeedRun.update(run.id, {
      student_emails: allSeededEmails,
      student_count: mathStudents.length + otherStudents.length,
      seeded_at: new Date().toISOString(),
    });

    const freshAli = await profileByEmail(svc, emails.student);
    const aliRegs = freshAli ? await svc.entities.BlockWardVerificationRegistry.filter({ student_id: freshAli.id }) : [];
    const verified = aliRegs.filter((r) => r.approval_status === 'approved');
    const aliGrades = await svc.entities.StudentGrade.filter({ school_id: school.id, student_email: emails.student, status: 'published' });
    const pendingTeacher = await findRequest(svc, emails.student, PENDING_FOR_TEACHER.title);
    const pendingAdmin = pendingAdminResult.request;

    return Response.json({
      ok: true,
      world: {
        school: { id: school.id, name: SCHOOL_NAME, verified: true, academic_year: '2026/27' },
        classes: [mathClass.name, physicsClass.name, csClass.name],
        year_groups: yearNames,
        students: mathStudents.length + otherStudents.length,
        timetable_slots: 7,
        attendance_sessions: 11,
        announcements: 2,
        points_entries: pointSpecs.length,
      },
      accounts: {
        admin: { email: emails.admin, name: ADMIN_FULL, role: 'admin', invite_url: inviteUrls.admin },
        teacher: { email: emails.teacher, name: `${TEACHER.first} ${TEACHER.last}`, role: 'teacher', class: mathClass.name, invite_url: inviteUrls.teacher },
        student: { email: emails.student, name: `${STUDENT.first} ${STUDENT.last}`, role: 'student', class: mathClass.name, invite_url: inviteUrls.student },
      },
      gradebook: {
        algebra_test_1: { max: 50, demo_student: '43/50 (86%)', class_average: Math.round(SCORES_A.reduce((a, b) => a + b, 0) / SCORES_A.length / 50 * 100) + '%' },
        published_grades: aliGrades.length,
      },
      assignment: { title: 'Algebra Homework — Quadratic Equations', due: inDaysDate(3), submissions_in: 2 },
      assembly: { title: 'Academic Progress Assembly', when: assemblyStart.toISOString(), location: 'Main Hall' },
      achievements: {
        verified_for_demo_student: verified.length,
        flagship: registries.math_award ? { title: registries.math_award.achievement_title, verification_id: registries.math_award.verification_id, verify_url: registries.math_award.public_verification_url } : null,
        pending_teacher_review: pendingTeacher ? { title: pendingTeacher.title, status: pendingTeacher.status } : null,
        pending_admin_approval: pendingAdmin ? { title: pendingAdmin.title, status: pendingAdmin.status } : null,
        all_verify_urls: verified.map((r) => r.public_verification_url).filter(Boolean),
      },
      blockchain: chain,
    });
  } catch (error) {
    console.error('seedPitchDemo error:', error);
    return Response.json({ error: error.message || 'Seed failed' }, { status: 500 });
  }
}