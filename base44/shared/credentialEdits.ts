// ============================================================================
// credentialEdits — THE single implementation of credential editing, built on
// one principle: a named person attested to specific content, and that
// attestation must never be silently undermined.
//
// FIELD SPLIT (the contract governing everything below):
//   ATTESTED fields — what a verifier actually signed: title, description,
//     date_achieved, category, issuing organisation, evidence, team members
//     and roles. On a verified credential these are immutable by direct edit.
//   PRESENTATION fields — never part of any attestation: cover image,
//     visibility, pinned status, private notes. Always freely editable.
//
// RULES BY STATE:
//   draft / changes_requested / unverified self-reported → everything freely
//     editable (the existing submit/resubmit flow covers draft edits).
//   submitted / under_review / awaiting_* → presentation free; editing an
//     attested field clears collected signatures, kills the outstanding
//     external token, resets the request to 'changes_requested' and notifies
//     the verifier that it needs re-reviewing (requires explicit confirm).
//   verified (delivered/archived) → presentation free; attested fields only
//     change through a CORRECTION REQUEST re-signed by the original verifier,
//     which creates a NEW version (old version retained, superseded — never
//     overwritten) and a new anchor linked to the previous one.
//
// Every edit writes an AuditLog entry; every state change appends event log
// entries. All writes are service-role only — the endpoint is the sole door.
// ============================================================================
import { logEvent, appendEvent, notifyRequest, requestEmailHtml, appUrl } from './achievementRequests.ts';
import { validateSignoff } from './achievementRequestFlow.ts';
import { notifyEvent } from './eventNotifications.ts';
import { waitUntil } from 'base44:runtime';
import { anchorCredential } from './chainAnchor.ts';

// ── The field split ──
export const ATTESTED_REQUEST_FIELDS = [
  'title', 'description', 'date_achieved', 'category',
  'credential_type_id', 'credential_type_title', 'is_custom_credential',
  'evidence', 'is_team', 'my_team_role', 'team_participants',
  'nominated_verifier_email', 'verification_tier', 'external_verifier_email',
];
export const PRESENTATION_REQUEST_FIELDS = ['image_url'];
export const ATTESTED_RECORD_FIELDS = ['title', 'description', 'date_achieved', 'category', 'file_url', 'file_type'];
export const PRESENTATION_RECORD_FIELDS = ['image_url', 'visibility', 'private_notes'];

export const FIELD_LABELS = {
  title: 'Title', description: 'Description', date_achieved: 'Date achieved',
  category: 'Category', evidence: 'Evidence', image_url: 'Cover image',
  visibility: 'Visibility', private_notes: 'Private notes',
  file_url: 'Evidence file', is_team: 'Team achievement', my_team_role: 'Your team role',
  team_participants: 'Team members', nominated_verifier_email: 'Nominated verifier',
  credential_type_title: 'Credential type', verification_tier: 'Verification tier',
  external_verifier_email: 'External verifier', organisation_name: 'Organisation',
  domain: 'Category',
};

const ok = (status, payload) => ({ status, payload });
const bad = (error, status = 400, extra = {}) => ({ status, payload: { ok: false, error, ...extra } });

// Request states where a direct edit is governed by these rules (draft and
// changes_requested are freely editable through the submit/resubmit flow).
const PENDING_EDITABLE = ['submitted', 'under_review', 'verifier_signed', 'awaiting_second_approval', 'awaiting_external_verification'];
const REQUEST_TERMINAL = ['minted', 'archived', 'rejected', 'expired', 'withdrawn'];

const nowIso = () => new Date().toISOString();

// Value equality across scalars, arrays and objects.
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// Diff a target against submitted edits, restricted to allowed fields.
// Returns [{ field, old_value, new_value }] for fields that actually changed.
function diffEdits(target, edits, allowed) {
  const changes = [];
  for (const field of allowed) {
    if (!Object.prototype.hasOwnProperty.call(edits, field)) continue;
    const next = edits[field];
    if (same(target?.[field] ?? null, next)) continue;
    changes.push({ field, old_value: JSON.stringify(target?.[field] ?? null), new_value: JSON.stringify(next ?? null) });
  }
  return changes.map((c) => ({ ...c, apply: edits[c.field] }));
}

function appendEditHistory(existing, changes, editedBy, reason) {
  const at = nowIso();
  return [...(existing || []), ...changes.map((c) => ({
    field: c.field,
    old_value: c.old_value,
    new_value: c.new_value,
    edited_by: editedBy,
    edited_at: at,
    reason: reason || null,
  }))];
}

// Best-effort audit trail — every edit and correction writes one entry.
async function auditEdit(svc, { record_id, school_id, actor_email, actor_name, actor_role, action, changes, notes }) {
  try {
    await svc.entities.AuditLog.create({
      record_id,
      school_id: school_id || null,
      actor_email: actor_email || 'unknown',
      actor_name: actor_name || null,
      actor_role: actor_role || 'system',
      action,
      notes: `${notes}${changes?.length ? ` | changes: ${JSON.stringify(changes.map((c) => ({ field: c.field, old_value: c.old_value, new_value: c.new_value })))}` : ''}`,
      timestamp: nowIso(),
    });
  } catch (e) {
    console.error('[credentialEdits] audit write failed', e?.message || e);
  }
}

