import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { resolveEffectiveActor } from '../../shared/testMode.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "content-type": "application/json",
};

function safeJson(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: corsHeaders });
}

const PENDING_STATUSES = ["submitted", "awaiting_teacher_signature", "awaiting_admin_signature", "changes_requested"];

// ── Role-specific data loaders (server-side, scoped to actor's school) ──

async function loadStudentContext(svc, actor) {
  const { actor_email, school_id } = actor;
  const [allClasses, events, announcements, points, records, blockwards] = await Promise.all([
    svc.entities.Class.filter({ school_id }).catch(() => []),
    svc.entities.Event.filter({ school_id }).catch(() => []),
    svc.entities.Announcement.filter({ school_id }).catch(() => []),
    svc.entities.PointEntry.filter({ student_email: actor_email }).catch(() => []),
    svc.entities.StudentRecord.filter({ student_email: actor_email }).catch(() => []),
    svc.entities.BlockWard.filter({ student_email: actor_email }).catch(() => []),
  ]);

  const myClasses = allClasses.filter(c => (c.student_emails || []).includes(actor_email));
  const classIds = myClasses.map(c => c.id);
  const timetableEntries = classIds.length
    ? (await svc.entities.TimetableEntry.filter({ school_id }).catch(() => [])).filter(t => classIds.includes(t.class_id))
    : [];

  const now = new Date();
  const upcomingEvents = events
    .filter(e => e.start_time && new Date(e.start_time) >= now)
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
    .slice(0, 8);
  const visibleAnnouncements = announcements
    .filter(a => a.scope_type === "SCHOOL" || (a.student_emails || []).includes(actor_email))
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
    .slice(0, 6);

  const pending = records.filter(r => PENDING_STATUSES.includes(r.status));
  const achievementPoints = points.filter(p => p.type === "achievement").reduce((s, p) => s + (Number(p.points) || 0), 0);
  const behaviourPoints = points.filter(p => p.type === "behaviour").reduce((s, p) => s + (Number(p.points) || 0), 0);
  const recentRecords = records.slice(-6).reverse();

  return {
    role: "student",
    actor_name: `${actor.first_name || ""} ${actor.last_name || ""}`.trim(),
    classes: myClasses.map(c => ({ name: c.name, subject: c.subject, teacher: c.teacher_email })),
    timetable: timetableEntries.map(t => ({ class_name: t.class_name, subject: t.subject, day: t.day_of_week, start: t.start_time, end: t.end_time, room: t.room })),
    upcoming_events: upcomingEvents.map(e => ({ title: e.title, start: e.start_time, location: e.location, audience: e.audience })),
    announcements: visibleAnnouncements.map(a => ({ title: a.title, priority: a.priority, sent_at: a.sent_at || a.created_date })),
    points: { achievement: achievementPoints, behaviour: behaviourPoints },
    achievements: recentRecords.map(r => ({ title: r.title, category: r.category, status: r.status, points: r.points, date: r.date_achieved })),
    pending: pending.map(r => ({ title: r.title, status: r.status })),
    blockwards_count: blockwards.length,
  };
}

