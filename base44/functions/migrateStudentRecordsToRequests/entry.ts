// migrateStudentRecordsToRequests — ONE-TIME migration that makes
// AchievementRequest the single entry point for student-initiated achievements.
//
//  1. Status vocabulary pass: every AchievementRequest whose terminal status is
//     the deprecated 'minted' is renamed to the canonical 'archived'.
//  2. Every legacy student-submitted StudentRecord (origin 'student') that is
//     not already tracked by an AchievementRequest is converted into one —
//     preserving title, category, description, date achieved, evidence, the
//     nominated teacher, DigitalSignature sign-offs, the audit trail link and
//     the current lifecycle status. The ORIGINAL StudentRecord is NOT deleted:
//     it is marked with migrated_request_id + migrated_at and stays queryable.
//     Every conversion is written to the AuditLog and the request's event_log.
//
// Idempotent: safe to run repeatedly — already-migrated records and
// request-linked records are skipped.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { resolveEffectiveActor, verifyTestSuperUser } from '../../shared/testMode.ts';
import { logEvent, appendEvent } from '../../shared/achievementRequests.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'content-type': 'application/json',
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    // ── Authorisation: organisation admins, or the server-authorised test super user ──
    let actorEmail: string | null = null;
    let actorName = 'Organisation admin';
    const tsu = await verifyTestSuperUser(base44);
    if (tsu.authorized) {
      actorEmail = (tsu.user?.email || '').toLowerCase() || null;
      actorName = 'Test super user';
    } else {
      const actor = await resolveEffectiveActor(base44);
      if (!actor.authorized || actor.actor_role !== 'admin') {
        return Response.json({ ok: false, error: 'Only organisation admins can run the migration' }, { status: 403, headers: CORS });
      }
      actorEmail = actor.actor_email;
      actorName = `${actor.first_name || ''} ${actor.last_name || ''}`.trim() || actor.actor_email;
    }
    if (!actorEmail) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401, headers: CORS });

    const now = new Date().toISOString();

    // ── 1. Status vocabulary pass: terminal 'minted' → canonical 'archived' ──
    const mintedRows = await svc.entities.AchievementRequest.filter({ status: 'minted' }, '-created_date', 500);
    let statuses_updated = 0;
    for (const r of mintedRows) {
      await svc.entities.AchievementRequest.update(r.id, {
        status: 'archived',
        event_log: appendEvent(r.event_log, logEvent('migrated', 'system', 'BlockWard', 'system', "Terminal status 'minted' renamed to canonical 'archived'")),
      });
      statuses_updated++;
    }

    // ── 2. Records already tracked by the request pipeline (never migrate those) ──
    const allRequests = await svc.entities.AchievementRequest.filter({}, '-created_date', 500);
    const linkedRecordIds = new Set<string>(
      allRequests.map((r: any) => r.student_record_id).filter(Boolean)
    );

    // ── 3. Convert legacy student submissions ──
    const legacyRecords = await svc.entities.StudentRecord.filter({ origin: 'student' }, '-created_date', 500);
    const schoolNames = new Map<string, string | null>();
    const schoolName = async (id: string): Promise<string | null> => {
      if (!id) return null;
      if (schoolNames.has(id)) return schoolNames.get(id) ?? null;
      let name: string | null = null;
      try {
        const rows = await svc.entities.School.filter({ id });
        name = rows?.[0]?.name || null;
      } catch (_) { /* best-effort */ }
      schoolNames.set(id, name);
      return name;
    };

    let converted = 0, skipped = 0, failed = 0;
    const conversions: any[] = [];
    const failures: any[] = [];

    for (const record of legacyRecords) {
      if (record.migrated_request_id || linkedRecordIds.has(record.id)) { skipped++; continue; }
      // Pipeline-minted copies (e.g. team-participant records created by the
      // credential mint) were never submitted through the legacy form: a
      // terminal record with no teacher DigitalSignature is one of those.
      // Never fabricate a "student submission" request for them.
      if (!record.teacher_signature_id && ['delivered_to_vault', 'archived', 'minted'].includes(record.status)) { skipped++; continue; }
      try {
        const request = await convertRecord(svc, record, now, schoolName);
        // Mark the ORIGINAL record — never delete it. It stays queryable as history.
        await svc.entities.StudentRecord.update(record.id, {
          migrated_request_id: request.id,
          migrated_at: now,
        });
        // Log every conversion: AuditLog + the request's event_log.
        await svc.entities.AuditLog.create({
          record_id: record.id,
          school_id: record.school_id,
          actor_email: actorEmail,
          actor_name: actorName,
          actor_role: 'admin',
          action: 'migrated_to_request',
          old_status: record.status,
          new_status: request.status,
          notes: `Legacy student submission converted to achievement request ${request.id}`,
          timestamp: now,
        });
        converted++;
        conversions.push({ record_id: record.id, request_id: request.id, status: request.status, title: record.title });
      } catch (e: any) {
        failed++;
        failures.push({ record_id: record.id, error: e?.message || String(e) });
      }
    }

    return Response.json({
      ok: true,
      converted,
      skipped,
      failed,
      statuses_updated,
      conversions,
      failures,
    }, { headers: CORS });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || String(e) }, { status: 500, headers: CORS });
  }
});

