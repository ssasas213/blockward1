import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { resolveEffectiveActor } from '../../shared/testMode.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "content-type": "application/json",
};
const safeJson = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: corsHeaders });

// Resolve the affected student emails for an assembly (Event with event_type=assembly)
async function affectedStudentEmails(svc, school_id, event) {
  if (!event) return [];
  const [classes, profiles] = await Promise.all([
    svc.entities.Class.filter({ school_id }).catch(() => []),
    svc.entities.UserProfile.filter({ school_id, user_type: "student" }).catch(() => []),
  ]);
  const audience = event.audience || "whole_school";
  if (audience === "whole_school" || !audience) {
    return profiles.map(p => p.user_email).filter(Boolean);
  }
  if (audience === "staff") return [];
  if (audience === "selected_classes") {
    const ids = event.audience_classes || (event.audience_class_id ? [event.audience_class_id] : []);
    const matched = classes.filter(c => ids.includes(c.id));
    return [...new Set(matched.flatMap(c => c.student_emails || []))];
  }
  if (audience === "year_group") {
    const ygIds = event.year_group_ids || [];
    if (!ygIds.length) return [];
    // Match students whose class grade_level matches a year group name, or via YearGroup entity
    const yearGroups = await svc.entities.YearGroup.filter({ school_id }).catch(() => []);
    const names = new Set(ygIds.map(id => yearGroups.find(y => y.id === id)?.name).filter(Boolean));
    return profiles.filter(p => p.grade_level && names.has(p.grade_level)).map(p => p.user_email);
  }
  return [];
}

async function dispatchNotifications(svc, school_id, emails, title, body, related_id) {
  if (!emails?.length) return 0;
  const unique = [...new Set(emails.filter(Boolean))];
  await svc.entities.Notification.bulkCreate(unique.map(user_email => ({
    user_email, school_id, title, body, type: "announcement_important", priority: "normal", related_id: related_id || null, read: false,
  }))).catch(() => {});
  return unique.length;
}

