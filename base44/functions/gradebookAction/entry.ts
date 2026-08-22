import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { resolveEffectiveActor } from '../../shared/testMode.ts';
import { calcPercentage, calcGrade } from '../../shared/gradeCalc.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "content-type": "application/json",
};
const safeJson = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: corsHeaders });

async function notifyStudents(svc, school_id, emails, title, body, type, related_id) {
  if (!emails?.length) return;
  const unique = [...new Set(emails.filter(Boolean))];
  const records = unique.map(user_email => ({
    user_email, school_id, title, body, type: type || "message", priority: "normal", related_id: related_id || null, read: false,
  }));
  await svc.entities.Notification.bulkCreate(records).catch(() => {});
}

async function getActiveScale(svc, school_id) {
  const scales = await svc.entities.GradingScale.filter({ school_id, active: true }).catch(() => []);
  return scales[0] || null;
}

// Verify the actor owns the class the assessment belongs to (or is admin).
async function verifyClassOwnership(svc, actor, classId) {
  if (actor.actor_role === "admin") return { ok: true };
  const classes = await svc.entities.Class.filter({ school_id: actor.school_id }).catch(() => []);
  const cls = classes.find(c => c.id === classId);
  if (!cls) return { ok: false, reason: "Class not found", status: 404 };
  if (cls.teacher_email === actor.actor_email || (cls.co_teachers || []).includes(actor.actor_email)) return { ok: true, cls };
  return { ok: false, reason: "You do not teach this class", status: 403 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return safeJson({ ok: false, message: "Method not allowed" }, 405);

  try {
    const base44 = createClientFromRequest(req);
    const actor = await resolveEffectiveActor(base44);
    if (!actor.authorized) return safeJson({ ok: false, code: "FORBIDDEN", message: actor.reason || "Not authorised" }, actor.status || 403);

    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const { school_id, actor_email, actor_id } = actor;
    const teacherName = `${actor.first_name || ""} ${actor.last_name || ""}`.trim();
    const role = actor.actor_role;

    if (role === "student") return safeJson({ ok: false, code: "FORBIDDEN", message: "Students cannot modify grades" }, 403);

    // ── CREATE ASSESSMENT ──
    if (action === "create_assessment") {
      const { class_id, title, assessment_type, max_score, date, due_date, attachment_url, term_id, term_name, description, weighting } = body;
      if (!class_id || !title || !assessment_type || max_score == null) {
        return safeJson({ ok: false, code: "MISSING_FIELD", message: "class_id, title, assessment_type, max_score required" }, 400);
      }
      const own = await verifyClassOwnership(svc, actor, class_id);
      if (!own.ok) return safeJson({ ok: false, code: "FORBIDDEN", message: own.reason }, own.status || 403);

      const classes = await svc.entities.Class.filter({ school_id }).catch(() => []);
      const cls = classes.find(c => c.id === class_id);
      const assessment = await svc.entities.Assessment.create({
        school_id, class_id, class_name: cls?.name, subject: cls?.subject,
        teacher_email: actor_email, teacher_id: actor_id, teacher_name: teacherName,
        title, description, assessment_type,
        date: date || new Date().toISOString().slice(0, 10),
        due_date: due_date || null,
        attachment_url: attachment_url || null,
        term_id: term_id || null, term_name: term_name || null,
        max_score: Number(max_score), weighting: weighting != null ? Number(weighting) : null,
        status: "draft", created_by: actor_email,
      });

      // Notify enrolled students of a new assignment/homework
      if (["homework", "assignment", "revision", "coursework", "project"].includes(assessment_type) && (cls?.student_emails?.length)) {
        await notifyStudents(svc, school_id, cls.student_emails, "New assignment", `New ${cls.subject || cls.name} assignment — ${title}${due_date ? ` due ${due_date}` : ""}.`, "announcement_important", assessment.id).catch(() => {});
      }
      return safeJson({ ok: true, assessment });
    }

    // ── EDIT ASSESSMENT ──
    if (action === "edit_assessment") {
      const { assessment_id, title, description, due_date, attachment_url, date, max_score, weighting } = body;
      if (!assessment_id) return safeJson({ ok: false, code: "MISSING_FIELD", message: "assessment_id required" }, 400);
      const assessments = await svc.entities.Assessment.filter({ school_id }).catch(() => []);
      const assessment = assessments.find(a => a.id === assessment_id);
      if (!assessment) return safeJson({ ok: false, code: "NOT_FOUND", message: "Assessment not found" }, 404);
      const own = await verifyClassOwnership(svc, actor, assessment.class_id);
      if (!own.ok) return safeJson({ ok: false, code: "FORBIDDEN", message: own.reason }, own.status || 403);
      const patch = {};
      if (title != null) patch.title = title;
      if (description != null) patch.description = description;
      if (due_date !== undefined) patch.due_date = due_date || null;
      if (attachment_url !== undefined) patch.attachment_url = attachment_url || null;
      if (date != null) patch.date = date;
      if (max_score != null) patch.max_score = Number(max_score);
      if (weighting !== undefined) patch.weighting = weighting != null ? Number(weighting) : null;
      const updated = await svc.entities.Assessment.update(assessment_id, patch);
      return safeJson({ ok: true, assessment: updated });
    }

    // ── SAVE / EDIT GRADE ──
    if (action === "save_grade") {
      const { assessment_id, student_email, raw_score, teacher_comment } = body;
      if (!assessment_id || !student_email || raw_score == null) {
        return safeJson({ ok: false, code: "MISSING_FIELD", message: "assessment_id, student_email, raw_score required" }, 400);
      }
      const assessments = await svc.entities.Assessment.filter({ school_id }).catch(() => []);
      const assessment = assessments.find(a => a.id === assessment_id);
      if (!assessment) return safeJson({ ok: false, code: "NOT_FOUND", message: "Assessment not found" }, 404);

      const own = await verifyClassOwnership(svc, actor, assessment.class_id);
      if (!own.ok) return safeJson({ ok: false, code: "FORBIDDEN", message: own.reason }, own.status || 403);

      const scale = await getActiveScale(svc, school_id);
      const bands = scale?.grade_bands || null;
      const maxScore = Number(assessment.max_score);
      const score = Number(raw_score);
      const percentage = calcPercentage(score, maxScore);
      const gradeValue = calcGrade(percentage, bands);

      // Find existing grade for this student+assessment
      const existing = await svc.entities.StudentGrade.filter({ school_id, assessment_id, student_email }).catch(() => []);
      const prev = existing[0];

      // Audit if editing an already-published grade and the score changed
      if (prev && prev.status === "published" && Number(prev.raw_score) !== score) {
        await svc.entities.GradeAudit.create({
          school_id, grade_id: prev.id, assessment_title: assessment.title,
          student_name: prev.student_name || student_email,
          old_score: Number(prev.raw_score), new_score: score,
          old_percentage: prev.percentage, new_percentage: percentage,
          changed_by_email: actor_email, changed_by_name: teacherName,
          reason: body.reason || "Grade correction",
          timestamp: new Date().toISOString(),
        }).catch(() => {});
      }

      const classes = await svc.entities.Class.filter({ school_id }).catch(() => []);
      const cls = classes.find(c => c.id === assessment.class_id);
      const profiles = await svc.entities.UserProfile.filter({ school_id, user_email: student_email }).catch(() => []);
      const stuProfile = profiles[0];
      const studentName = stuProfile ? `${stuProfile.first_name || ""} ${stuProfile.last_name || ""}`.trim() : student_email;

      const gradeData = {
        school_id, student_email, student_id: stuProfile?.id, student_name: studentName,
        assessment_id, assessment_title: assessment.title, assessment_type: assessment.assessment_type,
        assessment_date: assessment.date, class_id: assessment.class_id, class_name: cls?.name,
        subject: cls?.subject || assessment.subject,
        teacher_email: actor_email, teacher_id: actor_id, teacher_name: teacherName,
        term_id: assessment.term_id, term_name: assessment.term_name,
        raw_score: score, max_score: maxScore, percentage, grade_value: gradeValue,
        teacher_comment: teacher_comment || null,
      };

      let grade;
      if (prev) {
        grade = await svc.entities.StudentGrade.update(prev.id, gradeData);
      } else {
        grade = await svc.entities.StudentGrade.create({ ...gradeData, status: "draft" });
      }
      return safeJson({ ok: true, grade });
    }

    // ── PUBLISH ASSESSMENT (+ its draft grades) ──
    if (action === "publish_assessment") {
      const { assessment_id } = body;
      if (!assessment_id) return safeJson({ ok: false, code: "MISSING_FIELD", message: "assessment_id required" }, 400);
      const assessments = await svc.entities.Assessment.filter({ school_id }).catch(() => []);
      const assessment = assessments.find(a => a.id === assessment_id);
      if (!assessment) return safeJson({ ok: false, code: "NOT_FOUND", message: "Assessment not found" }, 404);
      const own = await verifyClassOwnership(svc, actor, assessment.class_id);
      if (!own.ok) return safeJson({ ok: false, code: "FORBIDDEN", message: own.reason }, own.status || 403);

      const now = new Date().toISOString();
      await svc.entities.Assessment.update(assessment_id, { status: "published", published_at: now, published_by: actor_email });
      // Publish all draft grades for this assessment
      const draftGrades = await svc.entities.StudentGrade.filter({ school_id, assessment_id, status: "draft" }).catch(() => []);
      if (draftGrades.length) {
        await svc.entities.StudentGrade.bulkUpdate(draftGrades.map(g => ({ id: g.id, status: "published", published_at: now, published_by: actor_email })));
      }
      // Notify each graded student that their grade has been published
      const classes = await svc.entities.Class.filter({ school_id }).catch(() => []);
      const cls = classes.find(c => c.id === assessment.class_id);
      const notifiedEmails = new Set(draftGrades.map(g => g.student_email));
      const recipientEmails = [...notifiedEmails];
      if (recipientEmails.length && cls?.student_emails?.length) {
        // Notify all enrolled students (even ungraded) that the assessment is published
        for (const email of cls.student_emails) {
          if (!recipientEmails.includes(email)) recipientEmails.push(email);
        }
      }
      if (recipientEmails.length) {
        await notifyStudents(svc, school_id, recipientEmails, "Grade published", `Your ${assessment.title} grade has been published.`, "message", assessment_id).catch(() => {});
      }
      return safeJson({ ok: true, published_grades: draftGrades.length });
    }

    // ── UNPUBLISH ASSESSMENT (admin only) ──
    if (action === "unpublish_assessment") {
      const { assessment_id } = body;
      if (role !== "admin") return safeJson({ ok: false, code: "FORBIDDEN", message: "Only admins can unpublish" }, 403);
      if (!assessment_id) return safeJson({ ok: false, code: "MISSING_FIELD", message: "assessment_id required" }, 400);
      await svc.entities.Assessment.update(assessment_id, { status: "draft", published_at: null, published_by: null });
      await svc.entities.StudentGrade.updateMany({ school_id, assessment_id, status: "published" }, { $set: { status: "draft", published_at: null, published_by: null } }).catch(() => {});
      return safeJson({ ok: true });
    }

    // ── DELETE ASSESSMENT ──
    if (action === "delete_assessment") {
      const { assessment_id } = body;
      if (!assessment_id) return safeJson({ ok: false, code: "MISSING_FIELD", message: "assessment_id required" }, 400);
      const assessments = await svc.entities.Assessment.filter({ school_id }).catch(() => []);
      const assessment = assessments.find(a => a.id === assessment_id);
      if (!assessment) return safeJson({ ok: false, code: "NOT_FOUND", message: "Assessment not found" }, 404);
      const own = await verifyClassOwnership(svc, actor, assessment.class_id);
      if (!own.ok) return safeJson({ ok: false, code: "FORBIDDEN", message: own.reason }, own.status || 403);

      const gradeList = await svc.entities.StudentGrade.filter({ school_id, assessment_id }).catch(() => []);
      for (const g of gradeList) await svc.entities.StudentGrade.delete(g.id).catch(() => {});
      await svc.entities.Assessment.delete(assessment_id);
      return safeJson({ ok: true, deleted_grades: gradeList.length });
    }

    return safeJson({ ok: false, code: "UNKNOWN_ACTION", message: `Unknown action: ${action}` }, 400);
  } catch (err) {
    console.log(JSON.stringify({ step: "gradebookAction fatal", error: String(err?.message || err) }));
    return safeJson({ ok: false, code: "FATAL", message: err?.message || "Unknown error" }, 500);
  }
});