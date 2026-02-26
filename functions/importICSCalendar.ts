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

function parseICSDate(dateStr) {
  if (!dateStr) return null;
  // Handle TZID format: DTSTART;TZID=America/New_York:20240101T090000
  const valuePart = dateStr.includes(':') ? dateStr.split(':').pop() : dateStr;
  if (!valuePart) return null;

  // All-day date: 20240101
  if (valuePart.length === 8) {
    const y = valuePart.slice(0, 4);
    const m = valuePart.slice(4, 6);
    const d = valuePart.slice(6, 8);
    return `${y}-${m}-${d}T00:00:00`;
  }

  // DateTime: 20240101T090000Z or 20240101T090000
  const y = valuePart.slice(0, 4);
  const mo = valuePart.slice(4, 6);
  const d = valuePart.slice(6, 8);
  const h = valuePart.slice(9, 11) || '00';
  const mi = valuePart.slice(11, 13) || '00';
  const s = valuePart.slice(13, 15) || '00';
  return `${y}-${mo}-${d}T${h}:${mi}:${s}`;
}

function parseICS(text) {
  const events = [];
  const lines = text.replace(/\r\n /g, '').replace(/\r\n\t/g, '').split(/\r\n|\n|\r/);

  let current = null;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === 'BEGIN:VEVENT') {
      current = {};
    } else if (line === 'END:VEVENT' && current) {
      if (current.title && current.start_time) {
        events.push(current);
      }
      current = null;
    } else if (current) {
      if (line.startsWith('SUMMARY')) {
        current.title = line.split(':').slice(1).join(':').trim();
      } else if (line.startsWith('DTSTART')) {
        current.start_time = parseICSDate(line.split(':').slice(1).join(':'));
      } else if (line.startsWith('DTEND')) {
        current.end_time = parseICSDate(line.split(':').slice(1).join(':'));
      } else if (line.startsWith('LOCATION')) {
        current.location = line.split(':').slice(1).join(':').trim();
      } else if (line.startsWith('DESCRIPTION')) {
        current.notes = line.split(':').slice(1).join(':').replace(/\\n/g, ' ').trim();
      } else if (line.startsWith('UID')) {
        current.external_uid = line.split(':').slice(1).join(':').trim();
      }
    }
  }

  return events;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return safeJson({ error: 'Method not allowed' }, 405);

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return safeJson({ error: 'Unauthorized' }, 401);

    const profiles = await base44.entities.UserProfile.filter({ user_email: user.email });
    const profile = profiles[0] || null;

    if (!profile || (profile.user_type !== 'admin' && profile.user_type !== 'teacher')) {
      return safeJson({ error: 'Only admins and teachers can import calendars' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const { ics_url, audience = 'whole_school' } = body;

    if (!ics_url) return safeJson({ error: 'ics_url is required' }, 400);

    // Fetch the ICS file
    const res = await fetch(ics_url);
    if (!res.ok) return safeJson({ error: `Failed to fetch calendar: HTTP ${res.status}` }, 400);

    const text = await res.text();
    if (!text.includes('BEGIN:VCALENDAR')) {
      return safeJson({ error: 'URL does not appear to be a valid ICS calendar' }, 400);
    }

    const parsed = parseICS(text);
    if (parsed.length === 0) {
      return safeJson({ ok: true, imported: 0, message: 'No events found in calendar' });
    }

    // Only import future events (up to 6 months ahead)
    const now = new Date();
    const sixMonths = new Date(now);
    sixMonths.setMonth(now.getMonth() + 6);

    const toImport = parsed.filter(ev => {
      const start = new Date(ev.start_time);
      return start >= now && start <= sixMonths;
    }).slice(0, 50); // max 50 events

    // Create events in bulk
    const schoolId = profile.school_id;
    let imported = 0;
    for (const ev of toImport) {
      await base44.asServiceRole.entities.Event.create({
        school_id: schoolId,
        title: ev.title,
        start_time: ev.start_time,
        end_time: ev.end_time || null,
        location: ev.location || null,
        notes: ev.notes ? ev.notes.slice(0, 200) : null,
        audience,
        created_by: user.email,
        tags: ['imported'],
      });
      imported++;
    }

    return safeJson({ ok: true, imported, total_found: parsed.length });

  } catch (err) {
    return safeJson({ error: err.message || 'Unknown error' }, 500);
  }
});