function display(actor) {
  return `${actor.first_name || ''} ${actor.last_name || ''}`.trim() || actor.actor_email;
}

// ═══════════════════ 1. EDITING A PENDING ACHIEVEMENT REQUEST ═══════════════════

async function applyRequestEdit(svc, actor, request, edits, confirmInvalidate) {
  const presentationChanges = diffEdits(request, edits, PRESENTATION_REQUEST_FIELDS);
  const attestedChanges = diffEdits(request, edits, ATTESTED_REQUEST_FIELDS);

  if (presentationChanges.length === 0 && attestedChanges.length === 0) {
    return bad('Nothing to change — the details you submitted are the same');
  }

  const now = nowIso();
  const studentName = display(actor);

  // Presentation-only edit — never disturbs the review in flight.
  if (attestedChanges.length === 0) {
    const payload = {};
    for (const c of presentationChanges) payload[c.field] = c.apply;
    await svc.entities.AchievementRequest.update(request.id, {
      ...payload,
      edit_history: appendEditHistory(request.edit_history, presentationChanges, actor.actor_email, 'Presentation edit — not part of the attestation'),
      event_log: appendEvent(request.event_log, logEvent('student_edited', actor.actor_email, studentName, 'student', `Presentation: ${presentationChanges.map((c) => FIELD_LABELS[c.field] || c.field).join(', ')}`)),
    });
    await auditEdit(svc, {
      record_id: request.id, school_id: request.school_id,
      actor_email: actor.actor_email, actor_name: studentName, actor_role: 'student',
      action: 'credential_edit_presentation', changes: presentationChanges,
      notes: `Presentation edit on pending request "${request.title}"`,
    });
    return ok(200, { ok: true, status: request.status, presentation_only: true });
  }

  // Attested edit — the student must confirm they understand this resets the review.
  if (confirmInvalidate !== true) {
    return bad('Editing details your verifier already reviewed sends this request back for a fresh review. Confirm to continue.', 409, { needs_confirm: true });
  }

  const verifierName = request.verification_mode === 'independent'
    ? (request.independent_verifier?.name || 'your verifier')
    : (request.nominated_verifier_name || request.nominated_verifier_email || 'your verifier');
  const allChanges = [...presentationChanges, ...attestedChanges];

  const payload = {};
  for (const c of allChanges) payload[c.field] = c.apply;

  await svc.entities.AchievementRequest.update(request.id, {
    ...payload,
    // Invalidate every signature and outstanding link — no signer can be
    // left attesting to content that changed underneath them.
    status: 'changes_requested',
    changes_requested_reason: `You edited details ${verifierName} had already reviewed (${attestedChanges.map((c) => FIELD_LABELS[c.field] || c.field).join(', ')}). Check everything over and resubmit — it will go back for a fresh review.`,
    verifier_signoff: null,
    admin_signoff: null,
    external_signoff: null,
    external_token: null,
    external_token_expires_at: null,
    approved_at: null,
    last_reviewer_action_at: now,
    edit_history: appendEditHistory(request.edit_history, allChanges, actor.actor_email, 'Attested details edited — review reset'),
    event_log: appendEvent(request.event_log, logEvent('student_edited', actor.actor_email, studentName, 'student', `Attested content changed (${attestedChanges.map((c) => FIELD_LABELS[c.field] || c.field).join(', ')}) — signatures cleared, fresh review required`)),
  });

  await auditEdit(svc, {
    record_id: request.id, school_id: request.school_id,
    actor_email: actor.actor_email, actor_name: studentName, actor_role: 'student',
    action: 'credential_edit_attested', changes: allChanges,
    notes: `Attested edit on pending request "${request.title}" — signatures invalidated`,
  });

  // Tell whoever was reviewing that the content changed and needs re-reviewing.
  const notifyTo = request.verification_mode === 'independent'
    ? request.external_verifier_email
    : request.nominated_verifier_email;
  if (notifyTo && request.status !== 'draft') {
    const html = requestEmailHtml(
      'Details changed on an achievement you were reviewing',
      [
        `<strong>${studentName}</strong> edited attested details on their request for <strong>${request.title}</strong> after you had started reviewing it.`,
        `Their earlier edit invalidated any review in progress. When they resubmit, the updated request will come back to you for a fresh review.`,
      ],
      `${appUrl()}/PendingSignoffs`,
      'Open my review queue'
    );
    await notifyRequest(notifyTo, `Details changed: "${request.title}" needs re-reviewing`, html);
    try {
      await svc.entities.Notification.create({
        user_email: notifyTo,
        school_id: request.school_id,
        title: `Details changed: "${request.title}"`,
        body: `${studentName} edited details you had started reviewing — it will return for a fresh review once resubmitted.`,
        type: 'request_changes',
        priority: 'normal',
        related_id: request.id,
      });
    } catch { /* in-app record is best-effort */ }
  }

  return ok(200, { ok: true, status: 'changes_requested', invalidated: true });
}

