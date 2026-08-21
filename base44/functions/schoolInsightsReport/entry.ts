import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "content-type": "application/json",
};

function safeJson(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: corsHeaders });
}

function monthKey(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return safeJson({ ok: false, message: "Method not allowed" }, 405);

  try {
    const base44 = createClientFromRequest(req);

    // Auth
    let user = null;
    try { user = await base44.auth.me(); } catch (_) {}
    if (!user) return safeJson({ ok: false, code: "UNAUTHORIZED", message: "Not authenticated" }, 401);

    // Load profile
    let profile = null;
    try {
      const profiles = await base44.entities.UserProfile.filter({ user_email: user.email });
      profile = profiles[0] || null;
    } catch (_) {}

    const schoolId = profile?.school_id || null;
    const userType = profile?.user_type || "teacher";

    if (userType !== "admin") {
      return safeJson({ ok: false, code: "FORBIDDEN", message: "Only admins can generate school reports" }, 403);
    }
    if (!schoolId) {
      return safeJson({ ok: false, code: "NO_SCHOOL", message: "No active school found for your account" }, 400);
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";
    const AI_MODEL = Deno.env.get("AI_MODEL") || "gpt-4o-mini";
    if (!OPENAI_API_KEY) return safeJson({ ok: false, code: "MISSING_SECRET", message: "OPENAI_API_KEY not set" });

    // ── Aggregate school-wide data (service role to read across all students) ──
    const svc = base44.asServiceRole;

    const [allProfiles, records, points, blockwards, classes] = await Promise.all([
      svc.entities.UserProfile.filter({ school_id: schoolId }).catch(() => []),
      svc.entities.StudentRecord.filter({ school_id: schoolId }).catch(() => []),
      svc.entities.PointEntry.filter({ school_id: schoolId }).catch(() => []),
      svc.entities.BlockWard.filter({ school_id: schoolId }).catch(() => []),
      svc.entities.Class.filter({ school_id: schoolId }).catch(() => []),
    ]);

    // People
    const students = allProfiles.filter(p => p.user_type === "student");
    const teachers = allProfiles.filter(p => p.user_type === "teacher");
    const admins = allProfiles.filter(p => p.user_type === "admin");

    // Achievement records by status
    const statusCounts = {};
    for (const r of records) {
      const s = r.status || "unknown";
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    }

    // Achievements by category
    const categoryCounts = {};
    for (const r of records) {
      const c = r.category || "other";
      categoryCounts[c] = (categoryCounts[c] || 0) + 1;
    }

    // Points: achievement vs behaviour
    let achievementPoints = 0;
    let behaviourPoints = 0;
    for (const p of points) {
      if (p.type === "achievement") achievementPoints += Number(p.points) || 0;
      else if (p.type === "behaviour") behaviourPoints += Number(p.points) || 0;
    }

    // Top performers (by student achievement points)
    const pointsByStudent = {};
    for (const p of points) {
      if (p.type !== "achievement") continue;
      const key = p.student_email || "unknown";
      if (!pointsByStudent[key]) pointsByStudent[key] = { email: p.student_email, name: p.student_name || p.student_email, points: 0 };
      pointsByStudent[key].points += Number(p.points) || 0;
    }
    const topPerformers = Object.values(pointsByStudent)
      .sort((a, b) => b.points - a.points)
      .slice(0, 5)
      .map(s => ({ name: s.name, points: s.points }));

    // Trend: achievements approved/delivered per month (last 6 months)
    const trend = {};
    for (const r of records) {
      const k = monthKey(r.submitted_at || r.created_date);
      if (!k) continue;
      trend[k] = (trend[k] || 0) + 1;
    }
    const trendSorted = Object.entries(trend)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)
      .map(([month, count]) => ({ month, count }));

    // Behaviour to achievement ratio
    const ratio = achievementPoints > 0
      ? Math.round((behaviourPoints / achievementPoints) * 100) / 100
      : (behaviourPoints > 0 ? 1 : 0);

    const stats = {
      school_name: undefined, // filled below
      generated_at: new Date().toISOString(),
      totals: {
        students: students.length,
        teachers: teachers.length,
        admins: admins.length,
        classes: classes.length,
        achievement_records: records.length,
        blockwards_minted: blockwards.length,
        achievement_points: achievementPoints,
        behaviour_points: behaviourPoints,
        behaviour_to_achievement_ratio: ratio,
      },
      records_by_status: statusCounts,
      records_by_category: categoryCounts,
      achievement_trend: trendSorted,
      top_performers: topPerformers,
    };

    // Resolve school name
    let schoolName = "Your School";
    try {
      const schools = await svc.entities.School.filter({ id: schoolId });
      if (schools[0]?.name) schoolName = schools[0].name;
    } catch (_) {}
    stats.school_name = schoolName;

    // ── AI narrative insights ──
    const systemPrompt = `You are a senior school data analyst. You are given aggregated, anonymised school data in JSON. Write an insightful report for a school administrator. Be honest, specific, and actionable. Do NOT invent numbers — only use the data given. Structure your response as valid JSON with these keys:
- executive_summary: 2-3 sentence overview
- highlights: array of 3-4 short strings noting positives
- concerns: array of 0-3 short strings noting areas needing attention
- recommendations: array of 3-4 short actionable strings
- category_insight: 1-2 sentences on the achievement category mix`;

    const userMsg = `School: ${schoolName}
Generated at: ${stats.generated_at}

Aggregated data:
${JSON.stringify(stats, null, 2)}

Write the report as JSON only.`;

    let narrative = null;
    try {
      const oaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: AI_MODEL,
          temperature: 0.3,
          max_tokens: 700,
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMsg }],
        }),
      });
      const oaiData = await oaiRes.json().catch(() => null);
      if (oaiRes.ok && oaiData?.choices?.[0]?.message?.content) {
        const raw = oaiData.choices[0].message.content;
        const start = raw.indexOf("{");
        const end = raw.lastIndexOf("}");
        if (start >= 0 && end > start) {
          narrative = JSON.parse(raw.slice(start, end + 1));
        } else {
          narrative = { executive_summary: raw, highlights: [], concerns: [], recommendations: [], category_insight: "" };
        }
      }
    } catch (_) {}

    return safeJson({
      ok: true,
      stats,
      narrative,
    });

  } catch (err) {
    console.log(JSON.stringify({ step: "fatal", error: String(err?.message || err) }));
    return safeJson({ ok: false, code: "FATAL", message: err?.message || "Unknown error" }, 500);
  }
});