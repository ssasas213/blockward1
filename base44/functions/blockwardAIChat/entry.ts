import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { resolveEffectiveActor } from '../../shared/testMode.ts';
import { averagePercentages } from '../../shared/gradeCalc.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "content-type": "application/json",
};

function safeJson(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: corsHeaders });
}

const GEMINI_MODEL = "gemini-2.0-flash";
const MAX_STEPS = 6;

const PENDING_REVIEW_STATUSES = ["submitted", "awaiting_teacher_signature", "awaiting_admin_signature", "changes_requested"];

// ───────────────────────── Grade summary helpers ─────────────────────────
function buildStudentGradeSummary(grades) {
  if (!grades || !grades.length) return { has_grades: false };
  const valid = grades.filter(g => g.percentage != null);
  if (!valid.length) return { has_grades: false };
  const overall = averagePercentages(valid.map(g => g.percentage));
  const bySubject = {};
  for (const g of valid) {
    const k = g.subject || g.class_name || "General";
    if (!bySubject[k]) bySubject[k] = [];
    bySubject[k].push(g.percentage);
  }
  const subject_averages = Object.entries(bySubject).map(([s, p]) => ({ subject: s, average: averagePercentages(p) }));
  const sorted = [...valid].filter(g => g.assessment_date).sort((a, b) => new Date(a.assessment_date) - new Date(b.assessment_date));
  const latest = sorted.slice(-5).map(g => ({ title: g.assessment_title, subject: g.subject, percentage: g.percentage, grade: g.grade_value, date: g.assessment_date }));
  const highest = valid.reduce((best, g) => (g.percentage > (best?.percentage || -1) ? g : best), null);
  return { has_grades: true, overall_average: overall, subject_averages, latest, highest: highest ? { title: highest.assessment_title, percentage: highest.percentage, grade: highest.grade_value } : null, total_assessments: valid.length };
}

function buildClassGradeSummary(grades) {
  const published = (grades || []).filter(g => g.status === "published");
  if (!published.length) return { has_grades: false, student_count: 0 };
  const byStudent = {};
  for (const g of published) {
    if (g.percentage == null) continue;
    const k = g.student_name || g.student_email || "Unknown";
    if (!byStudent[k]) byStudent[k] = [];
    byStudent[k].push(g.percentage);
  }
  const students = Object.entries(byStudent).map(([name, pcts]) => ({ name, average: averagePercentages(pcts), assessments: pcts.length })).sort((a, b) => (b.average || 0) - (a.average || 0));
  const overall = averagePercentages(published.map(g => g.percentage));
  return { has_grades: true, class_average: overall, student_count: students.length, top_students: students.slice(0, 10), below_60: students.filter(s => (s.average || 0) < 60) };
}

function buildAdminGradeSummary(assessments, grades) {
  const published = (grades || []).filter(g => g.status === "published");
  const overall = averagePercentages(published.map(g => g.percentage));
  const byClass = {};
  for (const g of published) {
    const k = g.class_name || "Unknown";
    if (!byClass[k]) byClass[k] = [];
    if (g.percentage != null) byClass[k].push(g.percentage);
  }
  const class_averages = Object.entries(byClass).map(([cls, pcts]) => ({ class: cls, average: averagePercentages(pcts) })).sort((a, b) => (b.average || 0) - (a.average || 0));
  const bySubject = {};
  for (const g of published) {
    const k = g.subject || "General";
    if (!bySubject[k]) bySubject[k] = [];
    if (g.percentage != null) bySubject[k].push(g.percentage);
  }
  const subject_averages = Object.entries(bySubject).map(([s, p]) => ({ subject: s, average: averagePercentages(p) }));
  const dist = {};
  for (const g of published) { const gv = g.grade_value || "Ungraded"; dist[gv] = (dist[gv] || 0) + 1; }
  return { assessments: (assessments || []).length, published_grades: published.length, school_average: overall, grade_distribution: dist, class_averages, subject_averages };
}

// ───────────────────────── Tool definitions ─────────────────────────
// Every tool performs its OWN server-side authorization using ctx.actor.
// Students: only their own data. Teachers: only assigned classes. Admins: only current school.
// Test Mode: ctx.actor is the effective persona (NOT the controller's real admin powers).

