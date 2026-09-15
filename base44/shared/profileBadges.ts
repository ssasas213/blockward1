// ============================================================================
// profileBadges — the single implementation of the EARNED profile
// verification badge (tier 2 'member' / tier 3 'identity').
//
// PRINCIPLE: the badge is EARNED, never purchased and never self-declared.
// All badge fields on UserProfile are service-role only (RLS), and this
// module is the only writer path. A student can never write their badge.
//
//   tier 'none'     — default. No badge is rendered at all (an absent badge
//                      is the signal — never a grey "unverified" marker).
//   tier 'member'    — (blue) the student holds an active membership in an
//                      organisation whose School.verification_status is
//                      'verified'. Granted automatically when the membership
//                      (or the home school) qualifies, revoked automatically
//                      when it ends or the organisation loses verification.
//   tier 'identity'  — (gold) an admin of a verified organisation explicitly
//                      confirmed this profile belongs to a real enrolled
//                      student on their roster. Only ever granted through
//                      setProfileBadge 'confirm_identity', authorised
//                      against the REAL caller identity.
// ============================================================================

export function isVerifiedOrg(school) {
  return !!school && school.verification_status === 'verified';
}

export async function schoolById(svc, id) {
  if (!id) return null;
  try {
    const rows = await svc.entities.School.filter({ id });
    return rows[0] || null;
  } catch (e) {
    return null;
  }
}

// Every organisation this student is genuinely connected to right now:
// the home school (joined via code/invitation) plus ACTIVE cross-org
// memberships (StudentOrgMembership). A pending or declined membership
// is not a connection.
export async function connectedOrgIds(svc, profile) {
  const ids = new Set();
  if (profile.school_id) ids.add(profile.school_id);
  let memberships = [];
  try {
    memberships = await svc.entities.StudentOrgMembership.filter({
      student_email: profile.user_email,
      status: 'active',
    });
  } catch (e) { /* entity may be empty */ }
  for (const m of memberships) ids.add(m.school_id);
  return [...ids];
}

// The tier-2 (member) state derived from live data: the first VERIFIED
// organisation the student is connected to — preferring the current badge
// org, then the home school, then any other membership.
export async function computeMemberState(svc, profile) {
  const connected = new Set(await connectedOrgIds(svc, profile));
  const ordered = [profile.badge_org_id, profile.school_id, ...connected]
    .filter((id) => id && connected.has(id));
  for (const id of [...new Set(ordered)]) {
    const school = await schoolById(svc, id);
    if (isVerifiedOrg(school)) {
      return { tier: 'member', orgId: id, orgName: school.name };
    }
  }
  return { tier: 'none', orgId: null, orgName: null };
}