// ── Helpers ──

// Map a legacy record's workflow status onto the AchievementRequest lifecycle,
// preserving timestamps and delivery links along the way.
function mapStatus(record: any): { status: string; extra: Record<string, any> } {
  const extra: Record<string, any> = {};
  switch (record.status) {
    case 'submitted':
    case 'awaiting_teacher_signature':
      return { status: 'submitted', extra: { submitted_at: record.submitted_at || record.created_date || null } };
    case 'awaiting_admin_signature':
      return { status: 'awaiting_second_approval', extra: { submitted_at: record.submitted_at || record.created_date || null } };
    case 'changes_requested':
      return { status: 'changes_requested', extra: { changes_requested_reason: record.changes_requested_reason || null, last_reviewer_action_at: record.changes_requested_at || null } };
    case 'approved':
    case 'delivering':
      return { status: 'approved', extra: { submitted_at: record.submitted_at || null, approved_at: record.approved_at || null } };
    case 'delivered_to_vault':
    case 'archived':
    case 'minted':
      return {
        status: 'archived',
        extra: {
          submitted_at: record.submitted_at || null,
          approved_at: record.approved_at || record.vault_delivered_at || null,
          minted_at: record.vault_delivered_at || record.approved_at || record.created_date || null,
          blockward_id: record.blockward_id || null,
          verification_id: record.verify_id || null,
        },
      };
    case 'rejected':
      return { status: 'rejected', extra: { rejection_reason: record.rejection_reason || record.teacher_rejection_reason || null, last_reviewer_action_at: record.updated_date || null } };
    default: // draft + anything unexpected
      return { status: 'draft', extra: {} };
  }
}

// Rebuild a request sign-off object from the record's legacy DigitalSignature.
async function signoffFromSignature(svc: any, sigId: string, record: any, role: string): Promise<any | null> {
  if (!sigId) return null;
  try {
    const rows = await svc.entities.DigitalSignature.filter({ id: sigId });
    const sig = rows?.[0];
    if (!sig) return null;
    return {
      signer_id: null,
      signer_email: sig.signer_email || (role === 'admin' ? record.admin_email : record.teacher_email) || null,
      signer_name: sig.signer_name || null,
      signer_role: role,
      method: 'other',
      method_note: 'Verified through the legacy student submission flow (migrated)',
      attestation: true,
      signature: sig.signature_type === 'drawn' ? (sig.signer_name || 'Signed') : (sig.signature_value || sig.signer_name || 'Signed'),
      ip_country: null,
      signed_at: sig.signed_at || null,
    };
  } catch (_) {
    return null;
  }
}

async function convertRecord(svc: any, record: any, now: string, schoolName: (id: string) => Promise<string | null>): Promise<any> {
  const mapped = mapStatus(record);
  const verifierSignoff = await signoffFromSignature(svc, record.teacher_signature_id, record, 'nominated_verifier');
  const adminSignoff = await signoffFromSignature(svc, record.admin_signature_id, record, 'admin');

  const evidence: any[] = [];
  if (record.file_url) evidence.push({ type: 'file', url: record.file_url, name: 'Evidence' });
  if (record.certificate_url) evidence.push({ type: 'file', url: record.certificate_url, name: 'Certificate' });

  return await svc.entities.AchievementRequest.create({
    school_id: record.school_id,
    school_name: await schoolName(record.school_id),
    student_id: record.owner_student_id || record.student_id || null,
    student_email: record.owner_student_email || record.student_email,
    student_name: record.student_name || null,
    credential_type_id: record.award_type_id || null,
    credential_type_title: record.award_type_title || 'Student submission',
    is_custom_credential: !record.award_type_id,
    category: record.category || 'special',
    title: record.title,
    description: record.description || null,
    date_achieved: record.date_achieved || null,
    evidence,
    nominated_verifier_id: record.teacher_id || null,
    nominated_verifier_email: record.teacher_email || null,
    nominated_verifier_name: record.teacher_name || null,
    verification_tier: record.admin_signed ? 2 : 1,
    status: mapped.status,
    verifier_signoff: verifierSignoff,
    admin_signoff: adminSignoff,
    // Link the source-of-truth record so the credential pipeline reuses it
    // (never duplicates it) if this request is published later.
    student_record_id: record.id,
    event_log: [
      logEvent('created', record.owner_student_email || record.student_email, record.student_name || null, 'student', 'Legacy student submission'),
      logEvent('migrated', 'system', 'BlockWard', 'system', `Converted from legacy student submission (record ${record.id})`),
      ...Object.keys(mapped.extra).length ? [logEvent('updated', 'system', 'BlockWard', 'system', `Status preserved from the legacy flow: '${record.status}'`)] : [],
    ],
    ...mapped.extra,
  });
}