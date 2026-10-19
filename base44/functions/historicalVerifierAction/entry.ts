// ============================================================================
// historicalVerifierAction — the APPROVED verifier's final decision, made with
// the single-use expiring token (no account required). Guards enforced here:
//   - the token is looked up ONLY through its server-only hashed capability
//     record — it never exists on the student-readable request (P0/A02)
//   - the token must exist, be unexpired and unused (replay protection)
//   - the verifier must confirm their identity (typed full name) and their
//     authority to verify this specific achievement
//   - a durable server-side claim makes concurrent confirmations
//     single-winner, so a credential can never be issued twice (P0/A03)
// On confirmation (real mode) the credential is issued through the SAME
// Achievement / Credential / Polygon pipeline as every other credential —
// never a separate one. Demo mode stops at 'verifier_confirmed'.
// ============================================================================
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { issueCredential } from '../../shared/credentialIssuance.ts';
import {
  pushHEvent, notifyStudentEvent, sendTemplateEmail, lower, appUrl,
  findVerifierCapabilityByToken, markVerifierCapabilityUsed,
} from '../../shared/historicalVerification.ts';

const bad = (msg: string, status = 400) => Response.json({ ok: false, error: msg }, { status });
const METHODS = ['witnessed_in_person', 'reviewed_evidence', 'official_records', 'third_party', 'other'];
const clean = (s: any, max: number) => { const v = String(s ?? '').trim(); return v ? v.slice(0, max) : null; };
const CLAIM_TTL_MS = 10 * 60 * 1000; // stale-claim takeover window