export async function runRequestEdit(svc, actor, body) {
  if (actor.actor_role !== 'student') return bad('Only the student who submitted this request can edit it', 403);
  let request = null;
  try {
    const rows = await svc.entities.AchievementRequest.filter({ id: body.request_id || 'none' });
    request = rows?.[0] || null;
  } catch { /* invalid id — treated as not found */ }
  if (!request) return bad('Request not found', 404);
  if (request.student_email !== actor.actor_email) return bad('This is not your request', 403);
  if (['draft', 'changes_requested'].includes(request.status)) {
    return bad('This one is waiting on your edits — use "Edit & resubmit" so it returns to your verifier properly');
  }
  if (!PENDING_EDITABLE.includes(request.status)) {
    return bad('This request can no longer be edited directly');
  }
  return applyRequestEdit(svc, actor, request, body.edits || {}, body.confirm_invalidate === true);
}

// ═══════════════════ 2. EDITING AN UNVERIFIED SELF-REPORTED ACHIEVEMENT ═══════════════════

const SELF_FIELDS = ['title', 'description', 'image_url', 'date_achieved', 'domain', 'organisation_name'];

export async function runSelfReportedEdit(svc, actor, body) {
  if (actor.actor_role !== 'student') return bad('Only the student who added this can edit it', 403);
  let self = null;
  try {
    const rows = await svc.entities.SelfReportedAchievement.filter({ id: body.self_id || 'none' });
    self = rows?.[0] || null;
  } catch { /* invalid id — treated as not found */ }
  if (!self) return bad('Achievement not found', 404);
  if (self.student_email !== actor.actor_email) return bad('This is not your achievement', 403);
  if (self.status === 'verified') return bad('This achievement is verified — open it from your verified credentials to change it');

  const edits = body.edits || {};

  // If verification is already in flight, the linked request is the source of
  // truth for attested details — route attested edits through the request's
  // rules so no signature can be bypassed.
  if (self.status === 'verification_requested' && self.verification_request_id) {
    const reqRows = await svc.entities.AchievementRequest.filter({ id: self.verification_request_id }).catch(() => []);
    const linked = reqRows?.[0] || null;
    if (linked && !REQUEST_TERMINAL.includes(linked.status)) {
      const requestEdits = {};
      for (const f of ['title', 'description', 'date_achieved', 'image_url']) {
        if (Object.prototype.hasOwnProperty.call(edits, f)) requestEdits[f] = edits[f];
      }
      const hasAttested = ['title', 'description', 'date_achieved'].some(
        (f) => Object.prototype.hasOwnProperty.call(edits, f) && !same(linked[f] ?? null, edits[f])
      );
      if (hasAttested) {
        if (['draft', 'changes_requested'].includes(linked.status)) {
          return bad('This one is mid-verification — edit it from the Pending tab so it returns to your verifier properly');
        }
        const r = await applyRequestEdit(svc, actor, linked, requestEdits, body.confirm_invalidate === true);
        if (r.status !== 200) return r;
      } else if (Object.prototype.hasOwnProperty.call(edits, 'image_url') && !same(linked.image_url ?? null, edits.image_url)) {
        await svc.entities.AchievementRequest.update(linked.id, {
          image_url: edits.image_url || null,
          edit_history: appendEditHistory(linked.edit_history, diffEdits(linked, { image_url: edits.image_url }, PRESENTATION_REQUEST_FIELDS), actor.actor_email, 'Presentation edit — not part of the attestation'),
        });
      }
    }
  }

  // Nothing has been attested on a plain self-reported item — edit freely.
  const changes = diffEdits(self, edits, SELF_FIELDS);
  if (!changes.length) return bad('Nothing to change — the details you entered are the same');
  if ('title' in edits && !(String(edits.title || '').trim())) return bad('A title is required');
  const payload = {};
  for (const c of changes) payload[c.field] = c.apply === '' ? null : c.apply;
  if (payload.title) payload.title = String(payload.title).trim();
  await svc.entities.SelfReportedAchievement.update(self.id, payload);
  await auditEdit(svc, {
    record_id: self.id, school_id: null,
    actor_email: actor.actor_email, actor_name: display(actor), actor_role: 'student',
    action: 'self_reported_edit', changes,
    notes: `Self-reported achievement "${payload.title || self.title}" edited`,
  });
  return ok(200, { ok: true });
}

// ═══════════════════ 3. EDITING A VERIFIED CREDENTIAL (presentation only) ═══════════════════

async function loadVerifiedCredential(svc, verification_id) {
  const rows = await svc.entities.BlockWardVerificationRegistry.filter({ verification_id: verification_id || 'none' });
  const reg = rows?.[0] || null;
  if (!reg) return null;
  const recRows = await svc.entities.StudentRecord.filter({ id: reg.student_record_id });
  return { reg, record: recRows?.[0] || null };
}

function ownsVerified(reg, record, actor) {
  const email = (actor.actor_email || '').toLowerCase();
  return (reg.student_email || '').toLowerCase() === email
    || (record?.owner_student_email || record?.student_email || '').toLowerCase() === email;
}

