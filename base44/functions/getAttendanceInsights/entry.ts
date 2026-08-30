import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveEffectiveActor } from '../../shared/testMode.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'content-type': 'application/json',
};

function getISOWeek(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((date - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: cors });
  try {
    const base44 = createClientFromRequest(req);
    const actor = await resolveEffectiveActor(base44);
    if (!actor.authorized) return new Response(JSON.stringify({ error: actor.reason || 'Unauthorized' }), { status: actor.status || 401, headers: cors });
    if (actor.actor_role !== 'admin') return new Response(JSON.stringify({ error: 'Admins only' }), { status: 403, headers: cors });

    const svc = base44.asServiceRole;
    const today = new Date().toISOString().slice(0, 10);
    const [records, classes, sessions] = await Promise.all([
      svc.entities.AttendanceRecord.filter({ school_id: actor.school_id }, '-date', 2000),
      svc.entities.Class.filter({ school_id: actor.school_id }),
      svc.entities.AttendanceSession.filter({ school_id: actor.school_id }, '-date', 500),
    ]);
    const className = (id) => classes.find(c => c.id === id)?.name || 'Unknown class';

    // Today's summary
    const todayRecs = records.filter(r => r.date === today);
    const todayCounts = { present: 0, absent: 0, late: 0, excused: 0 };
    for (const r of todayRecs) { if (todayCounts[r.status] != null) todayCounts[r.status]++; }
    const todayRate = todayRecs.length ? Math.round(((todayCounts.present + todayCounts.late) / todayRecs.length) * 100) : null;

    // School average (all records)
    const schoolAttended = records.filter(r => r.status === 'present' || r.status === 'late').length;
    const schoolAverage = records.length ? Math.round((schoolAttended / records.length) * 100) : null;

    // By class
    const byClassMap = {};
    for (const r of records) (byClassMap[r.class_id] = byClassMap[r.class_id] || []).push(r);
    const byClass = Object.entries(byClassMap).map(([id, recs]) => {
      const att = recs.filter(r => r.status === 'present' || r.status === 'late').length;
      return { class_id: id, name: className(id), rate: recs.length ? Math.round((att / recs.length) * 100) : null, count: recs.length };
    }).sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1));

    // Low attendance students (below 85%)
    const byStudent = {};
    for (const r of records) (byStudent[r.student_email] = byStudent[r.student_email] || { name: r.student_name, email: r.student_email, recs: [] }).recs.push(r);
    const lowAttendance = Object.values(byStudent).map(s => {
      const att = s.recs.filter(r => r.status === 'present' || r.status === 'late').length;
      return { name: s.name, email: s.email, rate: s.recs.length ? Math.round((att / s.recs.length) * 100) : null, total: s.recs.length };
    }).filter(s => s.rate !== null && s.rate < 85).sort((a, b) => a.rate - b.rate).slice(0, 50);

    // Recent sessions (attendance history)
    const recentSessions = sessions.slice(0, 40).map(s => ({
      id: s.id, class_name: s.class_name, date: s.date,
      present: s.present_count, absent: s.absent_count, late: s.late_count, excused: s.excused_count,
    }));

    return new Response(JSON.stringify({
      today: { date: today, counts: todayCounts, rate: todayRate, total: todayRecs.length },
      school_average: schoolAverage,
      by_class: byClass,
      low_attendance: lowAttendance,
      recent_sessions: recentSessions,
      total_records: records.length,
    }), { status: 200, headers: cors });
  } catch (e) {
    return new Response(JSON.stringify({ error: e?.message || 'Failed to load attendance insights' }), { status: 500, headers: cors });
  }
});