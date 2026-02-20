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

function tryParseJson(text) {
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(text.slice(start, end + 1));
    }
  } catch {
    // ignore
  }
  return null;
}

Deno.serve(async (req) => {
  const id = makeDebugId();

  try {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
    if (req.method !== "POST") return safeJson({ ok: false, debugId: id, message: "Method not allowed" }, 405);

    const body = await req.json().catch(() => ({}));
    const audience = String(body?.audience || "").trim();
    const intent = String(body?.intent || "").trim();
    const tone = String(body?.tone || "friendly").trim();

    console.log(JSON.stringify({ debugId: id, step: "request", audience, tone }));

    if (!audience || !intent) {
      return safeJson({
        ok: false, debugId: id, code: "MISSING_FIELDS",
        message: "audience and intent are required",
        missing: [!audience ? "audience" : null, !intent ? "intent" : null].filter(Boolean),
      });
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";
    const AI_MODEL = Deno.env.get("AI_MODEL") || "gpt-4o-mini";

    if (!OPENAI_API_KEY) {
      return safeJson({ ok: false, debugId: id, code: "MISSING_SECRET", message: "OPENAI_API_KEY not set" });
    }

    const audienceLabels = {
      whole_school: "the whole school",
      year_7: "Year 7 students",
      year_8: "Year 8 students",
      year_9: "Year 9 students",
      year_10: "Year 10 students",
      year_11: "Year 11 students",
      staff_only: "staff only",
    };
    const audienceLabel = audienceLabels[audience] || audience;

    const system = "You draft school announcements for teachers. Keep language safe, professional and age-appropriate. NEVER include personal student data. Output JSON only.";
    const userMsg = `
Audience: ${audienceLabel}
Tone: ${tone}
Intent: ${intent}

Return EXACT JSON:
{
  "title": "...",
  "messageShort": "1-2 sentence version",
  "messageLong": "4-8 line full version"
}`;

    const oaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: AI_MODEL, temperature: 0.4,
        messages: [{ role: "system", content: system }, { role: "user", content: userMsg }],
      }),
    });

    const oaiData = await oaiRes.json().catch(() => null);
    if (!oaiRes.ok) {
      console.log(JSON.stringify({ debugId: id, step: "openai_error", status: oaiRes.status }));
      return safeJson({ ok: false, debugId: id, code: "OPENAI_ERROR", message: `OpenAI error (${oaiRes.status})` });
    }

    const raw = oaiData?.choices?.[0]?.message?.content;
    if (!raw) return safeJson({ ok: false, debugId: id, code: "EMPTY_RESPONSE", message: "OpenAI returned empty content" });

    const parsed = tryParseJson(raw);

    if (!parsed?.title || !parsed?.messageShort || !parsed?.messageLong) {
      return safeJson({ ok: true, debugId: id, title: "Announcement", messageShort: raw.slice(0, 180), messageLong: raw });
    }

    return safeJson({ ok: true, debugId: id, title: String(parsed.title), messageShort: String(parsed.messageShort), messageLong: String(parsed.messageLong) });

  } catch (err) {
    console.log(JSON.stringify({ debugId: id, step: "fatal", error: String(err?.message || err) }));
    return safeJson({ ok: false, debugId: id, code: "AI_ANNOUNCEMENT_FAILED", message: err?.message || "Unknown error" });
  }
});