// Verify a teacher may create an assembly for the given audience
async function verifyAssemblyAudience(svc, actor, body) {
  if (actor.actor_role === "admin") return { ok: true };
  const audience = body.audience || "whole_school";
  if (audience === "whole_school" || audience === "staff") {
    return { ok: false, reason: "Only admins can create whole-school or staff assemblies", status: 403 };
  }
  if (audience === "year_group") {
    // Teachers may create year-group assemblies only if granted — default deny unless admin
    return { ok: false, reason: "Only admins can create year-group assemblies", status: 403 };
  }
  if (audience === "selected_classes") {
    const ids = body.audience_classes || (body.audience_class_id ? [body.audience_class_id] : []);
    if (!ids.length) return { ok: false, reason: "Select at least one class", status: 400 };
    const classes = await svc.entities.Class.filter({ school_id: actor.school_id }).catch(() => []);
    const mine = classes.filter(c => c.teacher_email === actor.actor_email || (c.co_teachers || []).includes(actor.actor_email));
    const allMine = ids.every(id => mine.some(c => c.id === id));
    if (!allMine) return { ok: false, reason: "You can only create assemblies for classes you teach", status: 403 };
    return { ok: true };
  }
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return safeJson({ ok: false, message: "Method not allowed" }, 405);

  try {
    const base44 = createClientFromRequest(req);
    const actor = await resolveEffectiveActor(base44);
    if (!actor.authorized) return safeJson({ ok: false, code: "FORBIDDEN", message: actor.reason || "Not authorised" }, actor.status || 403);

    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const { school_id, actor_email, actor_role } = actor;
    const teacherName = `${actor.first_name || ""} ${actor.last_name || ""}`.trim();
    if (actor_role === "student") return safeJson({ ok: false, code: "FORBIDDEN", message: "Students cannot manage assemblies" }, 403);

    // ── CREATE ASSEMBLY ──
    if (action === "create") {
      const { title, description, start_time, end_time, location, organiser, audience, audience_classes, audience_class_id, year_group_ids, year_group_names, notes } = body;
      if (!title || !start_time) return safeJson({ ok: false, code: "MISSING_FIELD", message: "title and start_time required" }, 400);

      const aud = audience || "whole_school";
      const audCheck = await verifyAssemblyAudience(svc, actor, { audience: aud, audience_classes, audience_class_id });
      if (!audCheck.ok) return safeJson({ ok: false, code: "FORBIDDEN", message: audCheck.reason }, audCheck.status || 403);

      // Resolve year group names if needed
      let ygNames = year_group_names || [];
      if (aud === "year_group" && year_group_ids?.length && !ygNames.length) {
        const ygs = await svc.entities.YearGroup.filter({ school_id }).catch(() => []);
        ygNames = year_group_ids.map(id => ygs.find(y => y.id === id)?.name).filter(Boolean);
      }

      const event = await svc.entities.Event.create({
        school_id, title, description, event_type: "assembly",
        start_time, end_time: end_time || null, location: location || null,
        organiser: organiser || teacherName, audience: aud,
        audience_classes: aud === "selected_classes" ? (audience_classes || (audience_class_id ? [audience_class_id] : [])) : [],
        audience_class_id: audience_class_id || null,
        year_group_ids: aud === "year_group" ? (year_group_ids || []) : [],
        year_group_names: ygNames,
        notes: notes || null, status: "scheduled", created_by: actor_email,
      });

      // Notify affected students
      const emails = await affectedStudentEmails(svc, school_id, event);
      const dateStr = start_time ? new Date(start_time).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" }) : "";
      const notifBody = `${title}${location ? ` — ${location}` : ""}${dateStr ? ` · ${dateStr}` : ""}`;
      const notified = await dispatchNotifications(svc, school_id, emails, "Assembly scheduled", notifBody, event.id);
      return safeJson({ ok: true, event, notified });
    }

    // ── UPDATE ASSEMBLY ──
    if (action === "update") {
      const { event_id, ...patch } = body;
      if (!event_id) return safeJson({ ok: false, code: "MISSING_FIELD", message: "event_id required" }, 400);
      const events = await svc.entities.Event.filter({ school_id }).catch(() => []);
      const event = events.find(e => e.id === event_id);
      if (!event) return safeJson({ ok: false, code: "NOT_FOUND", message: "Assembly not found" }, 404);
      if (event.event_type !== "assembly") return safeJson({ ok: false, code: "FORBIDDEN", message: "Not an assembly" }, 400);
      if (actor_role !== "admin" && event.created_by !== actor_email) {
        return safeJson({ ok: false, code: "FORBIDDEN", message: "Only the creator or an admin can edit this assembly" }, 403);
      }
      const allowed = ["title", "description", "start_time", "end_time", "location", "organiser", "audience", "audience_classes", "audience_class_id", "year_group_ids", "year_group_names", "notes"];
      const clean = {};
      for (const k of allowed) if (patch[k] !== undefined) clean[k] = patch[k];
      const updated = await svc.entities.Event.update(event_id, clean);
      const emails = await affectedStudentEmails(svc, school_id, updated);
      const dateStr = updated.start_time ? new Date(updated.start_time).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" }) : "";
      await dispatchNotifications(svc, school_id, emails, "Assembly updated", `${updated.title}${updated.location ? ` — ${updated.location}` : ""}${dateStr ? ` · ${dateStr}` : ""}`, event_id);
      return safeJson({ ok: true, event: updated });
    }

    // ── CANCEL ASSEMBLY ──
    if (action === "cancel") {
      const { event_id, reason } = body;
      if (!event_id) return safeJson({ ok: false, code: "MISSING_FIELD", message: "event_id required" }, 400);
      const events = await svc.entities.Event.filter({ school_id }).catch(() => []);
      const event = events.find(e => e.id === event_id);
      if (!event) return safeJson({ ok: false, code: "NOT_FOUND", message: "Assembly not found" }, 404);
      if (event.event_type !== "assembly") return safeJson({ ok: false, code: "FORBIDDEN", message: "Not an assembly" }, 400);
      if (actor_role !== "admin" && event.created_by !== actor_email) {
        return safeJson({ ok: false, code: "FORBIDDEN", message: "Only the creator or an admin can cancel this assembly" }, 403);
      }
      const emails = await affectedStudentEmails(svc, school_id, event);
      await svc.entities.Event.update(event_id, { status: "cancelled" });
      await dispatchNotifications(svc, school_id, emails, "Assembly cancelled", `${event.title} has been cancelled${reason ? `: ${reason}` : ""}.`, event_id);
      return safeJson({ ok: true, cancelled: true });
    }

    // ── LIST ASSEMBLIES (role-aware) ──
    if (action === "list") {
      const [events, classes] = await Promise.all([
        svc.entities.Event.filter({ school_id }).catch(() => []),
        svc.entities.Class.filter({ school_id }).catch(() => []),
      ]);
      let assemblies = events.filter(e => e.event_type === "assembly");
      if (actor_role === "student") {
        const myClassIds = classes.filter(c => (c.student_emails || []).includes(actor.actor_email)).map(c => c.id);
        assemblies = assemblies.filter(e => {
          if (e.status === "cancelled") return false;
          if (e.audience === "whole_school" || !e.audience) return true;
          if (e.audience === "selected_classes") return (e.audience_classes || (e.audience_class_id ? [e.audience_class_id] : [])).some(id => myClassIds.includes(id));
          // year_group / staff / custom — students don't see staff; year_group handled loosely
          return e.audience !== "staff";
        });
      } else if (actor_role === "teacher") {
        const myClassIds = classes.filter(c => c.teacher_email === actor.actor_email || (c.co_teachers || []).includes(actor.actor_email)).map(c => c.id);
        assemblies = assemblies.filter(e => {
          if (e.audience === "whole_school" || e.audience === "staff" || !e.audience) return true;
          if (e.audience === "selected_classes") return (e.audience_classes || (e.audience_class_id ? [e.audience_class_id] : [])).some(id => myClassIds.includes(id)) || e.created_by === actor.actor_email;
          return true;
        });
      }
      return safeJson({ ok: true, assemblies: assemblies.sort((a, b) => new Date(a.start_time) - new Date(b.start_time)) });
    }

    return safeJson({ ok: false, code: "UNKNOWN_ACTION", message: `Unknown action: ${action}` }, 400);
  } catch (err) {
    console.log(JSON.stringify({ step: "assemblyAction fatal", error: String(err?.message || err) }));
    return safeJson({ ok: false, code: "FATAL", message: err?.message || "Unknown error" }, 500);
  }
});