export async function logBadgeAudit(svc, entry) {
  try {
    await svc.entities.AuditLog.create({
      record_id: entry.profile_id,
      school_id: entry.school_id || 'unassigned',
      actor_email: entry.actor_email || 'system',
      actor_name: entry.actor_name || entry.actor_email || 'system',
      actor_role: entry.actor_role || 'admin',
      action: 'status_changed',
      old_status: entry.old_tier || 'none',
      new_status: entry.new_tier || 'none',
      notes: entry.notes,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error('badge audit failed:', e?.message || e);
  }
}

export async function notifyBadgeChange(svc, profile, opts) {
  try {
    await svc.entities.Notification.create({
      user_email: profile.user_email,
      school_id: opts.school_id || profile.school_id || 'unassigned',
      title: opts.title,
      body: opts.body,
      type: 'message',
      priority: opts.priority || 'normal',
      related_id: profile.id,
    });
  } catch (e) { /* best-effort — never blocks the badge write */ }
}

// Recompute the badge for one student profile. IDEMPOTENT: a profile
// already in the right state is left untouched (no write, no audit, no
// notification).
//   - tier 'identity' survives recompute while its organisation stays
//     verified AND the student stays connected to it; otherwise it is
//     demoted to the member tier with a recorded reason.
//   - tier 'member' is granted when the student gains a connection to a
//     verified organisation and revoked when the last one ends.
export async function recomputeStudentBadge(svc, profile, opts) {
  opts = opts || {};
  const currentTier = profile.badge_tier || 'none';
  const now = new Date().toISOString();

  // ── Identity tier: keep while its basis still holds ──
  if (currentTier === 'identity') {
    const connected = new Set(await connectedOrgIds(svc, profile));
    const org = await schoolById(svc, profile.badge_org_id);
    if (isVerifiedOrg(org) && connected.has(profile.badge_org_id)) {
      return { changed: false, tier: 'identity' };
    }
    const reason = isVerifiedOrg(org)
      ? 'Your membership with the organisation that confirmed your identity has ended'
      : 'The organisation that confirmed your identity is no longer verified on BlockWard';
    const member = await computeMemberState(svc, profile);
    await svc.entities.UserProfile.update(profile.id, {
      badge_tier: member.tier,
      badge_org_id: member.orgId,
      badge_granted_at: member.tier === 'member' ? (profile.badge_granted_at || now) : null,
      badge_granted_by: member.tier === 'member' ? (profile.badge_granted_by || null) : null,
      badge_revoked_at: now,
      badge_revoked_reason: reason,
    });
    await logBadgeAudit(svc, {
      profile_id: profile.id,
      school_id: profile.badge_org_id,
      actor_email: 'system',
      old_tier: 'identity',
      new_tier: member.tier,
      notes: `IDENTITY BADGE DEMOTED — ${reason}`,
    });
    await notifyBadgeChange(svc, profile, {
      school_id: profile.badge_org_id,
      title: 'Your identity badge was removed',
      body: `${reason}.${member.tier === 'member' ? ' You still hold the blue "Confirmed member" badge.' : ''}`,
    });
    return { changed: true, tier: member.tier, reason };
  }

  // ── None / member tiers ──
  const member = await computeMemberState(svc, profile);
  if (currentTier === 'none' && member.tier === 'none') return { changed: false, tier: 'none' };
  if (currentTier === 'member' && member.tier === 'member' && profile.badge_org_id === member.orgId) {
    return { changed: false, tier: 'member' };
  }

  if (member.tier === 'member') {
    // New grant, or the qualifying verified organisation changed.
    await svc.entities.UserProfile.update(profile.id, {
      badge_tier: 'member',
      badge_org_id: member.orgId,
      badge_granted_at: now,
      badge_granted_by: null,
      badge_revoked_at: null,
      badge_revoked_reason: null,
    });
    await logBadgeAudit(svc, {
      profile_id: profile.id,
      school_id: member.orgId,
      actor_email: opts.actor_email || 'system',
      actor_name: opts.actor_name || null,
      old_tier: currentTier,
      new_tier: 'member',
      notes: `MEMBER BADGE — confirmed member of ${member.orgName}`,
    });
    if (currentTier === 'none') {
      await notifyBadgeChange(svc, profile, {
        school_id: member.orgId,
        title: 'You earned the "Confirmed member" badge',
        body: `You're an active member of ${member.orgName}, a BlockWard-verified organisation — your public profile now shows the blue verification badge.`,
      });
    }
    return { changed: true, tier: 'member' };
  }

  // Held member tier but no verified connection remains → revoke.
  const reason = opts.reason
    || 'Your membership with the verified organisation ended, so your "Confirmed member" badge was removed';
  await svc.entities.UserProfile.update(profile.id, {
    badge_tier: 'none',
    badge_org_id: null,
    badge_granted_at: null,
    badge_granted_by: null,
    badge_revoked_at: now,
    badge_revoked_reason: reason,
  });
  await logBadgeAudit(svc, {
    profile_id: profile.id,
    school_id: profile.badge_org_id || profile.school_id,
    actor_email: opts.actor_email || 'system',
    actor_name: opts.actor_name || null,
    old_tier: 'member',
    new_tier: 'none',
    notes: `MEMBER BADGE REVOKED — ${reason}`,
  });
  await notifyBadgeChange(svc, profile, {
    school_id: profile.badge_org_id,
    title: 'Your "Confirmed member" badge was removed',
    body: reason,
  });
  return { changed: true, tier: 'none', reason };
}

// Explicit tier-3 grant — only reachable from setProfileBadge
// 'confirm_identity', which has already authorised the REAL admin caller
// and verified their organisation.
export async function grantIdentityBadge(svc, args) {
  const { profile, school, actorEmail, actorName } = args;
  const now = new Date().toISOString();
  const currentTier = profile.badge_tier || 'none';
  const unchanged = currentTier === 'identity' && profile.badge_org_id === school.id;
  if (!unchanged) {
    await svc.entities.UserProfile.update(profile.id, {
      badge_tier: 'identity',
      badge_org_id: school.id,
      badge_granted_at: now,
      badge_granted_by: actorEmail,
      badge_revoked_at: null,
      badge_revoked_reason: null,
    });
    await logBadgeAudit(svc, {
      profile_id: profile.id,
      school_id: school.id,
      actor_email: actorEmail,
      actor_name: actorName,
      old_tier: currentTier,
      new_tier: 'identity',
      notes: `IDENTITY BADGE GRANTED — admin confirmed this profile is a real enrolled student at ${school.name}`,
    });
    await notifyBadgeChange(svc, profile, {
      school_id: school.id,
      priority: 'important',
      title: 'You earned the gold "Identity confirmed" badge',
      body: `${actorName} of ${school.name} confirmed your identity — your public profile now shows the gold verification badge.`,
    });
  }
  return { changed: !unchanged, tier: 'identity' };
}

// Explicit tier-3 revocation with a reason — the student is notified and
// the revocation is audited. Falls back to whatever member tier is still
// earned (often the blue badge).
export async function revokeIdentityBadge(svc, args) {
  const { profile, school, actorEmail, actorName, reason } = args;
  const member = await computeMemberState(svc, profile);
  const now = new Date().toISOString();
  await svc.entities.UserProfile.update(profile.id, {
    badge_tier: member.tier,
    badge_org_id: member.orgId,
    badge_granted_at: member.tier === 'member' ? now : null,
    badge_granted_by: null,
    badge_revoked_at: now,
    badge_revoked_reason: `Identity confirmation revoked by ${actorName} (${school.name}): ${reason}`,
  });
  await logBadgeAudit(svc, {
    profile_id: profile.id,
    school_id: school.id,
    actor_email: actorEmail,
    actor_name: actorName,
    old_tier: 'identity',
    new_tier: member.tier,
    notes: `IDENTITY BADGE REVOKED — ${reason}`,
  });
  await notifyBadgeChange(svc, profile, {
    school_id: school.id,
    priority: 'important',
    title: 'Your identity badge was removed',
    body: `${school.name} removed your identity confirmation: ${reason}`,
  });
  return { changed: true, tier: member.tier };
}