export async function runVerifiedEdit(svc, actor, body) {
  if (actor.actor_role !== 'student') return bad('Only the student who owns this credential can edit it', 403);
  const loaded = await loadVerifiedCredential(svc, body.verification_id);
  if (!loaded) return bad('Credential not found', 404);
  const { reg, record } = loaded;
  if (!ownsVerified(reg, record, actor)) return bad('This is not your credential', 403);

  const edits = body.edits || {};

  // ATTESTED fields are locked on a verified credential — by any route,
  // including this one. The only path is an approved correction (a new
  // version re-signed by the verifier).
  const attestedAttempt = Object.keys(edits).filter((f) => ATTESTED_RECORD_FIELDS.includes(f));
  if (attestedAttempt.length) {
    const signedBy = reg.teacher_name || record?.teacher_name || 'your verifier';
    const signedAt = reg.date_approved ? new Date(reg.date_approved).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'at verification';
    return bad(
      `${attestedAttempt.map((f) => FIELD_LABELS[f] || f).join(', ')} ${attestedAttempt.length === 1 ? 'was' : 'were'} verified by ${signedBy} on ${signedAt}, so ${attestedAttempt.length === 1 ? 'it' : 'they'} can't be edited directly. Request a correction instead — it goes back to your verifier to re-sign.`,
      403,
      { locked_fields: attestedAttempt, can_request_correction: true }
    );
  }

  if (record?.correction_status === 'pending') {
    return bad('A correction on this credential is awaiting review — presentation details can be edited once it is resolved');
  }

  const changes = [];
  if (Object.prototype.hasOwnProperty.call(edits, 'visibility')) {
    if (!['public', 'link_only', 'private'].includes(edits.visibility)) return bad('Invalid visibility option');
    if (!same(reg.visibility ?? 'public', edits.visibility)) changes.push({ field: 'visibility', old_value: JSON.stringify(reg.visibility ?? 'public'), new_value: JSON.stringify(edits.visibility), apply: edits.visibility });
  }
  if (Object.prototype.hasOwnProperty.call(edits, 'image_url')) {
    const next = (typeof edits.image_url === 'string' && edits.image_url.trim().startsWith('http')) ? edits.image_url.trim() : null;
    if (!same(reg.achievement_image ?? null, next)) changes.push({ field: 'image_url', old_value: JSON.stringify(reg.achievement_image ?? null), new_value: JSON.stringify(next), apply: next });
  }
  if (Object.prototype.hasOwnProperty.call(edits, 'private_notes') && record) {
    if (!same(record.private_notes ?? null, edits.private_notes || null)) changes.push({ field: 'private_notes', old_value: JSON.stringify(record.private_notes ?? null), new_value: JSON.stringify(edits.private_notes || null), apply: edits.private_notes || null });
  }
  if (!changes.length) return bad('Nothing to change — the details you entered are the same');

  for (const c of changes) {
    if (c.field === 'visibility') {
      await svc.entities.BlockWardVerificationRegistry.update(reg.id, { visibility: c.apply });
    } else if (c.field === 'image_url') {
      await svc.entities.BlockWardVerificationRegistry.update(reg.id, { achievement_image: c.apply });
      if (record) await svc.entities.StudentRecord.update(record.id, { custom_nft_image_url: c.apply });
    } else {
      await svc.entities.StudentRecord.update(record.id, { private_notes: c.apply });
    }
  }
  if (record) {
    await svc.entities.StudentRecord.update(record.id, {
      edit_history: appendEditHistory(record.edit_history, changes, actor.actor_email, 'Presentation edit — not part of the attestation'),
    });
  }
  await auditEdit(svc, {
    record_id: record?.id || reg.id, school_id: reg.school_id,
    actor_email: actor.actor_email, actor_name: display(actor), actor_role: 'student',
    action: 'credential_edit_presentation', changes,
    notes: `Presentation edit on verified credential ${reg.verification_id} ("${reg.achievement_title}")`,
  });
  return ok(200, { ok: true, presentation_only: true });
}

// ═══════════════════ 4. CORRECTION REQUESTS ON VERIFIED CREDENTIALS ═══════════════════

// Who reviews the correction: the original verifier if still staff at the
// issuing organisation, otherwise an admin of that organisation.
async function resolveCorrectionReviewer(svc, reg, record) {
  const teacherEmail = (record?.teacher_email || '').toLowerCase();
  if (teacherEmail && record?.school_id) {
    try {
      const rows = await svc.entities.UserProfile.filter({ user_email: teacherEmail });
      const p = rows?.find((x) => x.school_id === record.school_id && ['teacher', 'admin'].includes(x.user_type) && x.status === 'active');
      if (p) return { email: p.user_email, name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.user_email, fallback: false };
    } catch { /* fall through to admin */ }
  }
  if (record?.school_id) {
    try {
      const admins = await svc.entities.UserProfile.filter({ school_id: record.school_id, user_type: 'admin' });
      const a = (admins || []).find((x) => x.status === 'active');
      if (a) return { email: a.user_email, name: `${a.first_name || ''} ${a.last_name || ''}`.trim() || a.user_email, fallback: true };
    } catch { /* best-effort */ }
  }
  return null;
}