async function loadTeacherContext(svc, actor) {
  const { actor_email, school_id } = actor;
  const [allClasses, records, points, blockwards] = await Promise.all([
    svc.entities.Class.filter({ school_id }).catch(() => []),
    svc.entities.StudentRecord.filter({ teacher_email: actor_email }).catch(() => []),
    svc.entities.PointEntry.filter({ teacher_email: actor_email }).catch(() => []),
    svc.entities.BlockWard.filter({ issuer_email: actor_email }).catch(() => []),
  ]);

  const myClasses = allClasses.filter(c => c.teacher_email === actor_email || (c.co_teachers || []).includes(actor_email));
  const myStudentEmails = Array.from(new Set(myClasses.flatMap(c => c.student_emails || [])));

  const studentPoints = {};
  for (const p of points) {
    if (p.type !== "achievement") continue;
    if (!myStudentEmails.includes(p.student_email)) continue;
    if (!studentPoints[p.student_email]) studentPoints[p.student_email] = { name: p.student_name || p.student_email, points: 0, blockwards: 0 };
    studentPoints[p.student_email].points += Number(p.points) || 0;
  }
  const studentBlockwards = {};
  if (myStudentEmails.length) {
    const allBlockwards = await svc.entities.BlockWard.filter({ school_id }).catch(() => []);
    for (const b of allBlockwards) {
      if (myStudentEmails.includes(b.student_email)) studentBlockwards[b.student_email] = (studentBlockwards[b.student_email] || 0) + 1;
    }
  }
  const topStudents = Object.values(studentPoints)
    .map(s => ({ ...s, blockwards: studentBlockwards[s.name] || 0 }))
    .sort((a, b) => b.points - a.points)
    .slice(0, 5);

  const pending = records.filter(r => ["awaiting_admin_signature", "changes_requested"].includes(r.status));
  const catCounts = {};
  for (const r of records) catCounts[r.category || "other"] = (catCounts[r.category || "other"] || 0) + 1;
  const achievementPoints = points.filter(p => p.type === "achievement").reduce((s, p) => s + (Number(p.points) || 0), 0);

  return {
    role: "teacher",
    actor_name: `${actor.first_name || ""} ${actor.last_name || ""}`.trim(),
    classes: myClasses.map(c => ({ name: c.name, subject: c.subject, student_count: (c.student_emails || []).length })),
    student_count: myStudentEmails.length,
    achievements_issued: records.length,
    blockwards_issued: blockwards.length,
    achievement_points_issued: achievementPoints,
    pending_reviews: pending.length,
    top_students: topStudents,
    pending: pending.slice(0, 6).map(r => ({ title: r.title, student: r.student_name, status: r.status })),
    categories_issued: catCounts,
    note: "Attendance data is not currently tracked in BlockWard; attendance-based rankings are unavailable.",
  };
}

async function loadAdminContext(svc, actor) {
  const { school_id } = actor;
  const [profiles, records, points, blockwards, classes] = await Promise.all([
    svc.entities.UserProfile.filter({ school_id }).catch(() => []),
    svc.entities.StudentRecord.filter({ school_id }).catch(() => []),
    svc.entities.PointEntry.filter({ school_id }).catch(() => []),
    svc.entities.BlockWard.filter({ school_id }).catch(() => []),
    svc.entities.Class.filter({ school_id }).catch(() => []),
  ]);

  const students = profiles.filter(p => p.user_type === "student");
  const teacherProfiles = profiles.filter(p => p.user_type === "teacher");

  const statusCounts = {};
  for (const r of records) statusCounts[r.status || "unknown"] = (statusCounts[r.status || "unknown"] || 0) + 1;
  const catCounts = {};
  for (const r of records) catCounts[r.category || "other"] = (catCounts[r.category || "other"] || 0) + 1;

  const pending = records.filter(r => ["submitted", "awaiting_admin_signature", "changes_requested"].includes(r.status));
  let approvalMs = 0, approvalN = 0;
  for (const r of records) {
    if (r.approved_at && r.submitted_at) {
      const ms = new Date(r.approved_at).getTime() - new Date(r.submitted_at).getTime();
      if (ms > 0 && ms < 1000 * 60 * 60 * 24 * 90) { approvalMs += ms; approvalN++; }
    }
  }
  const avgApprovalDays = approvalN ? Math.round((approvalMs / approvalN) / (1000 * 60 * 60 * 24) * 10) / 10 : null;

  const teacherActivity = {};
  for (const r of records) {
    const t = r.teacher_email || "unknown";
    teacherActivity[t] = (teacherActivity[t] || 0) + 1;
  }
  const topTeachers = Object.entries(teacherActivity).map(([email, count]) => ({ email, count })).sort((a, b) => b.count - a.count).slice(0, 5);

  const achievementPoints = points.filter(p => p.type === "achievement").reduce((s, p) => s + (Number(p.points) || 0), 0);
  const behaviourPoints = points.filter(p => p.type === "behaviour").reduce((s, p) => s + (Number(p.points) || 0), 0);

  const studentsWithBlockward = new Set(blockwards.map(b => b.student_email));
  const studentsNoBlockward = students.filter(s => !studentsWithBlockward.has(s.user_email)).length;

  return {
    role: "admin",
    school_id,
    students: students.length,
    teachers: teacherProfiles.length,
    classes: classes.length,
    achievements_total: records.length,
    blockwards_delivered: blockwards.length,
    achievement_points: achievementPoints,
    behaviour_points: behaviourPoints,
    pending_approvals: pending.length,
    avg_approval_days: avgApprovalDays,
    records_by_status: statusCounts,
    records_by_category: catCounts,
    top_teachers: topTeachers,
    students_no_blockward: studentsNoBlockward,
    note: "Attendance data is not currently tracked in BlockWard; attendance overview is unavailable.",
  };
}

