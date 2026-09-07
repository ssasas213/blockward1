// Shared helpers for group/team achievements: participant normalisation, the
// shared TeamCredential record created when a team request is approved, the
// per-participant claim emails, and per-participant credential minting once
// they consent. Used by credentialDelivery (mint path) and teamParticipantAction.
import { appUrl, buildSignerChain, requestEmailHtml, notifyRequest } from './achievementRequests.ts';

export const MAX_TEAM_PARTICIPANTS = 30;

export function generateTeamSlug(title: string): string {
  const base = (title || 'team').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'team';
  return `${base}-${Math.random().toString(36).substring(2, 8)}`;
}

export function newParticipantToken(): string {
  return crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').substring(0, 8);
}

// Enrich the creator-entered participant list with profile data where the
// email matches an existing BlockWard account.
export async function normalizeParticipants(svc: any, raw: any[], excludeEmail: string) {
  const seen = new Set<string>();
  const out: any[] = [];
  for (const p of (raw || []).slice(0, MAX_TEAM_PARTICIPANTS)) {
    const email = String(p?.email || '').trim().toLowerCase();
    if (!email || !email.includes('@') || email === excludeEmail || seen.has(email)) continue;
    seen.add(email);
    out.push({
      email,
      name: String(p?.name || '').trim() || null,
      role: String(p?.role || '').trim() || 'Member',
    });
  }
  for (const p of out) {
    try {
      const rows = await svc.entities.UserProfile.filter({ user_email: p.email });
      const profile = rows?.find((r: any) => r.user_type === 'student') || rows?.[0] || null;
      if (profile) {
        p.profile_id = profile.id;
        p.handle = profile.handle || null;
        p.avatar_url = profile.avatar_url || null;
        p.name = p.name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || p.email;
        p.on_blockward = true;
      } else {
        p.profile_id = null;
        p.handle = null;
        p.avatar_url = null;
        p.on_blockward = false;
      }
    } catch (_) {
      p.profile_id = null;
      p.handle = null;
      p.avatar_url = null;
      p.on_blockward = false;
    }
  }
  return out;
}

// Create the shared team record once (idempotent by request), with the
// requester as the first accepted participant and everyone else pending with
// a private claim token. Emails every pending teammate their claim link.
export async function ensureTeamCredential(svc: any, request: any, ctx: any) {
  const existing = await svc.entities.TeamCredential.filter({ request_id: request.id });
  if (existing?.length) return { ok: true, idempotent: true, team: existing[0] };

  const now = new Date().toISOString();
  const enriched = await normalizeParticipants(svc, request.team_participants || [], request.student_email);

  const participants: any[] = [
    {
      email: request.student_email,
      name: request.student_name || request.student_email,
      profile_id: request.student_id || ctx.requesterProfile?.id || null,
      handle: ctx.requesterProfile?.handle || null,
      avatar_url: ctx.requesterProfile?.avatar_url || null,
      role: request.my_team_role || 'Member',
      on_blockward: true,
      status: 'accepted',
      responded_at: now,
      verification_id: ctx.verificationId,
      token: null,
    },
    ...enriched.map((p: any) => ({
      ...p,
      status: 'pending',
      responded_at: null,
      verification_id: null,
      token: newParticipantToken(),
    })),
  ];

  let orgName = request.school_name || null;
  try {
    const schools = await svc.entities.School.filter({ id: request.school_id });
    if (schools?.[0]?.name) orgName = schools[0].name;
  } catch (_) { /* best-effort */ }

  const team = await svc.entities.TeamCredential.create({
    school_id: request.school_id,
    school_name: orgName,
    request_id: request.id,
    team_slug: ctx.teamSlug,
    verification_id: ctx.verificationId,
    title: request.title,
    category: request.category || 'special',
    description: request.description || null,
    date_achieved: request.date_achieved || null,
    organisation_id: request.school_id,
    organisation_name: orgName,
    verifier_name: request.nominated_verifier_name || null,
    verifier_email: request.nominated_verifier_email || null,
    admin_name: request.admin_signoff?.signer_name || null,
    admin_email: request.admin_signoff?.signer_email || null,
    signer_chain: buildSignerChain(request),
    participants,
    approved_at: now,
  });

  // Claim emails — the growth loop: one approval pulls in every teammate.
  for (const p of participants) {
    if (p.status !== 'pending') continue;
    const html = requestEmailHtml(
      `You're part of a verified team achievement`,
      [
        `<strong>${request.student_name || 'A teammate'}</strong> listed you as <strong>${p.role}</strong> on <em>${request.title}</em>${orgName ? ` at ${orgName}` : ''}.`,
        p.on_blockward
          ? 'Accept to publish your own credential, with your role, on your profile.'
          : 'Accept to claim your credential — and join BlockWard free to keep it on your profile.',
        'You only appear on the public team record once you accept. This link is private to you.',
      ],
      `${appUrl()}/team-join/${p.token}`,
      'View & accept'
    );
    await notifyRequest(p.email, `You're part of "${request.title}" — accept your credential`, html);
  }

  return { ok: true, team };
}

