import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'content-type': 'application/json'
};

const audienceLabels = {
  whole_school: 'all students and staff',
  year_7: 'Year 7 students',
  year_8: 'Year 8 students',
  year_9: 'Year 9 students',
  year_10: 'Year 10 students',
  year_11: 'Year 11 students',
  staff_only: 'all staff members',
  custom: 'selected students'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const debugId = 'bw_ai_ann_' + Date.now();
  console.log(JSON.stringify({ debugId, fn: 'aiDraftAnnouncement', step: 'START' }));

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return new Response(JSON.stringify({ ok: false, message: 'Unauthorized', debugId }), { status: 401, headers: CORS });

  const body = await req.json();
  const { intent, audience, tone, keyDetails } = body;

  if (!intent || !audience) {
    return new Response(JSON.stringify({ ok: false, message: 'intent and audience are required', debugId }), { headers: CORS });
  }

  const validTone = tone || 'friendly';
  console.log(JSON.stringify({ debugId, fn: 'aiDraftAnnouncement', step: 'PARAMS', intent, audience, tone: validTone }));

  const audienceLabel = audienceLabels[audience] || audience;

  const toneGuidance = {
    friendly: 'warm, positive, and approachable. Use "we" and "our students". Keep it encouraging.',
    formal: 'professional and formal. Use full sentences and proper grammar. Avoid contractions.',
    short: 'brief and to the point. Maximum 2-3 sentences. Clear and direct.'
  }[validTone] || 'clear and professional';

  const prompt = `You are a school communication assistant for BlockWard, a school management platform.

A teacher wants to send an announcement to ${audienceLabel}.

Their intent: "${intent}"
${keyDetails ? `Key details to include: "${keyDetails}"` : ''}
Tone: ${toneGuidance}

Generate TWO versions of an announcement:
1. A SHORT version (1-3 sentences, suitable for a notification/SMS)
2. A FULL version (a proper announcement with greeting, body, and closing)

IMPORTANT RULES:
- Do NOT include any specific student names or personal data
- Do NOT invent facts or dates not mentioned in the intent/key details
- Keep language appropriate for a school setting
- For the full version, include a subject line/title

Respond ONLY with valid JSON in this exact format:
{
  "title": "brief subject line",
  "messageShort": "short version here",
  "messageLong": "full announcement here"
}`;

  const res = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        messageShort: { type: 'string' },
        messageLong: { type: 'string' }
      },
      required: ['title', 'messageShort', 'messageLong']
    }
  });

  console.log(JSON.stringify({ debugId, fn: 'aiDraftAnnouncement', step: 'LLM_DONE', hasTitle: !!res?.title }));

  if (!res?.title) {
    return new Response(JSON.stringify({ ok: false, message: 'AI generation failed', debugId }), { headers: CORS });
  }

  return new Response(JSON.stringify({
    ok: true,
    title: res.title,
    messageShort: res.messageShort,
    messageLong: res.messageLong,
    debugId
  }), { headers: CORS });
});