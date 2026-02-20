import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "content-type": "application/json",
};

function makeDebugId() {
  return `bw_ai_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function safeJson(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: corsHeaders });
}

function parseDateRange(question) {
  const q = (question || "").toLowerCase();
  const now = new Date();

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
    const t = new Date(now);
    t.setDate(now.getDate() + 1);
    start = startOfDay(t);
    end = endOfDay(t);
    label = "tomorrow";
  } else if (q.includes("next week")) {
    const n = new Date(now);
    n.setDate(now.getDate() + 7);
    start = startOfWeek(n);
    end = endOfWeek(n);
    label = "next week";
  } else if (q.includes("this week") || q.includes("week")) {
    start = startOfWeek(now);
    end = endOfWeek(now);
    label = "this week";
  }

  return { start, end, label };
}

Deno.serve(async (req) => {
  const id = makeDebugId();

  try {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
    if (req.method !== "POST") return safeJson({ ok: false, debugId: id, message: "Method not allowed" }, 405);

    const body = await req.json().catch(() => ({}));
    const question = String(body?.question || "").trim();
    const audience = body?.audience ? String(body.audience).trim() : null;

    console.log(JSON.stringify({ debugId: id, step: "request", question, audience }));

    if (!question) {
      return safeJson({ ok: false, debugId: id, code: "MISSING_QUESTION", message: "question is required" });
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";
    const AI_MODEL = Deno.env.get("AI_MODEL") ?? "gpt-4o-mini";

    if (!OPENAI_API_KEY) {
      return safeJson({ ok: false, debugId: id, code: "MISSING_SECRET", message: "OPENAI_API_KEY not set" });
    }

    const range = parseDateRange(question);
    console.log(JSON.stringify({ debugId: id, step: "date_range", label: range.label, start: range.start.toISOString(), end: range.end.toISOString() }));

    const base44 = createClientFromRequest(req);

    // Query Event entity (our entity is named "Event")
    let events = [];
    try {
      const user = await base44.auth.me();
      events = await base44.asServiceRole.entities.Event.list();
      // Filter by date range client-side
      events = events.filter(ev => {
        if (!ev.start_time) return false;
        const evStart = new Date(ev.start_time);
        return evStart >= range.start && evStart <= range.end;
      });
      if (audience && audience !== 'any') {
        events = events.filter(ev => !ev.audience || ev.audience === audience || ev.audience === 'whole_school');
      }
    } catch (e) {
      console.log(JSON.stringify({ debugId: id, step: "events_query_failed", error: String(e?.message || e) }));
      return safeJson({ ok: false, debugId: id, code: "EVENTS_QUERY_FAILED", message: "Could not query Events. " + String(e?.message || e) });
    }

    const normalized = events.map(ev => ({
      title: ev.title,
      start_time: ev.start_time,
      end_time: ev.end_time || null,
      location: ev.location || null,
      audience: ev.audience || null,
      tags: ev.tags || null,
    }));

    console.log(JSON.stringify({ debugId: id, step: "events_found", count: normalized.length }));

    if (normalized.length === 0) {
      return safeJson({ ok: false, debugId: id, code: "NO_EVENTS_FOUND", message: `No scheduled events found for ${range.label}.`, events: [] });
    }

    const system = "You are a school admin assistant. Answer ONLY using the events provided. If something is not listed, say you cannot find it. Be concise and helpful.";
    const userMsg = `Question: ${question}\n\nEvents (JSON):\n${JSON.stringify(normalized, null, 2)}\n\nWrite a helpful, concise answer.`;

    const oaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: AI_MODEL, temperature: 0.2, messages: [{ role: "system", content: system }, { role: "user", content: userMsg }] }),
    });

    const oaiData = await oaiRes.json().catch(() => null);
    if (!oaiRes.ok) {
      console.log(JSON.stringify({ debugId: id, step: "openai_error", status: oaiRes.status }));
      return safeJson({ ok: false, debugId: id, code: "OPENAI_ERROR", message: `OpenAI error (${oaiRes.status})` });
    }

    const answer = oaiData?.choices?.[0]?.message?.content;
    if (!answer) return safeJson({ ok: false, debugId: id, code: "EMPTY_RESPONSE", message: "OpenAI returned empty content" });

    return safeJson({ ok: true, debugId: id, answer, events: normalized });

  } catch (err) {
    console.log(JSON.stringify({ debugId: id, step: "fatal", error: String(err?.message || err) }));
    return safeJson({ ok: false, debugId: id, code: "AI_SCHEDULE_FAILED", message: err?.message || "Unknown error" });
  }
});