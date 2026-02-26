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

// Minimal ICS parser
function parseICS(icsText) {
  const events = [];
  const lines = icsText.replace(/\r\n /g, '').replace(/\r\n\t/g, '').split(/\r\n|\n|\r/);

  let current = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      current = {};
    } else if (line === 'END:VEVENT' && current) {
      if (current.summary && current.dtstart) {
        events.push(current);
      }
      current = null;
    } else if (current) {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;
      const key = line.slice(0, colonIdx).split(';')[0].toUpperCase();
      const value = line.slice(colonIdx + 1).trim();

      if (key === 'SUMMARY') current.summary = value;
      else if (key === 'DTSTART') current.dtstart = parseICSDate(value);
      else if (key === 'DTEND') current.dtend = parseICSDate(value);
      else if (key === 'LOCATION') current.location = value;
      else if (key === 'DESCRIPTION') current.description = value.replace(/\\n/g, '\n').replace(/\\,/g, ',');
    }
  }

  return events;
}

function parseICSDate(val) {
  // Handle date-only (YYYYMMDD) and datetime (YYYYMMDDTHHmmssZ)
  const clean = val.replace('Z', '').replace('T', '');
  if (clean.length === 8) {
    // Date only
    const y = clean.slice(0, 4), m = clean.slice(4, 6), d = clean.slice(6, 8);
    return new Date(`${y}-${m}-${d}T00:00:00.000Z`).toISOString();
  }
  if (clean.length >= 14) {
    const y = clean.slice(0, 4), mo = clean.slice(4, 6), d = clean.slice(6, 8);
    const h = clean.slice(8, 10), min = clean.slice(10, 12), s = clean.slice(12, 14);
    const suffix = val.endsWith('Z') ? 'Z' : '';
    return new Date(`${y}-${mo}-${d}T${h}:${min}:${s}${suffix}`).toISOString();
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return safeJson({ ok: false, message: "Method not allowed" }, 405);

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return safeJson({ ok: false, message: "Unauthorized" }, 401);

    // Only admins and teachers can import
    const profiles = await base44.entities.UserProfile.filter({ user_email: user.email });
    const profile = profiles[0] || null;
    if (!profile || profile.user_type === 'student') {
      return safeJson({ ok: false, message: "Only staff can import calendars" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const { ics_url, school_id } = body;

    if (!ics_url) return safeJson({ ok: false, message: "ics_url is required" });

    // Fetch the ICS file
    let icsText;
    try {
      const res = await fetch(ics_url, { headers: { 'User-Agent': 'BlockWard/1.0' } });
      if (!res.ok) return safeJson({ ok: false, message: `Failed to fetch calendar: HTTP ${res.status}` });
      icsText = await res.text();
    } catch (e) {
      return safeJson({ ok: false, message: `Could not reach calendar URL: ${e.message}` });
    }

    if (!icsText.includes('BEGIN:VCALENDAR')) {
      return safeJson({ ok: false, message: "URL does not appear to be a valid ICS calendar" });
    }

    const parsed = parseICS(icsText);
    if (parsed.length === 0) {
      return safeJson({ ok: true, imported: 0, message: "No events found in the calendar" });
    }

    // Import up to 100 upcoming events
    const now = new Date();
    const upcoming = parsed
      .filter(ev => ev.dtstart && new Date(ev.dtstart) >= now)
      .slice(0, 100);

    let imported = 0;
    for (const ev of upcoming) {
      await base44.asServiceRole.entities.Event.create({
        school_id: school_id || profile.school_id || null,
        title: ev.summary,
        start_time: ev.dtstart,
        end_time: ev.dtend || null,
        location: ev.location || null,
        notes: ev.description || null,
        audience: 'whole_school',
        created_by: user.email,
      });
      imported++;
    }

    return safeJson({ ok: true, imported, total_found: parsed.length });
  } catch (err) {
    return safeJson({ ok: false, message: err.message || "Unknown error" }, 500);
  }
});