import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { resolveEffectiveActor } from '../../shared/testMode.ts';
import { calcPercentage, calcGrade, averagePercentages } from '../../shared/gradeCalc.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "content-type": "application/json",
};

const safeJson = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: corsHeaders });

// ── Student view: own published grades ──
async function studentView(svc, actor) {
  const { actor_email, school_id } = actor;
  const [grades, scale, terms, classes] = await Promise.all([
    svc.entities.StudentGrade.filter({ school_id, student_email: actor_email, status: "published" }).catch(() => []),
    svc.entities.GradingScale.filter({ school_id, active: true }).catch(() => []),
    svc.entities.AcademicTerm.filter({ school_id }).catch(() => []),
    svc.entities.Class.filter({ school_id }).catch(() => []),
  ]);
  const activeScale = scale[0];
  const bands = activeScale?.grade_bands || null;

  // Subject averages
  const bySubject = {};
  for (const g of grades) {
    const key = g.subject || g.class_name || "General";
    if (!bySubject[key]) bySubject[key] = [];
    if (g.percentage != null) bySubject[key].push(g.percentage);
  }
  const subjectAverages = Object.entries(bySubject).map(([subject, pcts]) => ({
    subject,
    average: averagePercentages(pcts),
    count: pcts.length,
  }));
  const allPcts = grades.map(g => g.percentage).filter(p => p != null);
  const overall = averagePercentages(allPcts);

  // Trend — grades sorted by date
  const trend = [...grades]
    .filter(g => g.assessment_date)
    .sort((a, b) => new Date(a.assessment_date) - new Date(b.assessment_date))
    .map(g => ({ date: g.assessment_date, percentage: g.percentage, subject: g.subject, title: g.assessment_title }));

  return {
    view: "student",
    grades: grades.map(g => ({
      id: g.id, assessment_title: g.assessment_title, assessment_type: g.assessment_type,
      assessment_date: g.assessment_date, class_name: g.class_name, subject: g.subject,
      teacher_name: g.teacher_name, raw_score: g.raw_score, max_score: g.max_score,
      percentage: g.percentage, grade_value: g.grade_value, teacher_comment: g.teacher_comment,
      term_name: g.term_name, published_at: g.published_at,
    })),
    subject_averages: subjectAverages,
    overall_average: overall,
    trend,
    grading_scale: activeScale ? { name: activeScale.name, bands } : null,
    terms: terms.map(t => ({ id: t.id, name: t.name, academic_year: t.academic_year, status: t.status })),
    class_count: classes.filter(c => (c.student_emails || []).includes(actor_email)).length,
  };
}