const TOOLS = [
  // ── STUDENT ──
  {
    name: "getMyGrades", description: "Get the student's own published grades, overall average, and per-subject averages.", allowedRoles: ["student"],
    parameters: { type: "object", properties: {} },
    async run(_args, { svc, actor }) {
      const grades = await svc.entities.StudentGrade.filter({ school_id: actor.school_id, student_email: actor.actor_email, status: "published" }).catch(() => []);
      return buildStudentGradeSummary(grades);
    },
  },
  {
    name: "getMyEvents", description: "Get the student's upcoming school and class events.", allowedRoles: ["student"],
    parameters: { type: "object", properties: {} },
    async run(_args, { svc, actor }) {
      const [events, classes] = await Promise.all([
        svc.entities.Event.filter({ school_id: actor.school_id }).catch(() => []),
        svc.entities.Class.filter({ school_id: actor.school_id }).catch(() => []),
      ]);
      const myClassIds = classes.filter(c => (c.student_emails || []).includes(actor.actor_email)).map(c => c.id);
      const now = new Date();
      const upcoming = events
        .filter(e => e.start_time && new Date(e.start_time) >= now)
        .filter(e => !e.audience_class_id || myClassIds.includes(e.audience_class_id) || e.audience === "whole_school" || !e.audience)
        .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
        .slice(0, 10)
        .map(e => ({ title: e.title, start: e.start_time, location: e.location, audience: e.audience }));
      return { events: upcoming };
    },
  },
  {
    name: "getMyTimetable", description: "Get the student's weekly timetable for their enrolled classes.", allowedRoles: ["student"],
    parameters: { type: "object", properties: {} },
    async run(_args, { svc, actor }) {
      const classes = await svc.entities.Class.filter({ school_id: actor.school_id }).catch(() => []);
      const myClassIds = classes.filter(c => (c.student_emails || []).includes(actor.actor_email)).map(c => c.id);
      const entries = myClassIds.length ? (await svc.entities.TimetableEntry.filter({ school_id: actor.school_id }).catch(() => [])).filter(t => myClassIds.includes(t.class_id)) : [];
      return { timetable: entries.map(t => ({ class_name: t.class_name, subject: t.subject, day: t.day_of_week, start: t.start_time, end: t.end_time, room: t.room })) };
    },
  },
  {
    name: "getMyBlockWards", description: "Get the BlockWards (verified digital credentials) the student has earned.", allowedRoles: ["student"],
    parameters: { type: "object", properties: {} },
    async run(_args, { svc, actor }) {
      const bws = await svc.entities.BlockWard.filter({ school_id: actor.school_id, student_email: actor.actor_email }).catch(() => []);
      return { count: bws.length, blockwards: bws.slice(-10).reverse().map(b => ({ title: b.title, category: b.category, issued_by: b.issuer_name, date: b.minted_at })) };
    },
  },
  {
    name: "getMyAchievements", description: "Get the student's achievement records (submitted, pending, approved).", allowedRoles: ["student"],
    parameters: { type: "object", properties: {} },
    async run(_args, { svc, actor }) {
      const recs = await svc.entities.StudentRecord.filter({ school_id: actor.school_id, student_email: actor.actor_email }).catch(() => []);
      return { count: recs.length, achievements: recs.slice(-10).reverse().map(r => ({ title: r.title, category: r.category, status: r.status, points: r.points, date: r.date_achieved })) };
    },
  },

  {
    name: "getMyPoints", description: "Get the student's own achievement/behaviour point history and totals.", allowedRoles: ["student"],
    parameters: { type: "object", properties: {} },
    async run(_args, { svc, actor }) {
      const entries = await svc.entities.PointEntry.filter({ school_id: actor.school_id, student_email: actor.actor_email }).catch(() => []);
      if (!entries.length) return { has_points: false };
      const achievement_total = entries.filter(e => e.type === "achievement").reduce((s, e) => s + (e.points || 0), 0);
      const behaviour_total = entries.filter(e => e.type === "behaviour").reduce((s, e) => s + (e.points || 0), 0);
      const sorted = [...entries].filter(e => e.timestamp).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      const recent = sorted.slice(0, 10).map(e => ({ type: e.type, points: e.points, reason: e.reason, category: e.category_name, date: e.timestamp }));
      return { has_points: true, achievement_total, behaviour_total, entry_count: entries.length, recent };
    },
  },
  {
    name: "getMyAnnouncements", description: "Get the student's recent school and class announcements that have been sent.", allowedRoles: ["student"],
    parameters: { type: "object", properties: {} },
    async run(_args, { svc, actor }) {
      const [announcements, classes] = await Promise.all([
        svc.entities.Announcement.filter({ school_id: actor.school_id, status: "sent" }).catch(() => []),
        svc.entities.Class.filter({ school_id: actor.school_id }).catch(() => []),
      ]);
      const myClassIds = classes.filter(c => (c.student_emails || []).includes(actor.actor_email)).map(c => c.id);
      const visible = announcements
        .filter(a =>
          a.scope_type === "SCHOOL" ||
          (a.scope_type === "CLASS" && myClassIds.includes(a.class_id)) ||
          (a.scope_type === "STUDENTS" && (a.student_emails || []).includes(actor.actor_email))
        )
        .sort((a, b) => new Date(b.sent_at || 0) - new Date(a.sent_at || 0))
        .slice(0, 10)
        .map(a => ({ title: a.title, body: a.body_short || a.body, priority: a.priority, date: a.sent_at }));
      return { count: visible.length, announcements: visible };
    },
  },

  {
    name: "getMyAssemblies", description: "Get the student's upcoming school assemblies. Assemblies are stored as school Events tagged or titled 'assembly'.", allowedRoles: ["student"],
    parameters: { type: "object", properties: {} },
    async run(_args, { svc, actor }) {
      const [events, classes] = await Promise.all([
        svc.entities.Event.filter({ school_id: actor.school_id }).catch(() => []),
        svc.entities.Class.filter({ school_id: actor.school_id }).catch(() => []),
      ]);
      const myClassIds = classes.filter(c => (c.student_emails || []).includes(actor.actor_email)).map(c => c.id);
      const now = new Date();
      const isAssembly = e => /assembly/i.test(e.title || "") || (e.tags || []).some(t => /assembly/i.test(t));
      const upcoming = events
        .filter(isAssembly)
        .filter(e => e.start_time && new Date(e.start_time) >= now)
        .filter(e => !e.audience_class_id || myClassIds.includes(e.audience_class_id) || e.audience === "whole_school" || !e.audience)
        .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
        .slice(0, 10)
        .map(e => ({ title: e.title, start: e.start_time, location: e.location }));
      return { assemblies: upcoming };
    },
  },
  {
    name: "getMyHomework", description: "Get the student's homework assignments (from the class assessment system) for their enrolled classes, with whether each has been graded yet.", allowedRoles: ["student"],
    parameters: { type: "object", properties: {} },
    async run(_args, { svc, actor }) {
      const classes = await svc.entities.Class.filter({ school_id: actor.school_id }).catch(() => []);
      const myClassIds = classes.filter(c => (c.student_emails || []).includes(actor.actor_email)).map(c => c.id);
      if (!myClassIds.length) return { homework: [] };
      const [assessments, grades] = await Promise.all([
        svc.entities.Assessment.filter({ school_id: actor.school_id, assessment_type: "homework", status: "published" }).catch(() => []),
        svc.entities.StudentGrade.filter({ school_id: actor.school_id, student_email: actor.actor_email }).catch(() => []),
      ]);
      const mine = assessments.filter(a => myClassIds.includes(a.class_id));
      const homework = mine
        .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
        .slice(0, 15)
        .map(a => {
          const grade = grades.find(g => g.assessment_id === a.id);
          return { title: a.title, class_name: a.class_name, subject: a.subject, date: a.date, status: grade ? (grade.status === "published" ? "graded" : "submitted, awaiting grade") : "not yet graded" };
        });
      return { homework };
    },
  },
  {
    name: "getMyAttendance", description: "Get the student's attendance record.", allowedRoles: ["student"],
    parameters: { type: "object", properties: {} },
    async run() {
      return { available: false, message: "Attendance tracking is not currently recorded in BlockWard for students." };
    },
  },

  // ── TEACHER ──
  {
    name: "getMyClasses", description: "List the classes the teacher owns or co-teaches.", allowedRoles: ["teacher"],
    parameters: { type: "object", properties: {} },
    async run(_args, { svc, actor }) {
      const classes = await svc.entities.Class.filter({ school_id: actor.school_id }).catch(() => []);
      const myClasses = classes.filter(c => c.teacher_email === actor.actor_email || (c.co_teachers || []).includes(actor.actor_email));
      return { classes: myClasses.map(c => ({ name: c.name, subject: c.subject, student_count: (c.student_emails || []).length })) };
    },
  },
  {
    name: "getClassStudents", description: "List the students enrolled in one of the teacher's own classes, identified by class name.", allowedRoles: ["teacher"],
    parameters: { type: "object", properties: { class_name: { type: "string", description: "The exact class name" } }, required: ["class_name"] },
    async run(args, { svc, actor }) {
      const classes = await svc.entities.Class.filter({ school_id: actor.school_id }).catch(() => []);
      const cls = classes.find(c => (c.name || "").toLowerCase() === String(args?.class_name || "").toLowerCase() && (c.teacher_email === actor.actor_email || (c.co_teachers || []).includes(actor.actor_email)));
      if (!cls) return { error: "You do not teach a class with that name." };
      const emails = cls.student_emails || [];
      const profiles = emails.length ? await svc.entities.UserProfile.filter({ school_id: actor.school_id }).catch(() => []) : [];
      const students = profiles.filter(p => emails.includes(p.user_email)).map(p => ({ name: `${p.first_name || ""} ${p.last_name || ""}`.trim(), email: p.user_email, grade_level: p.grade_level }));
      return { class: cls.name, student_count: students.length, students };
    },
  },
  {
    name: "getClassGrades", description: "Get the published grade summary for one of the teacher's own classes, identified by class name.", allowedRoles: ["teacher"],
    parameters: { type: "object", properties: { class_name: { type: "string", description: "The exact class name" } }, required: ["class_name"] },
    async run(args, { svc, actor }) {
      const classes = await svc.entities.Class.filter({ school_id: actor.school_id }).catch(() => []);
      const cls = classes.find(c => (c.name || "").toLowerCase() === String(args?.class_name || "").toLowerCase() && (c.teacher_email === actor.actor_email || (c.co_teachers || []).includes(actor.actor_email)));
      if (!cls) return { error: "You do not teach a class with that name." };
      const grades = await svc.entities.StudentGrade.filter({ school_id: actor.school_id, class_id: cls.id, status: "published" }).catch(() => []);
      return { class: cls.name, grades: buildClassGradeSummary(grades) };
    },
  },
  {
    name: "getPendingReviews", description: "Get achievement submissions awaiting the teacher's or admin's review.", allowedRoles: ["teacher"],
    parameters: { type: "object", properties: {} },
    async run(_args, { svc, actor }) {
      const recs = await svc.entities.StudentRecord.filter({ school_id: actor.school_id, teacher_email: actor.actor_email }).catch(() => []);
      const pending = recs.filter(r => PENDING_REVIEW_STATUSES.includes(r.status));
      return { pending_count: pending.length, pending: pending.slice(0, 10).map(r => ({ title: r.title, student: r.student_name, status: r.status, date: r.submitted_at })) };
    },
  },

  {
    name: "getStudentSummary", description: "Get a summary of one student (grades, achievements, points) — only for a student enrolled in one of the teacher's own classes. Identify the student by email (use getClassStudents first to look up the email).", allowedRoles: ["teacher"],
    parameters: { type: "object", properties: { student_email: { type: "string", description: "The student's exact email address" } }, required: ["student_email"] },
    async run(args, { svc, actor }) {
      const targetEmail = String(args?.student_email || "").trim().toLowerCase();
      if (!targetEmail) return { error: "student_email is required." };
      const classes = await svc.entities.Class.filter({ school_id: actor.school_id }).catch(() => []);
      const myClasses = classes.filter(c => c.teacher_email === actor.actor_email || (c.co_teachers || []).includes(actor.actor_email));
      const inMyClass = myClasses.some(c => (c.student_emails || []).map(e => e.toLowerCase()).includes(targetEmail));
      if (!inMyClass) return { error: "That student is not enrolled in one of your classes." };

      const [profiles, grades, records, points] = await Promise.all([
        svc.entities.UserProfile.filter({ school_id: actor.school_id, user_email: targetEmail }).catch(() => []),
        svc.entities.StudentGrade.filter({ school_id: actor.school_id, student_email: targetEmail, status: "published" }).catch(() => []),
        svc.entities.StudentRecord.filter({ school_id: actor.school_id, student_email: targetEmail }).catch(() => []),
        svc.entities.PointEntry.filter({ school_id: actor.school_id, student_email: targetEmail }).catch(() => []),
      ]);
      const profile = profiles[0] || null;
      const achievement_points = points.filter(p => p.type === "achievement").reduce((s, p) => s + (p.points || 0), 0);
      const behaviour_points = points.filter(p => p.type === "behaviour").reduce((s, p) => s + (p.points || 0), 0);
      return {
        name: profile ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() : null,
        grade_level: profile?.grade_level || null,
        grades: buildStudentGradeSummary(grades),
        achievements_total: records.length,
        achievements_by_status: records.reduce((acc, r) => { acc[r.status || "unknown"] = (acc[r.status || "unknown"] || 0) + 1; return acc; }, {}),
        achievement_points,
        behaviour_points,
      };
    },
  },
  {
    name: "getTeacherAchievementStats", description: "Get the teacher's own achievement-issuing activity stats (submissions across all their classes/students).", allowedRoles: ["teacher"],
    parameters: { type: "object", properties: {} },
    async run(_args, { svc, actor }) {
      const recs = await svc.entities.StudentRecord.filter({ school_id: actor.school_id, teacher_email: actor.actor_email }).catch(() => []);
      const by_status = {};
      const by_category = {};
      for (const r of recs) {
        by_status[r.status || "unknown"] = (by_status[r.status || "unknown"] || 0) + 1;
        by_category[r.category || "other"] = (by_category[r.category || "other"] || 0) + 1;
      }
      return { total: recs.length, by_status, by_category };
    },
  },

  {
    name: "getUpcomingAssemblies", description: "Get upcoming assemblies relevant to the teacher's classes. Assemblies are stored as school Events tagged or titled 'assembly'.", allowedRoles: ["teacher"],
    parameters: { type: "object", properties: {} },
    async run(_args, { svc, actor }) {
      const [events, classes] = await Promise.all([
        svc.entities.Event.filter({ school_id: actor.school_id }).catch(() => []),
        svc.entities.Class.filter({ school_id: actor.school_id }).catch(() => []),
      ]);
      const myClassIds = classes.filter(c => c.teacher_email === actor.actor_email || (c.co_teachers || []).includes(actor.actor_email)).map(c => c.id);
      const now = new Date();
      const isAssembly = e => /assembly/i.test(e.title || "") || (e.tags || []).some(t => /assembly/i.test(t));
      const upcoming = events
        .filter(isAssembly)
        .filter(e => e.start_time && new Date(e.start_time) >= now)
        .filter(e => e.audience === "whole_school" || e.audience === "staff_only" || !e.audience || (e.audience_class_id && myClassIds.includes(e.audience_class_id)))
        .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
        .slice(0, 10)
        .map(e => ({ title: e.title, start: e.start_time, location: e.location, audience: e.audience }));
      return { assemblies: upcoming };
    },
  },
  {
    name: "getClassHomework", description: "Get homework assignments for one of the teacher's own classes, identified by class name, with submission/grading completion counts.", allowedRoles: ["teacher"],
    parameters: { type: "object", properties: { class_name: { type: "string", description: "The exact class name" } }, required: ["class_name"] },
    async run(args, { svc, actor }) {
      const classes = await svc.entities.Class.filter({ school_id: actor.school_id }).catch(() => []);
      const cls = classes.find(c => (c.name || "").toLowerCase() === String(args?.class_name || "").toLowerCase() && (c.teacher_email === actor.actor_email || (c.co_teachers || []).includes(actor.actor_email)));
      if (!cls) return { error: "You do not teach a class with that name." };
      const [assessments, grades] = await Promise.all([
        svc.entities.Assessment.filter({ school_id: actor.school_id, class_id: cls.id, assessment_type: "homework" }).catch(() => []),
        svc.entities.StudentGrade.filter({ school_id: actor.school_id, class_id: cls.id }).catch(() => []),
      ]);
      const studentCount = (cls.student_emails || []).length;
      const homework = assessments.map(a => {
        const graded = grades.filter(g => g.assessment_id === a.id && g.status === "published").length;
        return { title: a.title, date: a.date, status: a.status, graded_count: graded, student_count: studentCount };
      });
      return { class: cls.name, homework };
    },
  },
  {
    name: "getClassAttendance", description: "Get attendance for one of the teacher's own classes.", allowedRoles: ["teacher"],
    parameters: { type: "object", properties: { class_name: { type: "string" } } },
    async run() {
      return { available: false, message: "Attendance tracking is not currently recorded in BlockWard for classes." };
    },
  },

  // ── ADMIN ──
  {
    name: "getSchoolSummary", description: "Get a whole-school overview: students, teachers, classes, achievements, BlockWards.", allowedRoles: ["admin"],
    parameters: { type: "object", properties: {} },
    async run(_args, { svc, actor }) {
      const [profiles, records, blockwards, classes] = await Promise.all([
        svc.entities.UserProfile.filter({ school_id: actor.school_id }).catch(() => []),
        svc.entities.StudentRecord.filter({ school_id: actor.school_id }).catch(() => []),
        svc.entities.BlockWard.filter({ school_id: actor.school_id }).catch(() => []),
        svc.entities.Class.filter({ school_id: actor.school_id }).catch(() => []),
      ]);
      return {
        students: profiles.filter(p => p.user_type === "student").length,
        teachers: profiles.filter(p => p.user_type === "teacher").length,
        classes: classes.length,
        achievements_total: records.length,
        blockwards_delivered: blockwards.length,
      };
    },
  },
  {
    name: "getApprovalStats", description: "Get achievement approval queue statistics for the school.", allowedRoles: ["admin"],
    parameters: { type: "object", properties: {} },
    async run(_args, { svc, actor }) {
      const records = await svc.entities.StudentRecord.filter({ school_id: actor.school_id }).catch(() => []);
      const by_status = {};
      for (const r of records) by_status[r.status || "unknown"] = (by_status[r.status || "unknown"] || 0) + 1;
      const pending = records.filter(r => ["submitted", "awaiting_admin_signature", "changes_requested"].includes(r.status));
      return { total_records: records.length, pending_count: pending.length, by_status };
    },
  },
  {
    name: "getSchoolGradeStats", description: "Get school-wide academic grade statistics: school average, distribution, class and subject averages.", allowedRoles: ["admin"],
    parameters: { type: "object", properties: {} },
    async run(_args, { svc, actor }) {
      const [assessments, grades] = await Promise.all([
        svc.entities.Assessment.filter({ school_id: actor.school_id }).catch(() => []),
        svc.entities.StudentGrade.filter({ school_id: actor.school_id }).catch(() => []),
      ]);
      return buildAdminGradeSummary(assessments, grades);
    },
  },
  {
    name: "getTeacherActivity", description: "Get a per-teacher breakdown of activity across the school: achievements issued and points awarded.", allowedRoles: ["admin"],
    parameters: { type: "object", properties: {} },
    async run(_args, { svc, actor }) {
      const [records, points] = await Promise.all([
        svc.entities.StudentRecord.filter({ school_id: actor.school_id }).catch(() => []),
        svc.entities.PointEntry.filter({ school_id: actor.school_id }).catch(() => []),
      ]);
      const byTeacher = {};
      for (const r of records) {
        const k = r.teacher_name || r.teacher_email || "Unknown";
        if (!byTeacher[k]) byTeacher[k] = { achievements_submitted: 0, points_awarded: 0 };
        byTeacher[k].achievements_submitted += 1;
      }
      for (const p of points) {
        const k = p.teacher_name || p.teacher_email || "Unknown";
        if (!byTeacher[k]) byTeacher[k] = { achievements_submitted: 0, points_awarded: 0 };
        byTeacher[k].points_awarded += (p.points || 0);
      }
      const teachers = Object.entries(byTeacher).map(([name, stats]) => ({ name, ...stats })).sort((a, b) => b.achievements_submitted - a.achievements_submitted);
      return { teacher_count: teachers.length, teachers: teachers.slice(0, 20) };
    },
  },
  {
    name: "getAchievementStats", description: "Get school-wide achievement/BlockWard statistics: totals by status and category, and BlockWards delivered.", allowedRoles: ["admin"],
    parameters: { type: "object", properties: {} },
    async run(_args, { svc, actor }) {
      const [records, blockwards] = await Promise.all([
        svc.entities.StudentRecord.filter({ school_id: actor.school_id }).catch(() => []),
        svc.entities.BlockWard.filter({ school_id: actor.school_id }).catch(() => []),
      ]);
      const by_status = {};
      const by_category = {};
      for (const r of records) {
        by_status[r.status || "unknown"] = (by_status[r.status || "unknown"] || 0) + 1;
        by_category[r.category || "other"] = (by_category[r.category || "other"] || 0) + 1;
      }
      return { total_records: records.length, by_status, by_category, blockwards_delivered: blockwards.length };
    },
  },
  {
    name: "getAssemblySchedule", description: "Get the school's scheduled assemblies. Assemblies are stored as school Events tagged or titled 'assembly'.", allowedRoles: ["admin"],
    parameters: { type: "object", properties: {} },
    async run(_args, { svc, actor }) {
      const events = await svc.entities.Event.filter({ school_id: actor.school_id }).catch(() => []);
      const now = new Date();
      const isAssembly = e => /assembly/i.test(e.title || "") || (e.tags || []).some(t => /assembly/i.test(t));
      const upcoming = events
        .filter(isAssembly)
        .filter(e => e.start_time && new Date(e.start_time) >= now)
        .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
        .slice(0, 20)
        .map(e => ({ title: e.title, start: e.start_time, location: e.location, audience: e.audience }));
      return { assemblies: upcoming };
    },
  },
  {
    name: "getSchoolAttendanceStats", description: "Get school-wide attendance statistics.", allowedRoles: ["admin"],
    parameters: { type: "object", properties: {} },
    async run() {
      return { available: false, message: "Attendance tracking is not currently recorded in BlockWard for this school." };
    },
  },
];

