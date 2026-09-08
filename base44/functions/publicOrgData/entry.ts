/**
 * publicOrgData — public organisation page (/org/:slug) for schools, clubs
 * and academies. No auth required.
 *
 * The slug is the slugified organisation name (e.g. Riverside High →
 * /org/riverside-high). Only public-safe data is returned:
 *   - org: name, type, location, logo, website
 *   - members: students with a PUBLIC /@handle profile only — private and
 *     link-only profiles never appear in an org directory
 *   - credentials: public verified credentials issued by this organisation
 * Never returns emails or internal IDs.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'content-type': 'application/json'
};

function slugifyName(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export default async function (req: Request): Promise<Response> {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const slug = slugifyName(String(body.slug || ''));
    if (!slug) return Response.json({ ok: false, error: 'not_found' }, { status: 404, headers: CORS });

    // Resolve the organisation by slugified name.
    let schools: any[] = [];
    try { schools = await svc.entities.School.list(); } catch (e) { /* empty */ }
    const school = schools.find((s) => slugifyName(s.name) === slug && s.status !== 'suspended' && s.status !== 'inactive') || null;
    if (!school) return Response.json({ ok: false, error: 'not_found' }, { status: 404, headers: CORS });

    // Members — students whose profile is fully PUBLIC: handle claimed and
    // profile_visibility 'public'. Private/link-only profiles are excluded
    // entirely; this is a public directory of consenting members only.
    const members: any[] = [];
    const seenProfileIds = new Set<string>();
    const addMember = (p: any) => {
      if (!p || seenProfileIds.has(p.id)) return;
      if (p.user_type !== 'student') return;
      if (['inactive', 'suspended', 'pending_approval', 'awaiting_guardian_consent'].includes(p.status)) return;
      if (!p.handle || p.profile_visibility !== 'public') return;
      seenProfileIds.add(p.id);
      members.push({
        name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Member',
        handle: p.handle,
        avatar_url: p.avatar_url || null,
        total_achievements: null,
      });
    };

    try {
      const profiles = await svc.entities.UserProfile.filter({ school_id: school.id });
      for (const p of profiles) addMember(p);
    } catch (e) { /* empty */ }

    // Cross-org members (club members who joined via membership, not school_id).
    try {
      const memberships = await svc.entities.StudentOrgMembership.filter({ school_id: school.id, status: 'active' });
      for (const m of memberships) {
        try {
          const rows = await svc.entities.UserProfile.filter({ id: m.student_id });
          addMember(rows?.[0]);
        } catch (e) { /* ignore individual lookups */ }
      }
    } catch (e) { /* entity may not be in use */ }

    // Achievement counts for members (registry entries they own).
    try {
      for (const mem of members) {
        const rows = await svc.entities.UserProfile.filter({ handle: mem.handle });
        const pid = rows?.[0]?.id;
        if (!pid) continue;
        const regs = await svc.entities.BlockWardVerificationRegistry.filter({ student_id: pid });
        mem.total_achievements = regs.filter((r) => r.approval_status === 'approved' && r.visibility !== 'private' && r.is_public !== false).length;
      }
    } catch (e) { /* best-effort counts */ }

    // Public verified credentials issued by this organisation.
    let registry: any[] = [];
    try { registry = await svc.entities.BlockWardVerificationRegistry.filter({ school_id: school.id }); } catch (e) { /* empty */ }
    const credentials = registry
      .filter((r) =>
        r.approval_status === 'approved' &&
        r.visibility !== 'private' &&
        (r.visibility ? r.visibility === 'public' : r.is_public !== false)
      )
      .sort((a, b) =>
        new Date(b.date_delivered || b.date_approved || b.date_achieved || 0).getTime() -
        new Date(a.date_delivered || a.date_approved || a.date_achieved || 0).getTime()
      )
      .slice(0, 12)
      .map((r) => ({
        title: r.achievement_title,
        category: r.achievement_category || 'special',
        image_url: r.achievement_image || null,
        verification_id: r.verification_id,
        student_name: r.student_name || null,
        student_handle: r.student_handle || null,
        date_delivered: r.date_delivered || null,
      }));

    return Response.json({
      ok: true,
      org: {
        name: school.name,
        org_type: school.org_type || 'school',
        city: school.city || null,
        country: school.country || null,
        logo_url: school.logo_url || null,
        website: school.website || null,
        created_year: school.created_date ? new Date(school.created_date).getFullYear() : null,
      },
      members: members.sort((a, b) => a.name.localeCompare(b.name)),
      credentials,
      member_count: members.length,
      credential_count: registry.filter((r) => r.approval_status === 'approved' && r.visibility !== 'private' && r.is_public !== false).length,
    }, { headers: CORS });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500, headers: CORS });
  }
}