export default async function (req: Request): Promise<Response> {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
    if (req.method !== 'POST') return bad('Method not allowed', 405);
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({})) || {};
    const token = String(body.token || '').trim();
    if (!token || token.length < 20) return bad('This verification link is not valid', 404);
    const { action } = body;
    if (!['confirm', 'cannot_verify', 'request_info'].includes(action)) return bad('Unknown action');
    const svc = base44.asServiceRole;

    // Capability lookup — the hash is the index; the raw token never queries
    // the student-readable request collection.
    const cap = await findVerifierCapabilityByToken(svc, token);
    if (!cap) return bad('This verification link is not valid', 404);
    const rows = await svc.entities.HistoricalAchievementRequest.filter({ request_ref: cap.request_ref });
    const r = rows?.[0];
    if (!r) return bad('This verification link is not valid', 404);
    if (cap.token_used_at) return bad('This verification link has already been used', 410);
    if (r.status !== 'verifier_authorized') return bad('This verification is no longer awaiting a decision', 410);
    if (cap.token_expires_at && new Date(cap.token_expires_at) <= new Date()) {
      return bad('This verification link has expired', 410);
    }

    // Explicit identity + authority confirmation — required on every decision.
    if (body.identity_confirmed !== true || body.authority_confirmed !== true) {
      return bad('Confirm your identity and your authority to verify this achievement');
    }
    const typedName = lower(body.full_name_confirm);
    if (!typedName || typedName !== lower(r.verifier_name)) {
      return bad('Type your full name exactly as shown to confirm your identity');
    }

    const ip = String(req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || null;
    const nowIso = new Date().toISOString();

    if (action === 'request_info') {
      // The verifier's own information request — kept SEPARATE from an
      // internal-review info request (status info_requested): the status stays
      // verifier_authorized so the token remains valid and the student can
      // answer it (P1/A06).
      const message = clean(body.message, 2000);
      if (!message) return bad('Write what you need from the student');
      await svc.entities.HistoricalAchievementRequest.update(r.id, {
        verifier_info_request: { message, requested_at: nowIso },
        event_log: pushHEvent(r.event_log, 'info_requested', r.verifier_name, `Verifier: ${message.slice(0, 200)}`),
      });
      // The token stays valid — the verifier can still decide later.
      await notifyStudentEvent(svc, r.student_email, 'The verifier asked for more information',
        `${r.verifier_name} needs more information about "${r.title}" before confirming: ${message}`,
        'request_changes', r.id);
      if (!r.demo) {
        await sendTemplateEmail(svc, {
          to: r.student_email, template_name: 'HistoricalStudentUpdate', event_type: 'historical_student_update', related_id: r.id,
          subject: 'The verifier asked for more information',
          variables: {
            headline: 'More information needed', message: `${r.verifier_name} needs more information about "${r.title}" before confirming: ${message}`,
            cta_url: `${appUrl()}/StudentBlockWards`, cta_label: 'Open my Vault', request_ref: r.request_ref,
          },
        });
      }
      return Response.json({ ok: true, status: r.status });
    }

    if (action === 'cannot_verify') {
      const reason = clean(body.reason, 1000);
      if (!reason) return bad('Tell the student briefly why you cannot verify this achievement');
      await svc.entities.HistoricalAchievementRequest.update(r.id, {
        status: 'verifier_declined', decision: 'cannot_verify', decision_note: reason,
        decided_at: nowIso, decision_ip: ip, decision_claimed_by: null, decision_claimed_at: null,
        event_log: pushHEvent(r.event_log, 'declined', r.verifier_name, reason.slice(0, 200)),
      });
      await markVerifierCapabilityUsed(svc, cap.id);
      await notifyStudentEvent(svc, r.student_email, 'The verifier could not confirm your achievement',
        `${r.verifier_name} could not verify "${r.title}": ${reason} You can nominate a different verifier from your Vault.`,
        'achievement_rejected', r.id);
      if (!r.demo) {
        await sendTemplateEmail(svc, {
          to: r.student_email, template_name: 'HistoricalStudentUpdate', event_type: 'historical_student_update', related_id: r.id,
          subject: 'The verifier could not confirm your achievement',
          variables: {
            headline: 'The verifier could not confirm', message: `${r.verifier_name} could not verify "${r.title}": ${reason} You can nominate a different verifier from your Vault.`,
            cta_url: `${appUrl()}/StudentBlockWards`, cta_label: 'Open my Vault', request_ref: r.request_ref,
          },
        });
      }
      return Response.json({ ok: true, status: 'verifier_declined' });
    }

    // ── action === 'confirm' ──
    const method = METHODS.includes(body.method) ? body.method : null;
    if (!method) return bad('Select how you verified this achievement');
    const note = clean(body.note, 1000);

    if (r.demo) {
      // DEMO: stop at verifier_confirmed — no real credential, no blockchain.
      await svc.entities.HistoricalAchievementRequest.update(r.id, {
        status: 'verifier_confirmed', decision: 'confirmed', decision_method: method, decision_note: note,
        decided_at: nowIso, decision_ip: ip, decision_claimed_by: null, decision_claimed_at: null,
        event_log: pushHEvent(r.event_log, 'confirmed', r.verifier_name, `DEMO confirmation (${method}). The demo Super Admin can now issue the synthetic credential.`),
      });
      await markVerifierCapabilityUsed(svc, cap.id);
      await notifyStudentEvent(svc, r.student_email, 'Demo verifier confirmed (TEST MODE)', `"${r.title}" was confirmed by the simulated verifier. The demo credential can now be issued.`, 'achievement_verified', r.id);
      return Response.json({ ok: true, status: 'verifier_confirmed', demo: true });
    }

    // REAL MODE — durable single-winner claim (P0/A03): an atomic server-side
    // status transition. Two concurrent callers race the same conditional
    // update; only the winner sees its own claim id on the re-read.
    const claimId = crypto.randomUUID();
    await svc.entities.HistoricalAchievementRequest.updateMany(
      { request_ref: r.request_ref, status: 'verifier_authorized' },
      { $set: { status: 'decision_processing', decision_claimed_by: claimId, decision_claimed_at: nowIso } },
    );
    let cur = (await svc.entities.HistoricalAchievementRequest.filter({ request_ref: r.request_ref }))?.[0];
    if (cur?.status !== 'decision_processing' || cur.decision_claimed_by !== claimId) {
      // Another confirmation won the race — unless its claim went stale
      // (>10 min, e.g. a crashed attempt), in which case we take it over via
      // a compare-and-set on the exact previous claim.
      const claimedMs = cur?.decision_claimed_at ? new Date(cur.decision_claimed_at).getTime() : 0;
      const stale = cur?.status === 'decision_processing' && (Date.now() - claimedMs) > CLAIM_TTL_MS;
      if (!stale) return bad('This verification is already being processed', 409);
      await svc.entities.HistoricalAchievementRequest.updateMany(
        { request_ref: r.request_ref, status: 'decision_processing', decision_claimed_by: cur.decision_claimed_by },
        { $set: { decision_claimed_by: claimId, decision_claimed_at: new Date().toISOString() } },
      );
      cur = (await svc.entities.HistoricalAchievementRequest.filter({ request_ref: r.request_ref }))?.[0];
      if (cur?.status !== 'decision_processing' || cur.decision_claimed_by !== claimId) {
        return bad('This verification is already being processed', 409);
      }
    }
    const claimed = cur;

    // REAL MODE — issue through the canonical pipeline: Achievement record →
    // issueCredential (BW-HASH-V1 commitment, Polygon anchor, holder email).
    // Every persistence boundary leaves a recoverable idempotency link, so a
    // failure or retry can never create a second achievement or credential.
    try {
      let ach = null;
      if (claimed.decision_achievement_id) {
        ach = (await svc.entities.Achievement.filter({ id: claimed.decision_achievement_id }))?.[0] || null;
      }
      if (!ach) {
        ach = await svc.entities.Achievement.create({
          holder_id: r.student_id, holder_email: r.student_email, holder_name: r.student_name,
          title: r.title, category: r.category, description: r.description,
          issuer_org: r.issuing_org, issuer_website: null,
          date_achieved: r.original_date, external_credential_id: r.certificate_ref || null,
          certificate_url: (r.evidence || []).find((e: any) => e.kind === 'file')?.url || null,
          certificate_name: (r.evidence || []).find((e: any) => e.kind === 'file')?.name || null,
          is_public: false, status: 'issuer_confirmed',
          event_log: pushHEvent([], 'issuer_confirmed', r.verifier_name, `Historical achievement confirmed by the Super-Admin-approved verifier (${method})`),
        });
        // Persist the link BEFORE issuance — a crash after this point recovers
        // without ever creating a second achievement.
        await svc.entities.HistoricalAchievementRequest.updateMany(
          { request_ref: r.request_ref, status: 'decision_processing', decision_claimed_by: claimId },
          { $set: { decision_achievement_id: ach.id } },
        );
      }

      // A previous attempt may already have issued the credential — finalize
      // instead of reissuing.
      let cred = claimed.credential_id
        ? (await svc.entities.Credential.filter({ id: claimed.credential_id }))?.[0] || null
        : null;
      let bwId = claimed.credential_bw_id || cred?.bw_id || null;
      if (!cred) {
        const issuance = await issueCredential(svc, {
          ach, vr: null, method,
          verifiers: [{ name: r.verifier_name, title: r.verifier_role, signed_at: nowIso }],
          methodNote: note, actorEmail: r.verifier_email,
        });
        cred = issuance.cred;
        bwId = issuance.bwId;
      }

      await svc.entities.HistoricalAchievementRequest.update(r.id, {
        status: 'issued', decision: 'confirmed', decision_method: method, decision_note: note,
        decided_at: nowIso, decision_ip: ip,
        credential_id: cred?.id || null, credential_bw_id: bwId || null,
        decision_claimed_by: null, decision_claimed_at: null,
        event_log: pushHEvent(r.event_log, 'credential_issued', 'system', `Blockward Verified credential ${bwId} issued — original date ${r.original_date} preserved`),
      });
      await markVerifierCapabilityUsed(svc, cap.id);
      await notifyStudentEvent(svc, r.student_email, 'Achievement confirmed and credential issued',
        `"${r.title}" was confirmed by ${r.verifier_name} and issued as Blockward Verified credential ${bwId}. The blockchain proof is being processed.`,
        'achievement_verified', ach.id);
      return Response.json({ ok: true, status: 'issued', bw_id: bwId });
    } catch (issuanceError) {
      // No credential yet → release OUR claim so the verifier can retry at
      // once; the persisted achievement link survives for idempotent recovery.
      // With a credential on record the state stays decision_processing for
      // the next attempt to finalize — never a silent second issuance.
      if (!claimed.credential_id) {
        await svc.entities.HistoricalAchievementRequest.updateMany(
          { request_ref: r.request_ref, status: 'decision_processing', decision_claimed_by: claimId },
          { $set: { status: 'verifier_authorized', decision_claimed_by: null, decision_claimed_at: null } },
        ).catch(() => undefined);
      }
      throw issuanceError;
    }
  } catch (error) {
    return Response.json({ ok: false, error: error?.message || 'Unexpected error' }, { status: 500 });
  }
}