const TOOL_LABELS = {
  getMyGrades: "my grades", getMyEvents: "events", getMyTimetable: "timetable", getMyBlockWards: "BlockWards", getMyAchievements: "achievements", getMyPoints: "my points", getMyAnnouncements: "announcements", getMyAssemblies: "assemblies", getMyHomework: "homework", getMyAttendance: "attendance",
  getMyClasses: "my classes", getClassStudents: "class students", getClassGrades: "class grades", getPendingReviews: "pending reviews", getStudentSummary: "student summary", getTeacherAchievementStats: "my achievement stats", getUpcomingAssemblies: "assemblies", getClassHomework: "class homework", getClassAttendance: "class attendance",
  getSchoolSummary: "school summary", getApprovalStats: "approval stats", getSchoolGradeStats: "grade stats", getTeacherActivity: "teacher activity", getAchievementStats: "achievement stats", getAssemblySchedule: "assembly schedule", getSchoolAttendanceStats: "attendance stats",
};

// ───────────────────────── System instruction ─────────────────────────
function buildSystemInstruction(actor) {
  const role = actor.actor_role || "student";
  const name = `${actor.first_name || ""} ${actor.last_name || ""}`.trim() || "the user";
  return `You are BlockWard AI, the intelligent assistant built into BlockWard.

You are assisting ${name}, who is a ${role} at their school.

When answering questions about the school, classes, grades, achievements, events or BlockWards, you MUST call the available tools to retrieve real data first, then answer using ONLY the data the tools return.

Rules:
- Answer concisely.
- Use real BlockWard data from tools. Never invent grades, events, achievements, points or statistics.
- If a tool returns no data, an empty result, or an error, say plainly that the data is unavailable. Do not guess or approximate.
- Respect role permissions. Only call tools available to your role. A student must never receive another student's data. A teacher must never receive data for a class they do not teach.
- Clearly distinguish academic grades from BlockWards and achievements. BlockWards are verified digital credentials; grades are academic scores.
- Never claim an action happened unless the tool result confirms it.
- Never expose internal IDs, secrets, tokens, wallet addresses or private system information.
- Refer to people by name only when the tool data provides it.
- Assemblies are not a separate system — they are school Events. When asked about assemblies, use the assembly tool available to your role.
- Homework is tracked through the class assessment/grading system, not a separate task tracker. When asked about homework, use the homework tool available to your role and explain grading status using that data.
- Attendance is not currently tracked in BlockWard. If the attendance tool reports it is unavailable, say so plainly — do not guess or estimate attendance from other data.
- "Draft a report" / "draft a class report" / "draft a school summary": call the relevant summary tools available to your role (for a teacher: class grades, class students, pending reviews; for an admin: school summary, school grade stats, achievement stats, teacher activity), then write a short structured draft (headings like Overview / Highlights / Areas to Watch) using ONLY that data. Always start this kind of answer with the exact line "**AI Draft — Review Before Use**" on its own, and never claim the report has been sent, published, or saved anywhere — it is a draft for the user to review.
- Ranking or "best/top student" questions must be grounded only in returned data (e.g. published grades, achievement points, BlockWards) and must say what the ranking is based on, e.g. "Based on published grades and achievement points this term...". Never fabricate a ranking when the underlying tool data is empty.

Today is ${new Date().toDateString()}.`;
}