const SYSTEM_PROMPTS = {
  student: `You are BlockWard AI, a concise personal school assistant for a student. Answer ONLY using the provided data. Never invent events, deadlines, classes, points, or achievements. If data is missing or empty, say so plainly (e.g. "No upcoming events are currently listed."). Be friendly but concise — use short paragraphs or compact lists. Address the student by first name. Do not expose internal IDs. Today is ${new Date().toDateString()}.`,
  teacher: `You are BlockWard AI, a concise analytics assistant for a teacher. Answer ONLY using the provided data about YOUR classes and students. Never invent scores, attendance, or rankings. If data is insufficient (e.g. no attendance data), say so explicitly rather than guessing. Be concise and useful — use compact ranked lists with the data basis shown. Do not expose internal IDs. Do not analyse students outside the teacher's classes. Today is ${new Date().toDateString()}. Any report-style answer must be labelled "AI Draft — Review Before Sending".`,
  admin: `You are BlockWard AI, a concise executive assistant for a school administrator. Answer ONLY using the provided school-wide data. Never invent metrics. If a metric is unavailable (e.g. attendance), say so. Be concise — use compact lists and totals. Do not expose internal IDs. Any report-style answer must be labelled "AI-generated draft — verify before official use". Today is ${new Date().toDateString()}.`,
};

const QUICK_ACTIONS = {
  student: ["What's happening this week?", "Summarise my timetable", "How many BlockWards have I earned?", "What achievements are still pending?", "What are my current points?"],
  teacher: ["Who are my top students?", "Summarise my class performance", "What submissions need my review?", "Suggest students to recognise", "How many BlockWards have I issued?"],
  admin: ["Give me a school summary", "What's pending approval?", "Which teachers issue the most achievements?", "Which students have no BlockWards?", "Summarise school activity"],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return safeJson({ ok: false, message: "Method not allowed" }, 405);

  try {
    const base44 = createClientFromRequest(req);

    const actor = await resolveEffectiveActor(base44);
    if (!actor.authorized) return safeJson({ ok: false, code: "FORBIDDEN", message: actor.reason || "Not authorised" }, actor.status || 403);

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";
    const AI_MODEL = Deno.env.get("AI_MODEL") || "gpt-4o-mini";
    if (!OPENAI_API_KEY) return safeJson({ ok: false, code: "MISSING_SECRET", message: "OPENAI_API_KEY not set" });

    const body = await req.json().catch(() => ({}));
    const message = String(body?.message || "").trim();
    if (!message) return safeJson({ ok: false, code: "MISSING_FIELD", message: "message is required" });

    const svc = base44.asServiceRole;
    const role = actor.actor_role || "student";

    let context;
    if (role === "student") context = await loadStudentContext(svc, actor);
    else if (role === "teacher") context = await loadTeacherContext(svc, actor);
    else if (role === "admin") context = await loadAdminContext(svc, actor);
    else return safeJson({ ok: false, code: "FORBIDDEN", message: "Unknown role" }, 403);

    const systemPrompt = SYSTEM_PROMPTS[role];
    const userMsg = `User question: ${message}\n\nAuthorised data for this user (role: ${role}):\n${JSON.stringify(context, null, 2)}\n\nAnswer concisely using ONLY this data. If the answer cannot be derived from this data, say what's missing.`;

    const oaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: AI_MODEL, temperature: 0.2, max_tokens: 500, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMsg }] }),
    });
    const oaiData = await oaiRes.json().catch(() => null);
    if (!oaiRes.ok) return safeJson({ ok: false, code: "OPENAI_ERROR", message: `OpenAI error (${oaiRes.status})` });

    const answer = oaiData?.choices?.[0]?.message?.content || "No response from AI.";

    const sourcesByRole = {
      student: ["classes", "timetable", "events", "announcements", "points", "achievements", "BlockWards"],
      teacher: ["my classes", "issued points", "issued achievements", "issued BlockWards", "pending submissions"],
      admin: ["user profiles", "achievement records", "points", "BlockWards", "classes"],
    };

    return safeJson({
      ok: true,
      role,
      answer,
      data_sources: sourcesByRole[role],
      quick_actions: QUICK_ACTIONS[role],
      is_test_mode: !!actor.is_test_mode,
    });

  } catch (err) {
    console.log(JSON.stringify({ step: "fatal", error: String(err?.message || err) }));
    return safeJson({ ok: false, code: "FATAL", message: err?.message || "Unknown error" }, 500);
  }
});