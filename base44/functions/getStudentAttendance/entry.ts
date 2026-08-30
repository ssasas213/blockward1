import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveEffectiveActor } from '../../shared/testMode.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'content-type': 'application/json',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: cors });
  try {
    const base44 = createClientFromRequest(req);
    const actor = await resolveEffectiveActor(base44);
    if (!actor.authorized) return new Response(JSON.stringify({ error: actor.reason || 'Unauthorized' }), { status: actor.status || 401, headers: cors });
    // Students see only their own attendance; teachers/admins use the class/admin tools.
    if (actor.actor_role !== 'student') {
      return new Response(JSON.stringify({ error: 'This tool is for students' }), { status: 403, headers: cors });
    }

    const svc = base44.asServiceRole;
    const records = await svc.entities.AttendanceRecord.filter({ school_id: actor.school_id, student_email: actor.actor_email }, '-date', 500);
    const total = records.length;
    const counts = { present: 0, absent: 0, late: 0, excused: 0 };
    for (const r of records) { if (counts[r.status] != null) counts[r.status]++; }
    const attended = counts.present + counts.late;
    const rate = total ? Math.round((attended / total) * 100) : null;

    // Recent + term trend (last 12 weeks by ISO week)
    const recent = records.slice(0, 15).map(r => ({ date: r.date, class_name: r.class_name, status: r.status, note: r.note || '' }));
    const weeks = {};
    for (const r of records) {
      if (!r.date) continue;
      const d = new Date(r.date);
      const week = `${d.getFullYear()}-W${String(getISOWeek(d)).padStart(2, '0')}`;
      (weeks[week] = weeks[week] || { attended: 0, total: 0 });
      weeks[week].total++;
      if (r.status === 'present' || r.status === 'late') weeks[week].attended++;
    }
    const trend = Object.entries(weeks).sort((a, b) => a[0].localeCompare(b[0])).slice(-12).map(([week, v]) => ({ week, rate: v.total ? Math.round((v.attended / v.total) * 100) : null }));

    return new Response(JSON.stringify({ total, counts, rate, recent, trend }), { status: 200, headers: cors });
  } catch (e) {
    return new Response(JSON.stringify({ error: e?.message || 'Failed to load student attendance' }), { status: 500, headers: cors });
  }
});

function getISOWeek(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((date - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
}