export async function submitCorrection(svc, actor, body) {
  if (actor.actor_role !== 'student') return bad('Only the student who owns this credential can request a correction', 403);
  const loaded = await loadVerifiedCredential(svc, body.verification_id);
  if (!loaded) return bad('Credential not found', 404);
  const { reg, record } = loaded;
  if (!ownsVerified(reg, record, actor)) return bad('This is not your credential', 403);
  if ((record?.verification_mode || reg.verification_mode) === 'independent') {
    return bad('Independently verified credentials carry their verifier\'s personal attestation — contact us and we\'ll help correct it with your verifier.');
  }
  if (!record) return bad('The source record for this credential could not be found', 404);
  if (record.correction_status === 'pending') return bad('A correction on this credential is already awaiting review');

  const proposed = {};
  for (const f of ['title', 'description', 'date_achieved', 'category']) {
    if (Object.prototype.hasOwnProperty.call(body.corrections || {}, f)) proposed[f] = body.corrections[f];
  }
  const changes = diffEdits(record, proposed, ['title', 'description', 'date_achieved', 'category']);
  if (!changes.length) return bad('Nothing to correct — the details you entered match the credential');
  const title = (proposed.title ?? (record.title || '')).toString().trim();
  if (!title) return bad('The corrected title can\'t be empty');
  if (!['academic', 'sports', 'arts', 'leadership', 'community', 'behaviour', 'special'].includes(String(proposed.category ?? record.category))) {
    return bad('Invalid category');
  }

  const reason = String(body.reason || '').trim();
  if (!reason) return bad('Say what is wrong and why — your verifier needs the context to re-sign');

  const reviewer = await resolveCorrectionReviewer(svc, reg, record);
  if (!reviewer) return bad('The original verifier and the issuing organisation could not be reached — contact us and we\'ll help correct this credential');

  const now = nowIso();
  await svc.entities.StudentRecord.update(record.id, {
    correction_status: 'pending',
    correction_proposed: {
      title: proposed.title ?? record.title,
      description: proposed.description ?? record.description ?? null,
      date_achieved: proposed.date_achieved ?? record.date_achieved ?? null,
      category: proposed.category ?? record.category,
    },
    correction_reason: reason,
    correction_requested_at: now,
    correction_requested_by: actor.actor_email,
    correction_approved_by: null,
    correction_declined_reason: null,
  });

  const changeList = changes.map((c) => `<li><strong>${FIELD_LABELS[c.field] || c.field}:</strong> ${c.old_value === 'null' ? '(empty)' : c.old_value} → ${c.new_value === 'null' ? '(empty)' : c.new_value}</li>`).join('');
  const html = requestEmailHtml(
    `Correction requested on a credential you verified`,
    [
      `<strong>${display(actor)}</strong> says something is wrong on <strong>${record.title || reg.achievement_title}</strong> (verified ${reg.date_approved ? new Date(reg.date_approved).toDateString() : 'earlier'}).`,
      `<blockquote style="border-left:3px solid #7c3aed;padding-left:12px;color:#64748b;">${reason}</blockquote>`,
      `Proposed correction:<ul>${changeList}</ul>`,
      reviewer.fallback
        ? `The original verifier is no longer available, so as an organisation admin you can review and re-sign this correction.`
        : `You verified this credential — review the correction and re-sign it, or decline with a reason.`,
      `If you approve, a new version is published. The original is kept permanently in the version history — corrections are transparent, never hidden.`,
    ],
    `${appUrl()}/PendingSignoffs`,
    'Review the correction'
  );
  await notifyRequest(reviewer.email, `Correction requested: "${record.title || reg.achievement_title}"`, html);
  try {
    await svc.entities.Notification.create({
      user_email: reviewer.email,
      school_id: record.school_id,
      title: `Correction requested: "${record.title || reg.achievement_title}"`,
      body: reason,
      type: 'request_changes',
      priority: 'normal',
      related_id: record.id,
    });
  } catch { /* best-effort */ }

  // Mirror on the originating request so the student's Pending view shows it.
  if (record.migrated_request_id) {
    const reqRows = await svc.entities.AchievementRequest.filter({ id: record.migrated_request_id }).catch(() => []);
    const req = reqRows?.[0];
    if (req) {
      await svc.entities.AchievementRequest.update(req.id, {
        correction_reason: reason,
        correction_requested_at: now,
        correction_approved_by: null,
        event_log: appendEvent(req.event_log, logEvent('correction_requested', actor.actor_email, display(actor), 'student', reason)),
      });
    }
  }

  await auditEdit(svc, {
    record_id: record.id, school_id: record.school_id,
    actor_email: actor.actor_email, actor_name: display(actor), actor_role: 'student',
    action: 'correction_requested', changes,
    notes: `Correction requested on verified credential ${reg.verification_id}: ${reason}`,
  });

  return ok(200, { ok: true, routed_to: reviewer });
}

