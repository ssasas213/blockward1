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
      const bws = await svc.entities.BlockWard.filter({ student_email: actor.actor_email }).catch(() => []);
      return { count: bws.length, blockwards: bws.slice(-10).reverse().map(b => ({ title: b.title, category: b.category, issued_by: b.issuer_name, date: b.minted_at })) };
    },
  },
  {
    name: "getMyAchievements", description: "Get the student's achievement records (submitted, pending, approved).", allowedRoles: ["student"],
    parameters: { type: "object", properties: {} },
    async run(_args, { svc, actor }) {
      const recs = await svc.entities.StudentRecord.filter({ student_email: actor.actor_email }).catch(() => []);
      return { count: recs.length, achievements: recs.slice(-10).reverse().map(r => ({ title: r.title, category: r.category, status: r.status, points: r.points, date: r.date_achieved })) };
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
      const students = profiles.filter(p => emails.includes(p.user_email)).map(p => ({ name: `${p.first_name || ""} ${p.last_name || ""}`.trim(), grade_level: p.grade_level }));
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
      const recs = await svc.entities.StudentRecord.filter({ teacher_email: actor.actor_email }).catch(() => []);
      const pending = recs.filter(r => PENDING_REVIEW_STATUSES.includes(r.status));
      return { pending_count: pending.length, pending: pending.slice(0, 10).map(r => ({ title: r.title, student: r.student_name, status: r.status, date: r.submitted_at })) };
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
];

const TOOL_LABELS = {
  getMyGrades: "my grades", getMyEvents: "events", getMyTimetable: "timetable", getMyBlockWards: "BlockWards", getMyAchievements: "achievements",
  getMyClasses: "my classes", getClassStudents: "class students", getClassGrades: "class grades", getPendingReviews: "pending reviews",
  getSchoolSummary: "school summary", getApprovalStats: "approval stats", getSchoolGradeStats: "grade stats",
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