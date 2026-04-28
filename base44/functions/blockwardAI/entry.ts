import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "content-type": "application/json",
};

function makeDebugId() {
  return `bwai_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function safeJson(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: corsHeaders });
}

function parseDateRange(message, dateStr) {
  const now = dateStr ? new Date(dateStr) : new Date();
  const q = (message || "").toLowerCase();

  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
  const endOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
  const startOfWeek = (d) => {
    const day = d.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    const monday = new Date(d);
    monday.setDate(d.getDate() + diff);
    return startOfDay(monday);
  };
  const endOfWeek = (d) => {
    const s = startOfWeek(d);
    const sunday = new Date(s);
    sunday.setDate(s.getDate() + 6);
    return endOfDay(sunday);
  };

  let start = startOfDay(now);
  let end = endOfDay(now);
  let label = "today";

  if (q.includes("tomorrow")) {
    const t = new Date(now); t.setDate(now.getDate() + 1);
    start = startOfDay(t); end = endOfDay(t); label = "tomorrow";
  } else if (q.includes("next week")) {
    const n = new Date(now); n.setDate(now.getDate() + 7);
    start = startOfWeek(n); end = endOfWeek(n); label = "next week";
  } else if (q.includes("this week") || q.includes("week")) {
    start = startOfWeek(now); end = endOfWeek(now); label = "this week";
  }

  return { start, end, label };
}

Deno.serve(async (req) => {
  const debugId = makeDebugId();
  const t0 = Date.now();

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return safeJson({ ok: false, debugId, message: "Method not allowed" }, 405);

  try {
    const base44 = createClientFromRequest(req);

    // Auth
    let user = null;
    try { user = await base44.auth.me(); } catch (_) {}
    if (!user) return safeJson({ ok: false, debugId, code: "UNAUTHORIZED", message: "Not authenticated" }, 401);

    // Load user profile for school/role context
    let profile = null;
    try {
      const profiles = await base44.entities.UserProfile.filter({ user_email: user.email });
      profile = profiles[0] || null;
    } catch (_) {}

    const schoolId = profile?.school_id || null;
    const userType = profile?.user_type || "teacher";

    const body = await req.json().catch(() => ({}));
    const tool = String(body?.tool || "ASK_SCHEDULE").toUpperCase();
    const message = String(body?.message || "").trim();
    const dateStr = body?.date || null;
    const scope = body?.scope || { type: "SCHOOL" };
    const tone = body?.tone || "Friendly";
    const draftTarget = body?.draftTarget || {};

    console.log(JSON.stringify({ debugId, userId: user.email, role: userType, schoolId, tool, ms: Date.now() - t0 }));

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";
    const AI_MODEL = Deno.env.get("AI_MODEL") || "gpt-4o-mini";

    if (!OPENAI_API_KEY) return safeJson({ ok: false, debugId, code: "MISSING_SECRET", message: "OPENAI_API_KEY not set" });

    // ── ASK SCHEDULE ──────────────────────────────────────────────
    if (tool === "ASK_SCHEDULE") {
      if (!message) return safeJson({ ok: false, debugId, code: "MISSING_FIELD", message: "message is required" });

      const range = parseDateRange(message, dateStr);
      console.log(JSON.stringify({ debugId, step: "date_range", label: range.label }));

      // Query events - scope to school
      let events = [];
      try {
        const allEvents = schoolId
          ? await base44.asServiceRole.entities.Event.filter({ school_id: schoolId })
          : await base44.asServiceRole.entities.Event.list();

        events = allEvents.filter(ev => {
          if (!ev.start_time) return false;
          const evStart = new Date(ev.start_time);
          return evStart >= range.start && evStart <= range.end;
        });

        // Scope filter
        if (scope.type === "YEAR_GROUP" && scope.id) {
          events = events.filter(ev => ev.audience === scope.id || ev.audience === "whole_school");
        } else if (scope.type === "CLASS" && scope.id) {
          events = events.filter(ev => ev.audience_class_id === scope.id || ev.audience === "whole_school");
        } else if (scope.type === "MY_CLASSES") {
          // teacher sees their classes + school-wide
          const memberships = await base44.entities.StaffMembership.filter({ user_email: user.email });
          const classIds = memberships[0]?.class_ids || [];
          events = events.filter(ev =>
            ev.audience === "whole_school" ||
            ev.audience === "staff_only" ||
            (ev.audience_class_id && classIds.includes(ev.audience_class_id))
          );
        }
      } catch (e) {
        console.log(JSON.stringify({ debugId, step: "events_error", error: String(e?.message) }));
        return safeJson({ ok: false, debugId, code: "EVENTS_ERROR", message: "Could not load events: " + String(e?.message) });
      }

      const normalized = events.map(ev => ({
        title: ev.title,
        start_time: ev.start_time,
        end_time: ev.end_time || null,
        location: ev.location || null,
        audience: ev.audience || null,
        notes: ev.notes || null,
      }));

      console.log(JSON.stringify({ debugId, step: "events_found", count: normalized.length }));

      if (normalized.length === 0) {
        return safeJson({ ok: true, debugId, answer: `No events found for ${range.label}. The school calendar appears to be empty for this period.`, events: [] });
      }

      const userName = profile ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() : user.email;
      const roleDesc = userType === "student" ? "student" : userType === "admin" ? "school administrator" : "teacher";
      const systemPrompt = `You are a friendly, personalised school assistant called BlockWard AI. You are speaking directly to ${userName || "the user"}, who is a ${roleDesc}. Answer their question ONLY using the events data provided. Do NOT invent or guess events. Be warm, personal, and address them by first name (${profile?.first_name || ""}). Today is ${new Date().toDateString()}.`;
      const userMsg = `${userName}'s question: ${message}\n\nEvents for ${range.label}:\n${JSON.stringify(normalized, null, 2)}\n\nAnswer personally and concisely, addressing them by name.`;

      const oaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: AI_MODEL, temperature: 0.1, max_tokens: 400, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMsg }] }),
      });

      const oaiData = await oaiRes.json().catch(() => null);
      if (!oaiRes.ok) return safeJson({ ok: false, debugId, code: "OPENAI_ERROR", message: `OpenAI error (${oaiRes.status})` });

      const answer = oaiData?.choices?.[0]?.message?.content || "No response from AI.";
      console.log(JSON.stringify({ debugId, step: "done", ms: Date.now() - t0 }));
      return safeJson({ ok: true, debugId, answer, events: normalized });
    }

    // ── DRAFT ANNOUNCEMENT ────────────────────────────────────────
    if (tool === "DRAFT_ANNOUNCEMENT") {
      if (!message) return safeJson({ ok: false, debugId, code: "MISSING_FIELD", message: "message is required" });

      // Permission check: students cannot draft
      if (userType === "student") return safeJson({ ok: false, debugId, code: "FORBIDDEN", message: "Students cannot draft announcements" }, 403);

      // Check if teacher is trying SCHOOL scope
      const targetType = draftTarget?.type || "CLASS";
      if (targetType === "SCHOOL" && userType === "teacher") {
        return safeJson({ ok: false, debugId, code: "FORBIDDEN", message: "Teachers cannot send school-wide announcements" }, 403);
      }

      const toneMap = {
        "Friendly": "warm, friendly, and encouraging",
        "Formal": "professional and formal",
        "Short": "brief and direct, 2-3 sentences max",
        "Urgent": "urgent and important-sounding",
      };
      const toneDesc = toneMap[tone] || "friendly";

      const targetDesc = draftTarget?.description
        ? draftTarget.description
        : targetType === "SCHOOL" ? "the whole school"
        : targetType === "YEAR_GROUP" ? "a year group"
        : targetType === "CLASS" ? "a class"
        : targetType === "TEAM" ? "a staff team or department"
        : "specific students";

      const systemPrompt = `You are a school communications assistant. Draft polished, professional school announcements. Never include personal student data. Keep language safe, age-appropriate, and school-appropriate. Tone: ${toneDesc}. Output ONLY valid JSON with keys: title, body, bullets (array of strings, max 4).`;
      const userMsg = `Draft a school announcement for ${targetDesc}.\n\nTeacher's rough notes: ${message}\n\nReturn ONLY JSON: { "title": "...", "body": "...", "bullets": ["..."] }`;

      const oaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: AI_MODEL, temperature: 0.4, max_tokens: 500, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMsg }] }),
      });

      const oaiData = await oaiRes.json().catch(() => null);
      if (!oaiRes.ok) return safeJson({ ok: false, debugId, code: "OPENAI_ERROR", message: `OpenAI error (${oaiRes.status})` });

      const raw = oaiData?.choices?.[0]?.message?.content || "";

      let parsed = null;
      try {
        const start = raw.indexOf("{");
        const end = raw.lastIndexOf("}");
        if (start >= 0 && end > start) parsed = JSON.parse(raw.slice(start, end + 1));
      } catch (_) {}

      if (!parsed?.title) {
        return safeJson({ ok: true, debugId, title: "Announcement", body: raw, bullets: [] });
      }

      console.log(JSON.stringify({ debugId, step: "draft_done", ms: Date.now() - t0 }));
      return safeJson({ ok: true, debugId, title: String(parsed.title), body: String(parsed.body || ""), bullets: Array.isArray(parsed.bullets) ? parsed.bullets : [] });
    }

    return safeJson({ ok: false, debugId, code: "UNKNOWN_TOOL", message: `Unknown tool: ${tool}` });

  } catch (err) {
    console.log(JSON.stringify({ debugId, step: "fatal", error: String(err?.message || err) }));
    return safeJson({ ok: false, debugId, code: "FATAL", message: err?.message || "Unknown error" }, 500);
  }
});