export async function reviewCorrection(svc, actor, body) {
  const action = body.review; // approve | decline
  if (actor.actor_role === 'student') return bad('Corrections are reviewed by the original verifier or an organisation admin', 403);
  let record = null;
  try {
    const rows = await svc.entities.StudentRecord.filter({ id: body.record_id || 'none' });
    record = rows?.[0] || null;
  } catch { /* invalid id — treated as not found */ }
  if (!record) return bad('Credential not found', 404);
  if (record.correction_status !== 'pending') return bad('No correction is awaiting review on this credential');

  const isVerifier = (record.teacher_email || '').toLowerCase() === (actor.actor_email || '').toLowerCase();
  const isAdmin = actor.actor_role === 'admin' && record.school_id && record.school_id === actor.school_id;
  if (!isVerifier && !isAdmin) return bad('Only the original verifier or an admin of the issuing organisation can review this correction', 403);

  const regRows = await svc.entities.BlockWardVerificationRegistry.filter({ student_record_id: record.id }).catch(() => []);
  const reg = regRows?.[0] || null;

  if (action === 'decline') {
    const reason = String(body.reason || '').trim();
    if (!reason) return bad('A reason is required when declining a correction');
    await svc.entities.StudentRecord.update(record.id, {
      correction_status: 'declined',
      correction_declined_reason: reason,
      correction_approved_by: actor.actor_email,
    });
    if (reg) {
      const html = requestEmailHtml(
        'Your correction was declined',
        [
          `<strong>${display(actor)}</strong> reviewed your correction to <strong>${record.title}</strong> and declined it:`,
          `<blockquote style="border-left:3px solid #dc2626;padding-left:12px;color:#64748b;">${reason}</blockquote>`,
          `The verified details stay exactly as they were.`,
        ],
        `${appUrl()}/StudentBlockWards`,
        'View my credentials'
      );
      await notifyRequest(record.student_email, `Correction declined: "${record.title}"`, html);
      await notifyEvent(svc, {
        to_email: record.student_email, school_id: record.school_id,
        event_type: 'request_changes',
        title: `Correction declined: "${record.title}"`,
        body: reason,
        related_id: record.id,
      });
    }
    await auditEdit(svc, {
      record_id: record.id, school_id: record.school_id,
      actor_email: actor.actor_email, actor_name: display(actor), actor_role: actor.actor_role,
      action: 'correction_declined', changes: [],
      notes: `Correction on "${record.title}" declined: ${reason}`,
    });
    return ok(200, { ok: true, status: 'declined' });
  }

  if (action !== 'approve') return bad('Unknown review action');

  // The verifier re-signs the corrected content — method, attestation, signature.
  const signCheck = validateSignoff(body);
  if (signCheck.error) return bad(signCheck.error);

  const proposed = record.correction_proposed || {};
  const changes = diffEdits(record, {
    title: proposed.title ?? record.title,
    description: proposed.description ?? record.description ?? null,
    date_achieved: proposed.date_achieved ?? record.date_achieved ?? null,
    category: proposed.category ?? record.category,
  }, ['title', 'description', 'date_achieved', 'category']);
  if (!changes.length) return bad('Nothing to correct — the proposed details match the current credential');

  const now = nowIso();
  const newVersion = (record.version || 1) + 1;

  // ── Create the NEW version — never overwrite the old one ──
  const corrected = {};
  for (const c of changes) corrected[c.field] = c.apply;

  const newRecord = await svc.entities.StudentRecord.create({
    school_id: record.school_id,
    verification_mode: record.verification_mode || 'organisation',
    independent_verifier: record.independent_verifier || null,
    class_id: record.class_id || null,
    class_name: record.class_name || null,
    teacher_id: record.teacher_id || null,
    teacher_email: record.teacher_email || null,
    teacher_name: record.teacher_name || null,
    teacher_signature_url: record.teacher_signature_url || null,
    teacher_signed_at: record.teacher_signed_at || null,
    admin_id: record.admin_id || null,
    admin_email: record.admin_email || null,
    admin_name: record.admin_name || null,
    student_id: record.student_id || null,
    student_email: record.student_email,
    student_name: record.student_name || null,
    owner_student_id: record.owner_student_id || record.student_id || null,
    owner_student_email: record.owner_student_email || record.student_email,
    owner_school_id: record.owner_school_id || record.school_id || null,
    origin: record.origin || 'student',
    title: corrected.title ?? record.title,
    category: corrected.category ?? record.category,
    description: corrected.description ?? record.description ?? null,
    date_achieved: corrected.date_achieved ?? record.date_achieved ?? null,
    award_type_id: record.award_type_id || null,
    award_type_title: record.award_type_title || null,
    is_custom_award: record.is_custom_award || false,
    custom_award_icon: record.custom_award_icon || null,
    custom_award_color: record.custom_award_color || null,
    points: record.points || 0,
    teacher_notes: record.teacher_notes || null,
    file_url: record.file_url || null,
    file_type: record.file_type || null,
    certificate_url: record.certificate_url || null,
    custom_nft_image_url: record.custom_nft_image_url || null,
    private_notes: record.private_notes || null,
    status: record.status === 'archived' ? 'archived' : 'delivered_to_vault',
    delivered_to_student_vault: true,
    teacher_signed: record.teacher_signed || false,
    teacher_signature_id: record.teacher_signature_id || null,
    admin_signed: record.admin_signed || false,
    admin_signature_id: record.admin_signature_id || null,
    admin_signed_at: record.admin_signed_at || null,
    nft_image_url: record.nft_image_url || null,
    submitted_at: record.submitted_at || null,
    approved_at: now,
    verify_id: record.verify_id || null,
    vault_status: 'delivered',
    vault_delivered_at: record.vault_delivered_at || now,
    vault_delivered_by: record.vault_delivered_by || null,
    deleted: false,
    // ── version chain ──
    version: newVersion,
    previous_version_id: record.id,
    superseded_by_id: null,
    edit_history: appendEditHistory(record.edit_history, changes, record.correction_requested_by || record.student_email, `Correction approved by ${display(actor)} — ${record.correction_reason || 'corrected'}`),
    correction_status: 'approved',
    correction_proposed: null,
    correction_reason: record.correction_reason || null,
    correction_requested_at: record.correction_requested_at || null,
    correction_requested_by: record.correction_requested_by || null,
    correction_approved_by: actor.actor_email,
    correction_declined_reason: null,
    corrected_at: now,
  });

  // ── Retain + supersede the OLD version (never deleted) ──
  await svc.entities.StudentRecord.update(record.id, {
    status: 'superseded',
    superseded_by_id: newRecord.id,
    correction_status: 'approved',
    correction_approved_by: actor.actor_email,
    correction_declined_reason: null,
    corrected_at: now,
  });

  // ── New anchor: a NEW BlockWard for the new version. The old anchor is
  // never mutated — it stays attached to the retained old version. ──
  const oldBws = await svc.entities.BlockWard.filter({ student_record_id: record.id, status: 'active' }).catch(() => []);
  const oldBw = oldBws?.[0] || null;
  const newBw = await svc.entities.BlockWard.create({
    school_id: record.school_id || null,
    record_id: newRecord.id,
    student_record_id: newRecord.id,
    student_email: record.student_email,
    student_name: record.student_name || null,
    owner_student_id: record.owner_student_id || record.student_id || null,
    owner_student_email: record.owner_student_email || record.student_email,
    owner_school_id: record.owner_school_id || record.school_id || null,
    issuer_email: oldBw?.issuer_email || record.admin_email || record.teacher_email || null,
    issuer_name: oldBw?.issuer_name || record.admin_name || record.teacher_name || null,
    issuer_wallet: 'system',
    teacher_id: record.teacher_id || null,
    admin_id: record.admin_id || null,
    title: corrected.title ?? record.title,
    description: corrected.description ?? record.description ?? null,
    category: corrected.category ?? record.category,
    vault_status: 'delivered',
    status: 'active',
    minted_at: now,
  });
  await svc.entities.StudentRecord.update(newRecord.id, { blockward_id: newBw.id });

  // ── Publish the corrected version on the SAME public URL, transparently ──
  if (reg) {
    const hadAnchor = !!(reg.token_id || reg.transaction_hash);
    await svc.entities.BlockWardVerificationRegistry.update(reg.id, {
      achievement_title: corrected.title ?? record.title,
      achievement_description: corrected.description ?? record.description ?? null,
      achievement_category: corrected.category ?? record.category,
      date_achieved: corrected.date_achieved ?? record.date_achieved ?? null,
      blockward_id: newBw.id,
      student_record_id: newRecord.id,
      version: newVersion,
      corrected_at: now,
      correction_history: [...(reg.correction_history || []), {
        version: newVersion,
        corrected_at: now,
        approved_by: display(actor),
        reason: record.correction_reason || null,
        changes: changes.map((c) => ({ field: c.field, old_value: c.old_value, new_value: c.new_value })),
      }],
      // The previous version's anchor is snapshotted (never mutated); the
      // top-level anchor fields now describe the new version, whose own
      // on-chain anchor is minted by the existing anchoring pipeline.
      ...(hadAnchor ? {
        previous_anchor: {
          version: record.version || 1,
          blockward_id: oldBw?.id || reg.blockward_id || null,
          token_id: reg.token_id || null,
          transaction_hash: reg.transaction_hash || null,
          contract_address: reg.contract_address || null,
          blockchain_network: reg.blockchain_network || null,
          anchored_at: reg.date_delivered || reg.date_approved || null,
        },
        token_id: null,
        transaction_hash: null,
        contract_address: null,
        nft_status: 'pending',
        // The corrected version has new content — its commitment is minted
        // fresh by the anchoring pipeline; the old hash/cache must not leak.
        credential_hash: null,
        chain_check: null,
      } : {}),
      signer_chain: [...(reg.signer_chain || []), {
        role: 'Correction re-signed by',
        name: display(actor),
        method: body.method,
        method_note: (body.method_note || '').trim() || null,
        attestation: true,
        timestamp: now,
      }],
      // Share cards show the corrected content — regenerate on next request.
      share_card_hash: null,
      share_story_card_hash: null,
    });
  }

  // ── Re-anchor the corrected version (best-effort, post-response). The new
  // version's content commitment is minted fresh; the previous version's
  // anchor stays on-chain exactly as it was, snapshotted in previous_anchor. ──
  if (reg) {
    try { waitUntil(anchorCredential(svc, reg.id)); } catch (e) { /* best-effort */ }
  }

  // ── Mirror the approval on the originating request ──
  const reqRows = await svc.entities.AchievementRequest.filter({ student_record_id: record.id }).catch(() => []);
  const req = reqRows?.[0]
    || (record.migrated_request_id ? (await svc.entities.AchievementRequest.filter({ id: record.migrated_request_id }).catch(() => []))[0] : null);
  if (req) {
    await svc.entities.AchievementRequest.update(req.id, {
      version: newVersion,
      previous_version_id: record.id,
      correction_reason: record.correction_reason || null,
      correction_requested_at: record.correction_requested_at || null,
      correction_approved_by: actor.actor_email,
      event_log: appendEvent(req.event_log, logEvent('correction_approved', actor.actor_email, display(actor), actor.actor_role, `Version ${newVersion} published — original retained as version ${record.version || 1}`)),
    });
  }

  // ── Tell the student ──
  if (reg) {
    const changeList = changes.map((c) => `<li><strong>${FIELD_LABELS[c.field] || c.field}:</strong> ${c.old_value === 'null' ? '(empty)' : c.old_value} → ${c.new_value === 'null' ? '(empty)' : c.new_value}</li>`).join('');
    const html = requestEmailHtml(
      'Your correction was approved',
      [
        `<strong>${display(actor)}</strong> re-signed your corrected credential — version ${newVersion} of <strong>${corrected.title ?? record.title}</strong> is now live on your profile.`,
        `<ul>${changeList}</ul>`,
        `The original version stays in the credential's version history. Anyone checking the verification page can see it was corrected — transparently, never hidden.`,
      ],
      `${appUrl()}/verify/${reg.verification_id}`,
      'View my credential'
    );
    await notifyRequest(record.student_email, `Corrected: "${corrected.title ?? record.title}"`, html);
    await notifyEvent(svc, {
      to_email: record.student_email, school_id: record.school_id,
      event_type: 'request_signed_off',
      title: `Correction approved: "${corrected.title ?? record.title}"`,
      body: `${display(actor)} re-signed your corrected credential — version ${newVersion} is live.`,
      related_id: record.id,
    });
  }

  await auditEdit(svc, {
    record_id: record.id, school_id: record.school_id,
    actor_email: actor.actor_email, actor_name: display(actor), actor_role: actor.actor_role,
    action: 'correction_approved', changes,
    notes: `Correction approved — version ${newVersion} of "${corrected.title ?? record.title}" created (previous version ${record.id} retained & superseded)`,
  });

  return ok(200, { ok: true, status: 'approved', version: newVersion, record_id: newRecord.id, verification_id: reg?.verification_id || record.verify_id || null });
}