// Mint one participant's personal credential after they accept. Works for
// existing members (attached to their profile immediately) and for people
// not yet on BlockWard (keyed by email — attaches to their profile once they
// join with that email, via the publicProfileData email fallback).
export async function mintTeamParticipantCredential(svc: any, team: any, participant: any) {
  if (participant.verification_id) {
    return { ok: true, idempotent: true, verificationId: participant.verification_id };
  }

  const now = new Date().toISOString();
  let profile: any = null;
  try {
    const rows = await svc.entities.UserProfile.filter({ user_email: participant.email });
    profile = rows?.find((r: any) => r.user_type === 'student') || rows?.[0] || null;
  } catch (_) { /* best-effort */ }

  const displayName = participant.name || (profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : null) || participant.email;

  const record = await svc.entities.StudentRecord.create({
    school_id: team.school_id,
    student_id: profile?.id || null,
    student_email: participant.email,
    student_name: displayName,
    owner_student_id: profile?.id || null,
    owner_student_email: participant.email,
    owner_school_id: team.school_id,
    origin: 'student',
    teacher_name: team.verifier_name || null,
    teacher_email: team.verifier_email || null,
    teacher_signed: true,
    teacher_signed_at: team.approved_at || now,
    admin_name: team.admin_name || null,
    admin_email: team.admin_email || null,
    admin_signed: !!team.admin_name,
    admin_signed_at: team.approved_at || now,
    title: team.title,
    category: team.category || 'special',
    description: team.description || null,
    date_achieved: team.date_achieved || null,
    submitted_at: team.approved_at || now,
    approved_at: team.approved_at || now,
    status: 'approved',
  });

  const blockWard = await svc.entities.BlockWard.create({
    school_id: team.school_id,
    record_id: record.id,
    student_record_id: record.id,
    student_email: participant.email,
    student_name: displayName,
    owner_student_id: profile?.id || null,
    owner_student_email: participant.email,
    owner_school_id: team.school_id,
    issuer_email: team.admin_email || team.verifier_email,
    issuer_name: team.admin_name || team.verifier_name,
    title: team.title,
    description: team.description || null,
    category: team.category || 'special',
    vault_status: 'delivered',
    status: 'active',
    issuer_wallet: 'system',
    minted_at: now,
  });

  const year = new Date().getFullYear();
  const rand = Math.random().toString(36).substring(2, 10).toUpperCase();
  const verificationId = `BW-${year}-${rand}`;
  const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  await svc.entities.BlockWardVerificationRegistry.create({
    verification_id: verificationId,
    public_slug: `${slugify(team.title || 'achievement')}-${rand.substring(0, 4).toLowerCase()}`,
    blockward_id: blockWard.id,
    student_record_id: record.id,
    organisation_id: team.school_id,
    organisation_type: 'school',
    organisation_name: team.organisation_name || team.school_name || null,
    school_id: team.school_id,
    student_id: profile?.id || null,
    student_name: displayName,
    student_email: participant.email,
    achievement_title: team.title,
    achievement_category: team.category || 'special',
    achievement_description: team.description || null,
    achievement_image: null,
    evidence_file_url: null,
    date_achieved: team.date_achieved || null,
    date_approved: team.approved_at || now,
    date_delivered: now,
    teacher_name: team.verifier_name || null,
    admin_name: team.admin_name || null,
    student_requested: true,
    signer_chain: team.signer_chain || [],
    approval_status: 'approved',
    vault_status: 'delivered',
    nft_status: 'pending',
    public_verification_url: `${appUrl()}/verify/${verificationId}`,
    is_public: true,
    is_team_credential: true,
    team_slug: team.team_slug,
    participant_role: participant.role,
  });

  await svc.entities.StudentRecord.update(record.id, {
    status: 'delivered_to_vault',
    vault_status: 'delivered',
    delivered_to_student_vault: true,
    vault_delivered_at: now,
    blockward_id: blockWard.id,
    verify_id: verificationId,
  });

  return { ok: true, verificationId, handle: profile?.handle || null, onBlockward: !!profile };
}