// ───────────────────────── Gemini call ─────────────────────────
async function callGemini(apiKey, systemInstruction, contents, tools) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const payload = {
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents,
    generationConfig: { temperature: 0.2 },
  };
  if (tools?.length) payload.tools = tools;

  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

function friendlyGeminiError(status, data) {
  const msg = data?.error?.message || "";
  if (status === 400 || status === 401 || status === 403) return { ok: false, code: "AI_AUTH", message: "The AI service rejected the request. Please check the Gemini API key configuration." };
  if (status === 429) return { ok: false, code: "AI_RATE_LIMIT", message: "The AI service is busy right now. Please wait a moment and try again." };
  if (status >= 500) return { ok: false, code: "AI_UNAVAILABLE", message: "The AI service is temporarily unavailable. Please try again shortly." };
  return { ok: false, code: "AI_ERROR", message: msg || `AI service error (${status})` };
}

// ───────────────────────── Main handler ─────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return safeJson({ ok: false, message: "Method not allowed" }, 405);

  try {
    const base44 = createClientFromRequest(req);

    // Authenticate + resolve effective actor (Test Mode aware)
    const actor = await resolveEffectiveActor(base44);
    if (!actor.authorized) return safeJson({ ok: false, code: "FORBIDDEN", message: actor.reason || "Not authorised" }, actor.status || 403);

    const apiKey = Deno.env.get("GEMINI_API_KEY") || "";
    if (!apiKey) return safeJson({ ok: false, code: "MISSING_SECRET", message: "Gemini API key is not configured." }, 500);

    const body = await req.json().catch(() => ({}));
    const message = String(body?.message || "").trim();
    const pageContext = body?.page_context ? String(body.page_context).trim() : "";
    if (!message) return safeJson({ ok: false, code: "MISSING_FIELD", message: "message is required" });

    const svc = base44.asServiceRole;
    const role = actor.actor_role || "student";

    // Only expose this role's tools to Gemini — enforced availability.
    const roleTools = TOOLS.filter(t => t.allowedRoles.includes(role));
    if (!roleTools.length) return safeJson({ ok: false, code: "FORBIDDEN", message: "No AI tools available for this role." }, 403);

    const toolCtx = { svc, actor };
    const declarations = roleTools.map(t => ({ name: t.name, description: t.description, parameters: t.parameters }));
    const tools = [{ functionDeclarations: declarations }];
    const systemInstruction = buildSystemInstruction(actor);

    let userText = message;
    if (pageContext) userText += `\n\n(Page context: ${pageContext})`;

    const contents = [{ role: "user", parts: [{ text: userText }] }];
    const calledTools = new Set();

    for (let step = 0; step < MAX_STEPS; step++) {
      const gr = await callGemini(apiKey, systemInstruction, contents, tools);
      if (!gr.ok) return safeJson(friendlyGeminiError(gr.status, gr.data), gr.status >= 400 && gr.status < 500 ? gr.status : 502);

      const cand = gr.data?.candidates?.[0];
      if (!cand) {
        const blockReason = gr.data?.promptFeedback?.blockReason;
        return safeJson({ ok: false, code: "AI_BLOCKED", message: blockReason ? "The AI service blocked this request." : "No response from AI." });
      }
      const parts = cand.content?.parts || [];

      const fcPart = parts.find(p => p.functionCall);
      if (!fcPart) {
        const text = parts.map(p => p.text).filter(Boolean).join("").trim();
        return safeJson({
          ok: true,
          role,
          answer: text || "I don't have enough information to answer that right now.",
          tools_called: [...calledTools],
          data_sources: [...new Set([...calledTools].map(n => TOOL_LABELS[n]).filter(Boolean))],
          is_test_mode: !!actor.is_test_mode,
        });
      }

      const { name, args } = fcPart.functionCall;
      calledTools.add(name);
      const tool = roleTools.find(t => t.name === name);
      let result;
      if (!tool) {
        result = { error: "This tool is not available to your role." };
      } else {
        try {
          result = await tool.run(args || {}, toolCtx);
        } catch (e) {
          result = { error: "Tool failed to return data.", detail: String(e?.message || e) };
        }
      }

      contents.push({ role: "model", parts: [{ functionCall: { name, args: args || {} } }] });
      contents.push({ role: "user", parts: [{ functionResponse: { name, response: result } }] });
    }

    return safeJson({ ok: true, role, answer: "I couldn't complete that request within the allowed steps. Please try rephrasing.", tools_called: [...calledTools], data_sources: [...new Set([...calledTools].map(n => TOOL_LABELS[n]).filter(Boolean))], is_test_mode: !!actor.is_test_mode });
  } catch (err) {
    console.log(JSON.stringify({ step: "fatal", error: String(err?.message || err) }));
    return safeJson({ ok: false, code: "FATAL", message: "Something went wrong. Please try again." }, 500);
  }
});