// ═══════════════════ VERIFIER-SIDE QUEUE + STUDENT-SIDE STATE ═══════════════════

export async function listCorrections(svc, actor) {
  if (actor.actor_role === 'student') return ok(200, { ok: true, corrections: [] });
  const rows = await svc.entities.StudentRecord.filter({ correction_status: 'pending' });
  const email = (actor.actor_email || '').toLowerCase();
  const visible = (rows || []).filter((r) =>
    (r.teacher_email || '').toLowerCase() === email
    || (actor.actor_role === 'admin' && r.school_id && r.school_id === actor.school_id)
  );
  const corrections = visible.map((r) => {
    const proposed = r.correction_proposed || {};
    const fields = ['title', 'description', 'date_achieved', 'category'];
    return {
      record_id: r.id,
      verification_id: r.verify_id || null,
      student_name: r.student_name || null,
      student_email: r.student_email || null,
      current_title: r.title,
      current_description: r.description || null,
      current_date_achieved: r.date_achieved || null,
      current_category: r.category || null,
      proposed_title: proposed.title ?? r.title,
      proposed_description: proposed.description ?? r.description ?? null,
      proposed_date_achieved: proposed.date_achieved ?? r.date_achieved ?? null,
      proposed_category: proposed.category ?? r.category,
      changed_fields: fields.filter((f) => !same(r[f] ?? null, proposed[f] ?? (f === 'description' ? (r.description ?? null) : r[f] ?? null))),
      reason: r.correction_reason || null,
      requested_at: r.correction_requested_at || null,
      requested_by: r.correction_requested_by || null,
      verifier_name: r.teacher_name || null,
      is_original_verifier: (r.teacher_email || '').toLowerCase() === email,
    };
  });
  return ok(200, { ok: true, corrections });
}

