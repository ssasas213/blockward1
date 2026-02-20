import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'content-type': 'application/json'
};

function getDateRange(dateHint, question) {
  const now = new Date();
  const q = (question || '').toLowerCase();
  const hint = (dateHint || '').toLowerCase();

  const combined = hint + ' ' + q;

  let start, end;

  if (combined.includes('tomorrow')) {
    start = new Date(now); start.setDate(start.getDate() + 1); start.setHours(0,0,0,0);
    end = new Date(start); end.setHours(23,59,59,999);
  } else if (combined.includes('next week')) {
    const day = now.getDay();
    const diffToMonday = (8 - day) % 7 || 7;
    start = new Date(now); start.setDate(now.getDate() + diffToMonday); start.setHours(0,0,0,0);
    end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23,59,59,999);
  } else if (combined.includes('this week') || combined.includes('week')) {
    const day = now.getDay();
    const diffToMonday = (day === 0) ? -6 : 1 - day;
    start = new Date(now); start.setDate(now.getDate() + diffToMonday); start.setHours(0,0,0,0);
    end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23,59,59,999);
  } else {
    // Default: today
    start = new Date(now); start.setHours(0,0,0,0);
    end = new Date(now); end.setHours(23,59,59,999);
  }

  return { start, end };
}

function extractKeywords(question) {
  const lower = (question || '').toLowerCase();
  const keywords = [];
  const terms = ['assembly', 'sports', 'parents', 'evening', 'trip', 'exam', 'meeting', 'event', 'concert', 'fair', 'open day', 'inset'];
  for (const t of terms) {
    if (lower.includes(t)) keywords.push(t);
  }
  return keywords;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const debugId = 'bw_ai_sched_' + Date.now();
  console.log(JSON.stringify({ debugId, fn: 'aiScheduleAssistant', step: 'START' }));

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return new Response(JSON.stringify({ ok: false, message: 'Unauthorized', debugId }), { status: 401, headers: CORS });

  const body = await req.json();
  const { question, audience, dateHint } = body;

  if (!question) {
    return new Response(JSON.stringify({ ok: false, message: 'question is required', debugId }), { headers: CORS });
  }

  console.log(JSON.stringify({ debugId, fn: 'aiScheduleAssistant', step: 'PARAMS', question, audience, dateHint }));

  const { start, end } = getDateRange(dateHint, question);
  const keywords = extractKeywords(question);

  console.log(JSON.stringify({ debugId, fn: 'aiScheduleAssistant', step: 'DATE_RANGE', start: start.toISOString(), end: end.toISOString(), keywords }));

  // Fetch all events in the date range
  let events = await base44.asServiceRole.entities.Event.filter({
    start_time: { $gte: start.toISOString(), $lte: end.toISOString() }
  });

  console.log(JSON.stringify({ debugId, fn: 'aiScheduleAssistant', step: 'FETCHED', count: events.length }));

  // Filter by audience if provided
  if (audience) {
    events = events.filter(e => !e.audience || e.audience === 'whole_school' || e.audience === audience);
  }

  // Filter by keyword match (title, tags, notes)
  let filtered = events;
  if (keywords.length > 0) {
    filtered = events.filter(e => {
      const haystack = [e.title, e.notes, ...(e.tags || [])].join(' ').toLowerCase();
      return keywords.some(k => haystack.includes(k));
    });
    // If keyword filter removes everything but we had events, show all events anyway
    if (filtered.length === 0 && events.length > 0) {
      filtered = events;
    }
  }

  console.log(JSON.stringify({ debugId, fn: 'aiScheduleAssistant', step: 'FILTERED', count: filtered.length }));

  const rangeLabel = dateHint || (question.toLowerCase().includes('tomorrow') ? 'tomorrow' :
    question.toLowerCase().includes('week') ? 'this week' : 'today');

  let answer;
  if (filtered.length === 0) {
    answer = `I can't find any scheduled events or assemblies for ${rangeLabel}. The school calendar shows no entries for that period.`;
  } else {
    const eventLines = filtered.map(e => {
      const time = new Date(e.start_time).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      return `• ${e.title} — ${time}${e.location ? ' @ ' + e.location : ''}`;
    }).join('\n');
    answer = `Here are the scheduled events for ${rangeLabel}:\n\n${eventLines}`;
  }

  return new Response(JSON.stringify({
    ok: true,
    answer,
    events: filtered.map(e => ({
      id: e.id,
      title: e.title,
      startTime: e.start_time,
      endTime: e.end_time,
      location: e.location,
      audience: e.audience,
      tags: e.tags
    })),
    debugId
  }), { headers: CORS });
});