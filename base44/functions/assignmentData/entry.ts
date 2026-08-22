import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { resolveEffectiveActor } from '../../shared/testMode.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "content-type": "application/json",
};
const safeJson = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: corsHeaders });

const ASSIGNMENT_TYPES = ["homework", "assignment", "revision", "coursework", "project"];
const todayStr = () => new Date().toISOString().slice(0, 10);

function dueStatus(assn) {
  if (!assn.due_date) return "upcoming";
  const d = assn.due_date;
  const t = todayStr();
  if (d < t) return "overdue";
  if (d === t) return "due_today";
  return "due_soon";
}

async function studentView(svc, actor) {
  const classes = await svc.entities.Class.filter({ school_id: actor.school_id }).catch(() => []);
  const myClassIds = classes.filter(c => (c.student_emails || []).includes(actor.actor_email)).map(c => c.id);
  if (!myClassIds.length) return { view: "student", assignments: [], due_soon: [], overdue: [], upcoming: [], completed: [] };

  const [assessments, grades] = await Promise.all([
    svc.entities.Assessment.filter({ school_id: actor.school_id }).catch(() => []),
    svc.entities.StudentGrade.filter({ school_id: actor.school_id, student_email: actor.actor_email }).catch(() => []),
  ]);
  const mine = assessments
    .filter(a => ASSIGNMENT_TYPES.includes(a.assessment_type) && myClassIds.includes(a.class_id))
    .filter(a => a.status === "published" || a.teacher_email === actor.actor_email);

  const enriched = mine.map(a => {
    const grade = grades.find(g => g.assessment_id === a.id);
    const published = grade && grade.status === "published";
    return {
      id: a.id, title: a.title, description: a.description, subject: a.subject, class_name: a.class_name,
      teacher_name: a.teacher_name, assessment_type: a.assessment_type,
      date: a.date, due_date: a.due_date, attachment_url: a.attachment_url,
      status: a.status, max_score: a.max_score,
      grade_status: published ? "graded" : "not_submitted",
      raw_score: published ? grade.raw_score : null,
      percentage: published ? grade.percentage : null,
      grade_value: published ? grade.grade_value : null,
      due_status: dueStatus(a),
    };
  });

  const dueSoon = enriched.filter(a => a.due_status === "due_soon" || a.due_status === "due_today").sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""));
  const overdue = enriched.filter(a => a.due_status === "overdue" && a.grade_status !== "graded").sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""));
  const upcoming = enriched.filter(a => a.due_status === "upcoming").sort((a, b) => (a.due_date || "9999").localeCompare(b.due_date || "9999"));
  const completed = enriched.filter(a => a.grade_status === "graded").sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  return { view: "student", assignments: enriched, due_soon: dueSoon, overdue, upcoming, completed, class_count: myClassIds.length };
}

async function teacherView(svc, actor) {
  const classes = await svc.entities.Class.filter({ school_id: actor.school_id }).catch(() => []);
  const myClasses = classes.filter(c => c.teacher_email === actor.actor_email || (c.co_teachers || []).includes(actor.actor_email));
  const myClassIds = myClasses.map(c => c.id);
  const assessments = await svc.entities.Assessment.filter({ school_id: actor.school_id }).catch(() => []);
  const mine = assessments.filter(a => ASSIGNMENT_TYPES.includes(a.assessment_type) && myClassIds.includes(a.class_id));
  const enriched = mine.map(a => {
    return {
      id: a.id, title: a.title, description: a.description, subject: a.subject, class_name: a.class_name, class_id: a.class_id,
      assessment_type: a.assessment_type, date: a.date, due_date: a.due_date, attachment_url: a.attachment_url,
      status: a.status, max_score: a.max_score, student_count: (myClasses.find(c => c.id === a.class_id)?.student_emails || []).length,
      due_status: dueStatus(a),
    };
  }).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const upcoming = enriched.filter(a => a.due_status !== "overdue" && a.status === "published").slice(0, 10);
  const overdueCount = enriched.filter(a => a.due_status === "overdue").length;
  return { view: "teacher", assignments: enriched, classes: myClasses.map(c => ({ id: c.id, name: c.name, subject: c.subject })), upcoming, overdue_count: overdueCount };
}

async function adminView(svc, actor) {
  const [assessments, classes, profiles] = await Promise.all([
    svc.entities.Assessment.filter({ school_id: actor.school_id }).catch(() => []),
    svc.entities.Class.filter({ school_id: actor.school_id }).catch(() => []),
    svc.entities.UserProfile.filter({ school_id: actor.school_id }).catch(() => []),
  ]);
  const mine = assessments.filter(a => ASSIGNMENT_TYPES.includes(a.assessment_type));
  const teachers = profiles.filter(p => p.user_type === "teacher");
  const byClass = {};
  const byTeacher = {};
  for (const a of mine) {
    byClass[a.class_name || "Unknown"] = (byClass[a.class_name || "Unknown"] || 0) + 1;
    byTeacher[a.teacher_name || a.teacher_email || "Unknown"] = (byTeacher[a.teacher_name || a.teacher_email || "Unknown"] || 0) + 1;
  }
  const t = todayStr();
  const overdue = mine.filter(a => a.due_date && a.due_date < t);
  return {
    view: "admin",
    totals: { total: mine.length, published: mine.filter(a => a.status === "published").length, draft: mine.filter(a => a.status === "draft").length, overdue: overdue.length },
    assignments: mine.sort((a, b) => (b.date || "").localeCompare(a.date || "")).map(a => ({
      id: a.id, title: a.title, subject: a.subject, class_name: a.class_name, teacher_name: a.teacher_name,
      assessment_type: a.assessment_type, date: a.date, due_date: a.due_date, status: a.status, due_status: dueStatus(a),
    })),
    by_class: byClass, by_teacher: byTeacher,
    classes: classes.map(c => ({ id: c.id, name: c.name, subject: c.subject })),
    teachers: teachers.map(t => ({ email: t.user_email, name: `${t.first_name || ""} ${t.last_name || ""}`.trim() })),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return safeJson({ ok: false, message: "Method not allowed" }, 405);
  try {
    const base44 = createClientFromRequest(req);
    const actor = await resolveEffectiveActor(base44);
    if (!actor.authorized) return safeJson({ ok: false, code: "FORBIDDEN", message: actor.reason || "Not authorised" }, actor.status || 403);
    const svc = base44.asServiceRole;
    const role = actor.actor_role || "student";
    let data;
    if (role === "student") data = await studentView(svc, actor);
    else if (role === "teacher") data = await teacherView(svc, actor);
    else if (role === "admin") data = await adminView(svc, actor);
    else return safeJson({ ok: false, code: "FORBIDDEN", message: "Unknown role" }, 403);
    return safeJson({ ok: true, role, is_test_mode: !!actor.is_test_mode, data });
  } catch (err) {
    console.log(JSON.stringify({ step: "assignmentData fatal", error: String(err?.message || err) }));
    return safeJson({ ok: false, code: "FATAL", message: err?.message || "Unknown error" }, 500);
  }
});