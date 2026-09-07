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

    // 3. Affiliations — current school / club.
    let school = null;
    if (profile.school_id) {
      try {
        const schools = await svc.entities.School.filter({ id: profile.school_id });
        school = schools[0] || null;
      } catch (e) { /* ignore */ }
    }

    // 4. Verified achievements from the permanent registry.
    let registry = [];
    try { registry = await svc.entities.BlockWardVerificationRegistry.filter({ student_id: profile.id }); } catch (e) { /* empty */ }
    // Team credentials minted before the student joined are keyed by email — merge them in.
    try {
      const byEmail = await svc.entities.BlockWardVerificationRegistry.filter({ student_email: profile.user_email });
      const seen = new Set(registry.map((r) => r.id));
      for (const r of byEmail) if (!seen.has(r.id)) registry.push(r);
    } catch (e) { /* empty */ }

    const visible = registry.filter((r) =>
      r.approval_status === 'approved' &&
      r.visibility !== 'private' &&
      (r.visibility ? r.visibility === 'public' || r.visibility === 'link_only' : r.is_public !== false)
    ).sort((a, b) =>
      new Date(b.date_delivered || b.date_approved || b.date_achieved || b.updated_date || 0) -
      new Date(a.date_delivered || a.date_approved || a.date_achieved || a.updated_date || 0)
    );

    // Org logos: batch-resolve the unique school_ids in the achievements.
    const orgIds = [...new Set(visible.map((r) => r.school_id).filter(Boolean))];
    const orgLogos = {};
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
      participant_role: r.participant_role || null,
      team_slug: r.team_slug || null,
    }));

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
      achievements,
      count: achievements.length,
    });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}