// ── Teacher gradebook view: classes, assessments, grades for a class ──
async function teacherGradebookView(svc, actor, body) {
  const { actor_email, school_id } = actor;
  const classId = body.class_id || null;

  const [allClasses, scale, terms, profiles] = await Promise.all([
    svc.entities.Class.filter({ school_id }).catch(() => []),
    svc.entities.GradingScale.filter({ school_id, active: true }).catch(() => []),
    svc.entities.AcademicTerm.filter({ school_id }).catch(() => []),
    svc.entities.UserProfile.filter({ school_id }).catch(() => []),
  ]);
  const myClasses = allClasses.filter(c => c.teacher_email === actor_email || (c.co_teachers || []).includes(actor_email));
  const activeScale = scale[0];
  const bands = activeScale?.grade_bands || null;

  if (!classId) {
    return {
      view: "teacher_gradebook",
      classes: myClasses.map(c => ({ id: c.id, name: c.name, subject: c.subject, student_count: (c.student_emails || []).length })),
      grading_scale: activeScale ? { name: activeScale.name, bands } : null,
      terms: terms.map(t => ({ id: t.id, name: t.name, academic_year: t.academic_year, status: t.status })),
      selected_class: null,
      assessments: [],
      students: [],
      grades: [],
    };
  }

  const cls = myClasses.find(c => c.id === classId);
  if (!cls) return safeJson({ ok: false, code: "FORBIDDEN", message: "You do not teach this class" }, 403);

  const studentEmails = cls.student_emails || [];
  const studentProfiles = profiles.filter(p => studentEmails.includes(p.user_email));
  const students = studentEmails.map(email => {
    const p = studentProfiles.find(sp => sp.user_email === email);
    return { email, name: p ? `${p.first_name || ""} ${p.last_name || ""}`.trim() : email, student_id: p?.student_id };
  });

  const [assessments, grades] = await Promise.all([
    svc.entities.Assessment.filter({ school_id, class_id: classId }).catch(() => []),
    svc.entities.StudentGrade.filter({ school_id, class_id: classId }).catch(() => []),
  ]);

  return {
    view: "teacher_gradebook",
    classes: myClasses.map(c => ({ id: c.id, name: c.name, subject: c.subject, student_count: (c.student_emails || []).length })),
    selected_class: { id: cls.id, name: cls.name, subject: cls.subject },
    assessments: assessments.map(a => ({
      id: a.id, title: a.title, assessment_type: a.assessment_type, date: a.date,
      max_score: a.max_score, weighting: a.weighting, status: a.status, term_id: a.term_id,
      term_name: a.term_name, description: a.description, published_at: a.published_at,
    })),
    students,
    grades: grades.map(g => ({
      id: g.id, student_email: g.student_email, assessment_id: g.assessment_id,
      raw_score: g.raw_score, max_score: g.max_score, percentage: g.percentage,
      grade_value: g.grade_value, teacher_comment: g.teacher_comment, status: g.status,
    })),
    grading_scale: activeScale ? { name: activeScale.name, bands } : null,
    terms: terms.map(t => ({ id: t.id, name: t.name, academic_year: t.academic_year, status: t.status })),
    teacher_email: actor_email,
    teacher_name: `${actor.first_name || ""} ${actor.last_name || ""}`.trim(),
  };
}

