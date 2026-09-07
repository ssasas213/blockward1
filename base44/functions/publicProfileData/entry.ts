/**
 * publicProfileData — public /@handle profile endpoint (no auth required).
 *
 * Resolves a handle to a student profile and returns only public-safe data:
 * display name, handle, bio, avatar, affiliations, and verified achievements
 * from BlockWardVerificationRegistry (approval approved, visibility != private,
 * legacy is_public respected). Old handles in handle_history resolve to a
 * redirect_to the current handle. Private profiles return a locked stub.
 * Never returns emails or internal IDs.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { normalizeHandle, validateHandle } from '../../shared/handles.ts';

// Derives the portfolio domain of a registry record: the issuing
// organisation's type first (BJJ belt → martial arts academy, chess rating →
// chess organisation…), falling back to the credential category.
const ORG_TYPE_DOMAIN: Record<string, string> = {
  martial_arts_academy: 'martial_arts',
  chess_organisation: 'chess',
  chess_club: 'chess',
  esports_organisation: 'esports',
  music_academy: 'music',
};
const CATEGORY_DOMAIN: Record<string, string> = {
  academic: 'academic',
  sports: 'sport',
  arts: 'music',
  leadership: 'professional',
  community: 'community',
  behaviour: 'community',
  special: 'professional',
};
function domainOf(r: any): string {
  return ORG_TYPE_DOMAIN[r.organisation_type] || CATEGORY_DOMAIN[r.achievement_category] || 'other';
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const handle = normalizeHandle(body.handle);

    const check = validateHandle(handle);
    if (!check.valid) {
      return Response.json({ ok: false, error: 'not_found' }, { status: 404 });
    }

    // 1. Resolve active handle, then reserved history (old handles redirect).
    let profiles = [];
    try { profiles = await svc.entities.UserProfile.filter({ handle }); } catch (e) { /* empty */ }
    let matchedViaHistory = false;
    if (!profiles.length) {
      try {
        const reserved = await svc.entities.UserProfile.filter({ handle_history: handle });
        profiles = reserved;
        matchedViaHistory = true;
      } catch (e) { /* empty */ }
    }

    const profile = profiles.find((p) => p.user_type === 'student' && p.status !== 'inactive' && p.status !== 'suspended') || null;
    if (!profile || !profile.handle) {
      return Response.json({ ok: false, error: 'not_found' }, { status: 404 });
    }

    const fullName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Student';

    if (matchedViaHistory) {
      return Response.json({ ok: true, redirect_to: profile.handle });
    }

    // 2. Private profile — locked stub only.
    if (profile.profile_visibility === 'private') {
      return Response.json({
        ok: true,
        private: true,
        student: { name: fullName, handle: profile.handle, avatar_url: profile.avatar_url || null },
      });
    }

    // 3. Affiliations — EVERY organisation this student belongs to: their home
    // school plus approved cross-org memberships (clubs, academies…).
    let school = null;
    if (profile.school_id) {
      try {
        const schools = await svc.entities.School.filter({ id: profile.school_id });
        school = schools[0] || null;
      } catch (e) { /* ignore */ }
    }

    let memberships: any[] = [];
    try { memberships = await svc.entities.StudentOrgMembership.filter({ student_email: profile.user_email, status: 'active' }); } catch (e) { /* empty */ }

    const orgs: any[] = [];
    const orgLogos: Record<string, string | null> = {};
    if (school) {
      orgs.push({ id: school.id, name: school.name, org_type: school.org_type, city: school.city || null, country: school.country || null, logo_url: school.logo_url || null });
      if (school.logo_url) orgLogos[school.id] = school.logo_url;
    }
    for (const m of memberships) {
      if (orgs.some((o) => o.id === m.school_id)) continue;
      let org = null;
      try { const rows = await svc.entities.School.filter({ id: m.school_id }); org = rows[0] || null; } catch (e) { /* ignore */ }
      orgs.push({
        id: m.school_id,
        name: (org && org.name) || m.school_name || 'Organisation',
        org_type: (org && org.org_type) || m.org_type || 'other',
        city: org?.city || null,
        country: org?.country || null,
        logo_url: org?.logo_url || null,
      });
      if (org?.logo_url) orgLogos[org.id] = org.logo_url;
    }

    // 4. Verified achievements from the permanent registry.
    let registry = [];
    try { registry = await svc.entities.BlockWardVerificationRegistry.filter({ student_id: profile.id }); } catch (e) { /* empty */ }

    const visible = registry.filter((r) =>
      r.approval_status === 'approved' &&
      r.visibility !== 'private' &&
      (r.visibility ? r.visibility === 'public' || r.visibility === 'link_only' : r.is_public !== false)
    ).sort((a, b) =>
      new Date(b.date_delivered || b.date_approved || b.date_achieved || b.updated_date || 0) -
      new Date(a.date_delivered || a.date_approved || a.date_achieved || a.updated_date || 0)
    );

    // Org logos: resolve remaining school_ids referenced by achievements but
    // not covered by the orgs list above.
    const orgIds = [...new Set(visible.map((r) => r.school_id).filter(Boolean))].filter((oid) => !(oid in orgLogos));
    for (const oid of orgIds) {
      try {
        const s = await svc.entities.School.filter({ id: oid });
        if (s[0]) orgLogos[oid] = s[0].logo_url || null;
      } catch (e) { /* ignore */ }
    }

    const achievements = visible.map((r) => ({
      registry_id: r.id,
      verification_id: r.verification_id,
      title: r.achievement_title,
      description: r.achievement_description,
      category: r.achievement_category,
      domain: domainOf(r),
      participant_role: r.participant_role || null,
      team_slug: r.team_slug || null,
      image_url: r.achievement_image || null,
      evidence_url: (r.visibility === 'public' || r.visibility === 'link_only') ? (r.evidence_file_url || null) : null,
      certificate_url: r.certificate_url || null,
      date_achieved: r.date_achieved || null,
      date_approved: r.date_approved || null,
      date_delivered: r.date_delivered || null,
      teacher_name: r.teacher_name || null,
      admin_name: r.admin_name || null,
      organisation_name: r.organisation_name || school?.name || null,
      organisation_logo: orgLogos[r.school_id] || school?.logo_url || null,
      nft_status: r.nft_status,
      blockchain_network: r.blockchain_network || null,
      token_id: r.token_id || null,
      public_verification_url: r.public_verification_url || null,
    }));

    // Peer endorsements on this student's achievements. Never anonymous —
    // each carries the endorser's name, handle and affiliation only.
    let endorsements = [];
    try { endorsements = await svc.entities.Endorsement.filter({ recipient_id: profile.id, status: 'active' }); } catch (e) { /* entity not present yet */ }
    const byRegistry = {};
    const unattached = [];
    for (const e of endorsements) {
      const pub = {
        id: e.id,
        text: e.text,
        achievement_title: e.achievement_title || null,
        endorser: {
          name: e.endorser_name,
          handle: e.endorser_handle || null,
          affiliation: e.endorser_affiliation || null,
        },
        created_date: e.created_date || null,
      };
      if (e.registry_id) (byRegistry[e.registry_id] = byRegistry[e.registry_id] || []).push(pub);
      else unattached.push(pub);
    }
    for (const a of achievements) {
      a.endorsements = byRegistry[a.registry_id] || [];
      a.endorsement_count = a.endorsements.length;
    }
    // Achievements with endorsements sort higher by default, then by recency.
    achievements.sort((a, b) =>
      (b.endorsement_count - a.endorsement_count) ||
      (new Date(b.date_delivered || b.date_approved || b.date_achieved || 0) -
       new Date(a.date_delivered || a.date_approved || a.date_achieved || 0))
    );

    // Self-reported achievements — shown in a clearly separate, unverified
    // section. Verified ones live in the registry and are dropped here.
    let selfReported: any[] = [];
    try { selfReported = await svc.entities.SelfReportedAchievement.filter({ student_email: profile.user_email }); } catch (e) { /* empty */ }
    const self_reported = selfReported
      .filter((s) => (s.status || 'unverified') !== 'verified')
      .map((s) => ({
        id: s.id,
        title: s.title,
        description: s.description || null,
        domain: s.domain || 'other',
        date_achieved: s.date_achieved || null,
        evidence: s.evidence || [],
        status: s.status || 'unverified',
      }))
      .sort((a, b) => new Date(b.date_achieved || 0).getTime() - new Date(a.date_achieved || 0).getTime());

    // Highlights — pinned registry ids (only visible ones), max 6.
    const visibleIds = new Set(visible.map((r) => r.id));
    const pinned = (profile.pinned_achievement_ids || []).filter((id: string) => visibleIds.has(id)).slice(0, 6);

    // Owner flag: the signed-in viewer is the profile owner (enables pinning).
    const is_owner = !!body.viewer_email &&
      String(body.viewer_email).toLowerCase() === (profile.user_email || '').toLowerCase();

    return Response.json({
      ok: true,
      student: {
        name: fullName,
        handle: profile.handle,
        bio: profile.bio || null,
        avatar_url: profile.avatar_url || null,
        grade_level: profile.grade_level || null,
        og_image_url: profile.og_image_url || null,
        link_only: profile.profile_visibility === 'link_only',
      },
      school: school ? {
        name: school.name,
        org_type: school.org_type,
        city: school.city || null,
        country: school.country || null,
        logo_url: school.logo_url || null,
      } : null,
      orgs,
      achievements,
      pinned,
      self_reported,
      is_owner,
      endorsements_unattached: unattached,
      count: achievements.length,
    });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}