export async function getCredential(svc, actor, body) {
  if (actor.actor_role !== 'student') return bad('Only the student who owns this credential can open the editor', 403);
  const loaded = await loadVerifiedCredential(svc, body.verification_id);
  if (!loaded) return bad('Credential not found', 404);
  const { reg, record } = loaded;
  if (!ownsVerified(reg, record, actor)) return bad('This is not your credential', 403);
  return ok(200, {
    ok: true,
    credential: {
      verification_id: reg.verification_id,
      title: reg.achievement_title,
      description: reg.achievement_description || null,
      date_achieved: reg.date_achieved || null,
      category: reg.achievement_category || null,
      image_url: reg.achievement_image || null,
      visibility: reg.visibility || 'public',
      private_notes: record?.private_notes || null,
      version: reg.version || 1,
      corrected_at: reg.corrected_at || null,
      correction: {
        status: record?.correction_status || 'none',
        reason: record?.correction_reason || null,
        proposed: record?.correction_proposed || null,
        requested_at: record?.correction_requested_at || null,
        declined_reason: record?.correction_declined_reason || null,
      },
      verifier: {
        name: reg.teacher_name || record?.teacher_name || null,
        signed_at: reg.date_approved || null,
      },
    },
  });
}

// ═══════════════════ DISPATCH ═══════════════════

export async function runCredentialEditAction(svc, actor, body) {
  switch (body.action) {
    case 'edit_request': return runRequestEdit(svc, actor, body);
    case 'edit_self_reported': return runSelfReportedEdit(svc, actor, body);
    case 'edit_verified': return runVerifiedEdit(svc, actor, body);
    case 'request_correction': return submitCorrection(svc, actor, body);
    case 'review_correction': return reviewCorrection(svc, actor, body);
    case 'list_corrections': return listCorrections(svc, actor);
    case 'get_credential': return getCredential(svc, actor, body);
    default: return bad('Unknown action');
  }
}