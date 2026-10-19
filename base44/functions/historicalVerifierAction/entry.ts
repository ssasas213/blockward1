// ============================================================================
// historicalVerifierAction — the APPROVED verifier's final decision, made with
// the single-use expiring token (no account required). Guards enforced here:
//   - token must exist, be unexpired and unused (replay protection)
//   - the verifier must confirm their identity (typed full name) and their
//     authority to verify this specific achievement
//   - the Super Admin approval covered this request ONLY
// On confirmation (real mode) the credential is issued through the SAME
// Achievement / Credential / Polygon pipeline as every other credential —
// never a separate one. Demo mode stops at 'verifier_confirmed'.
// ============================================================================
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { resolveEffectiveActor } from '../../shared/testMode.ts';
import { issueCredential } from '../../shared/credentialIssuance.ts';
import { pushHEvent, notifyStudentEvent, sendTemplateEmail, lower, appUrl } from '../../shared/historicalVerification.ts';

const bad = (msg: string, status = 400) => Response.json({ ok: false, error: msg }, { status });
const METHODS = ['witnessed_in_person', 'reviewed_evidence', 'official_records', 'third_party', 'other'];
const clean = (s: any, max: number) => { const v = String(s ?? '').trim(); return v ? v.slice(0, max) : null; };

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

    const rows = await svc.entities.HistoricalAchievementRequest.filter({ verifier_token: token });
    const r = rows?.[0];
    if (!r) return bad('This verification link is not valid', 404);
    if (r.verifier_token_used_at) return bad('This verification link has already been used', 410);
    if (r.status !== 'verifier_authorized') return bad('This verification is no longer awaiting a decision', 410);
    if (r.verifier_token_expires_at && new Date(r.verifier_token_expires_at) <= new Date()) {
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
      const message = clean(body.message, 2000);
      if (!message) return bad('Write what you need from the student');
      await svc.entities.HistoricalAchievementRequest.update(r.id, {
        info_request: message, info_requested_at: nowIso, info_requested_by: r.verifier_name,
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
        decided_at: nowIso, decision_ip: ip, verifier_token_used_at: nowIso,
        event_log: pushHEvent(r.event_log, 'declined', r.verifier_name, reason.slice(0, 200)),
      });
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
        decided_at: nowIso, decision_ip: ip, verifier_token_used_at: nowIso,
        event_log: pushHEvent(r.event_log, 'confirmed', r.verifier_name, `DEMO confirmation (${method}). The demo Super Admin can now issue the synthetic credential.`),
      });
      await notifyStudentEvent(svc, r.student_email, 'Demo verifier confirmed (TEST MODE)', `"${r.title}" was confirmed by the simulated verifier. The demo credential can now be issued.`, 'achievement_verified', r.id);
      return Response.json({ ok: true, status: 'verifier_confirmed', demo: true });
    }

    // REAL MODE — issue through the canonical pipeline: Achievement record →
    // issueCredential (BW-HASH-V1 commitment, Polygon anchor, holder email).
    const ach = await svc.entities.Achievement.create({
      holder_id: r.student_id, holder_email: r.student_email, holder_name: r.student_name,
      title: r.title, category: r.category, description: r.description,
      issuer_org: r.issuing_org, issuer_website: null,
      date_achieved: r.original_date, external_credential_id: r.certificate_ref || null,
      certificate_url: (r.evidence || []).find((e: any) => e.kind === 'file')?.url || null,
      certificate_name: (r.evidence || []).find((e: any) => e.kind === 'file')?.name || null,
      is_public: false, status: 'issuer_confirmed',
      event_log: pushHEvent([], 'issuer_confirmed', r.verifier_name, `Historical achievement confirmed by the Super-Admin-approved verifier (${method})`),
    });
    const issuance = await issueCredential(svc, {
      ach, vr: null, method,
      verifiers: [{ name: r.verifier_name, title: r.verifier_role, signed_at: nowIso }],
      methodNote: note, actorEmail: r.verifier_email,
    });
    await svc.entities.HistoricalAchievementRequest.update(r.id, {
      status: 'issued', decision: 'confirmed', decision_method: method, decision_note: note,
      decided_at: nowIso, decision_ip: ip, verifier_token_used_at: nowIso,
      credential_id: issuance.cred?.id || null, credential_bw_id: issuance.bwId || null,
      event_log: pushHEvent(r.event_log, 'credential_issued', 'system', `Blockward Verified credential ${issuance.bwId} issued — original date ${r.original_date} preserved`),
    });
    await notifyStudentEvent(svc, r.student_email, 'Achievement confirmed and credential issued',
      `"${r.title}" was confirmed by ${r.verifier_name} and issued as Blockward Verified credential ${issuance.bwId}. The blockchain proof is being processed.`,
      'achievement_verified', ach.id);
    return Response.json({ ok: true, status: 'issued', bw_id: issuance.bwId });
  } catch (error) {
    return Response.json({ ok: false, error: error?.message || 'Unexpected error' }, { status: 500 });
  }
}