// ── Admin view: school-wide grade analytics ──
async function adminView(svc, actor) {
  const { school_id } = actor;
  const [assessments, grades, classes, profiles, scale, terms] = await Promise.all([
    svc.entities.Assessment.filter({ school_id }).catch(() => []),
    svc.entities.StudentGrade.filter({ school_id }).catch(() => []),
    svc.entities.Class.filter({ school_id }).catch(() => []),
    svc.entities.UserProfile.filter({ school_id }).catch(() => []),
    svc.entities.GradingScale.filter({ school_id }).catch(() => []),
    svc.entities.AcademicTerm.filter({ school_id }).catch(() => []),
  ]);
  const activeScale = scale.find(s => s.active) || scale[0];
  const bands = activeScale?.grade_bands || null;

  const publishedGrades = grades.filter(g => g.status === "published");
  const allPcts = publishedGrades.map(g => g.percentage).filter(p => p != null);
  const schoolAverage = averagePercentages(allPcts);

  // Grade distribution (by grade_value)
  const dist = {};
  for (const g of publishedGrades) {
    const gv = g.grade_value || calcGrade(g.percentage, bands) || "Ungraded";
    dist[gv] = (dist[gv] || 0) + 1;
  }

  // Per-class averages
  const classAverages = classes.map(c => {
    const cGrades = publishedGrades.filter(g => g.class_id === c.id);
    const pcts = cGrades.map(g => g.percentage).filter(p => p != null);
    return {
      id: c.id, name: c.name, subject: c.subject, teacher_email: c.teacher_email,
      average: averagePercentages(pcts), grade_count: pcts.length,
      assessment_count: assessments.filter(a => a.class_id === c.id).length,
    };
  }).filter(c => c.grade_count > 0);

  // Assessment completion: published vs draft
  const publishedAssessments = assessments.filter(a => a.status === "published").length;
  const draftAssessments = assessments.filter(a => a.status === "draft").length;

  // Missing grades: students enrolled in a class with assessments but no grade
  let missingCount = 0;
  for (const c of classes) {
    const cAssessments = assessments.filter(a => a.class_id === c.id);
    if (!cAssessments.length) continue;
    for (const email of (c.student_emails || [])) {
      for (const a of cAssessments) {
        const has = grades.find(g => g.student_email === email && g.assessment_id === a.id);
        if (!has) missingCount++;
      }
    }
  }

  // Teacher gradebook completion
  const teachers = profiles.filter(p => p.user_type === "teacher");
  const teacherCompletion = teachers.map(t => {
    const tClasses = classes.filter(c => c.teacher_email === t.user_email || (c.co_teachers || []).includes(t.user_email));
    const tClassIds = tClasses.map(c => c.id);
    const tAssessments = assessments.filter(a => tClassIds.includes(a.class_id));
    return {
      email: t.user_email, name: `${t.first_name || ""} ${t.last_name || ""}`.trim(),
      class_count: tClasses.length, assessment_count: tAssessments.length,
      published: tAssessments.filter(a => a.status === "published").length,
    };
  });

  // Per-subject averages
  const bySubject = {};
  for (const g of publishedGrades) {
    const key = g.subject || "General";
    if (!bySubject[key]) bySubject[key] = [];
    if (g.percentage != null) bySubject[key].push(g.percentage);
  }
  const subjectAverages = Object.entries(bySubject).map(([subject, pcts]) => ({ subject, average: averagePercentages(pcts), count: pcts.length }));

  // Per-term averages
  const byTerm = {};
  for (const g of publishedGrades) {
    const key = g.term_name || "Unassigned";
    if (!byTerm[key]) byTerm[key] = [];
    if (g.percentage != null) byTerm[key].push(g.percentage);
  }
  const termAverages = Object.entries(byTerm).map(([term, pcts]) => ({ term, average: averagePercentages(pcts), count: pcts.length }));

  return {
    view: "admin",
    school_id,
    totals: {
      assessments: assessments.length,
      published_assessments: publishedAssessments,
      draft_assessments: draftAssessments,
      grades: grades.length,
      published_grades: publishedGrades.length,
      missing_grades: missingCount,
      classes: classes.length,
      teachers: teachers.length,
    },
    school_average: schoolAverage,
    grade_distribution: dist,
    class_averages: classAverages.sort((a, b) => (b.average || 0) - (a.average || 0)),
    subject_averages: subjectAverages.sort((a, b) => (b.average || 0) - (a.average || 0)),
    term_averages: termAverages,
    teacher_completion: teacherCompletion.sort((a, b) => b.assessment_count - a.assessment_count),
    grading_scales: scale.map(s => ({ id: s.id, name: s.name, active: s.active, bands: s.grade_bands })),
    terms: terms.map(t => ({ id: t.id, name: t.name, academic_year: t.academic_year, status: t.status, start_date: t.start_date, end_date: t.end_date })),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return safeJson({ ok: false, message: "Method not allowed" }, 405);

  try {
    const base44 = createClientFromRequest(req);
    const actor = await resolveEffectiveActor(base44);
    if (!actor.authorized) return safeJson({ ok: false, code: "FORBIDDEN", message: actor.reason || "Not authorised" }, actor.status || 403);

    const body = await req.json().catch(() => ({}));
    const svc = base44.asServiceRole;
    const role = actor.actor_role || "student";

    let data;
    if (role === "student") data = await studentView(svc, actor);
    else if (role === "teacher") data = await teacherGradebookView(svc, actor, body);
    else if (role === "admin") data = await adminView(svc, actor);
    else return safeJson({ ok: false, code: "FORBIDDEN", message: "Unknown role" }, 403);

    return safeJson({ ok: true, role, is_test_mode: !!actor.is_test_mode, data });
  } catch (err) {
    console.log(JSON.stringify({ step: "gradeData fatal", error: String(err?.message || err) }));
    return safeJson({ ok: false, code: "FATAL", message: err?.message || "Unknown error" }, 500);
  }
});