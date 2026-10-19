// ============================================================================
// historicalAdminAction — Super Admin decisions on historical verification
// requests. Approving a verifier authorises the PERSON to review ONE specific
// request after recorded independent authority checks — it never verifies the
// achievement itself. Every transition is validated server-side and audited.
// Demo records are only manageable by the test super user, in test mode.
// ============================================================================
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { requireInternalAdmin } from '../../shared/internalAdmin.ts';
import { isTestModeEnabled, getTestSuperUserEmail } from '../../shared/testMode.ts';
import {
  VERIFIER_TOKEN_TTL_HOURS, MAX_VERIFIER_PROPOSALS, DEMO_STUDENT_EMAIL,
  genRequestRef, newVerifierToken, pushHEvent, notifyStudentEvent,
  sendTemplateEmail, superAdminRecipients, lower, appUrl,
} from '../../shared/historicalVerification.ts';

const bad = (msg: string, status = 400) => Response.json({ ok: false, error: msg }, { status });
const clean = (s: any, max: number) => { const v = String(s ?? '').trim(); return v ? v.slice(0, max) : null; };

export default async function (req: Request): Promise<Response> {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
    if (req.method !== 'POST') return bad('Method not allowed', 405);
    const base44 = createClientFromRequest(req);
    const { me, error } = await requireInternalAdmin(base44);
    if (error) return error;
    const body = await req.json().catch(() => ({})) || {};
    const { action, request_id } = body;
    if (!action || !request_id) return bad('action and request_id are required');
    if (action !== 'seed_demo' && !/^[a-f0-9]{24}$/i.test(String(request_id))) return bad('Request not found', 404);
    const svc = base44.asServiceRole;

    const rows = action === 'seed_demo' ? [] : await svc.entities.HistoricalAchievementRequest.filter({ id: request_id });
    const r = rows?.[0];
    if (!r) return bad('Request not found', 404);

    // Demo isolation: demo records are ONLY manageable by the test super user
    // while test mode is enabled. Real records never become demo and vice versa.
    const testSuper = isTestModeEnabled() && lower(me.email) === lower(getTestSuperUserEmail());
    if (r.demo && !testSuper) return bad('Demo records are only manageable in test mode by the test super user', 403);
    const emailStudent = (title: string, message: string, ctaLabel: string) => {
      if (r.demo) return Promise.resolve();
      return Promise.all([
        notifyStudentEvent(svc, r.student_email, title, message, 'request_changes', r.id),
        sendTemplateEmail(svc, {
          to: r.student_email, template_name: 'HistoricalStudentUpdate', event_type: 'historical_student_update',
          related_id: r.id, subject: title,
          variables: { headline: title, message, cta_url: `${appUrl()}/StudentBlockWards`, cta_label: ctaLabel, request_ref: r.request_ref },
        }),
      ]).catch(() => undefined);
    };

    if (action === 'approve_verifier') {
      if (!['pending_review', 'info_requested', 'verifier_rejected'].includes(r.status)) {
        return bad(`This request is "${r.status}" — the verifier can only be approved from an open review state`);
      }
      const checks = clean(body.authority_notes, 2000);
      if (!checks || checks.length < 20) {
        return bad('Record your independent authority checks (organisation website, official records, confirmed contact details...) before approving — approval without an authority-review record is not permitted');
      }
      const token = newVerifierToken();
      const expires = new Date(Date.now() + VERIFIER_TOKEN_TTL_HOURS * 3600 * 1000).toISOString();
      const updated = await svc.entities.HistoricalAchievementRequest.update(r.id, {
        status: 'verifier_authorized',
        authority_review: {
          reviewed_by: me.email, reviewed_at: new Date().toISOString(),
          checks, flags: Array.isArray(body.flags) ? body.flags.slice(0, 6).map((f: any) => String(f).slice(0, 120)) : [],
          notes: clean(body.notes, 1000),
        },
        verifier_token: token,
        verifier_token_expires_at: expires,
        verifier_token_used_at: null,
        review_rejected_reason: null,
        event_log: pushHEvent(r.event_log, 'verifier_approved', me.email, `Verifier authorised for this request only (token expires ${expires.slice(0, 10)}). Authority checks: ${checks.slice(0, 200)}`),
      });
      if (!r.demo) {
        await sendTemplateEmail(svc, {
          to: r.verifier_email, template_name: 'HistoricalVerifierInvite', event_type: 'historical_verifier_invite', related_id: r.id,
          variables: {
            verifier_name: r.verifier_name,
            student_first_name: String(r.student_name || 'The student').split(' ')[0],
            achievement_title: r.title, issuing_org: r.issuing_org, original_date: r.original_date,
            verify_url: `${appUrl()}/historical-verify/${token}`,
            expires_date: expires.slice(0, 10), request_ref: r.request_ref,
          },
        });
      }
      await notifyStudentEvent(svc, r.student_email, 'Verifier approved',
        `The verifier you nominated for "${r.title}" has been authorised by Blockward. They have 72 hours to confirm your achievement.`,
        'verifier_invited', r.id);
      return Response.json({ ok: true, status: 'verifier_authorized', demo_verifier_url: r.demo ? `${appUrl()}/historical-verify/${token}` : null });
    }

    if (action === 'reject_verifier') {
      if (!['pending_review', 'info_requested', 'verifier_authorized'].includes(r.status)) {
        return bad(`This request is "${r.status}" — the verifier can no longer be rejected`);
      }
      const reason = clean(body.reason, 1000);
      if (!reason) return bad('A recorded reason is required to reject a verifier');
      await svc.entities.HistoricalAchievementRequest.update(r.id, {
        status: 'verifier_rejected',
        review_rejected_reason: reason, review_rejected_at: new Date().toISOString(),
        verifier_token: null, verifier_token_expires_at: null,
        event_log: pushHEvent(r.event_log, 'verifier_rejected', me.email, reason),
      });
      await emailStudent('Verifier not approved', `The verifier you nominated for "${r.title}" was not approved. Reason: ${reason}. You can nominate a different verifier from your Vault.`, 'Open my Vault');
      return Response.json({ ok: true, status: 'verifier_rejected' });
    }

    if (action === 'request_info') {
      if (!['pending_review', 'verifier_rejected', 'verifier_declined'].includes(r.status)) {
        return bad(`This request is "${r.status}" — more information can only be requested during review`);
      }
      const message = clean(body.message, 2000);
      if (!message) return bad('Write what information the student should provide');
      await svc.entities.HistoricalAchievementRequest.update(r.id, {
        status: 'info_requested', info_request: message, info_requested_at: new Date().toISOString(), info_requested_by: me.email,
        event_log: pushHEvent(r.event_log, 'info_requested', me.email, message.slice(0, 200)),
      });
      await emailStudent('More information needed', message, 'Add information');
      return Response.json({ ok: true, status: 'info_requested' });
    }

    if (action === 'reject_request') {
      if (['issued', 'withdrawn'].includes(r.status)) return bad('This request can no longer be rejected');
      const reason = clean(body.reason, 1000);
      if (!reason) return bad('A recorded reason is required to reject a request');
      await svc.entities.HistoricalAchievementRequest.update(r.id, {
        status: 'rejected', review_rejected_reason: reason, review_rejected_at: new Date().toISOString(),
        verifier_token: null, verifier_token_expires_at: null,
        event_log: pushHEvent(r.event_log, 'request_rejected', me.email, reason),
      });
      await emailStudent('Verification request rejected', `Your request for "${r.title}" was rejected. Reason: ${reason}`, 'Open my Vault');
      return Response.json({ ok: true, status: 'rejected' });
    }

    if (action === 'issue_demo_credential') {
      // DEMO ONLY — never issues a real credential, never touches Polygon.
      if (!r.demo) return bad('Demo credentials can only be issued for demo records', 403);
      if (r.status !== 'verifier_confirmed') return bad('The demo verifier must confirm the achievement first');
      const demoBwId = 'BW-DEMO-' + crypto.randomUUID().slice(0, 6).toUpperCase();
      await svc.entities.HistoricalAchievementRequest.update(r.id, {
        status: 'issued',
        demo_credential: { bw_id: demoBwId, issued_at: new Date().toISOString(), issued_by: me.email },
        event_log: pushHEvent(r.event_log, 'demo_credential_issued', me.email, `DEMO credential ${demoBwId} — no real credential, no blockchain transaction`),
      });
      await notifyStudentEvent(svc, r.student_email, 'Demo credential issued (TEST MODE)', `"${r.title}" completed the demo workflow. This is a synthetic credential for demonstration only.`, 'achievement_verified', r.id);
      return Response.json({ ok: true, status: 'issued', demo_bw_id: demoBwId });
    }

    if (action === 'seed_demo') {
      // TEST MODE only — creates one synthetic demo request to walk the flow.
      if (!testSuper) return bad('Demo requests are seeded only by the test super user in test mode', 403);
      const ref = await genRequestRef(svc);
      const rec = await svc.entities.HistoricalAchievementRequest.create({
        request_ref: ref, student_email: DEMO_STUDENT_EMAIL, student_id: 'demo', student_name: 'Demo Student (TEST MODE)',
        title: 'Regional Swimming Championship — Gold Medal', category: 'sports',
        description: 'Won the U16 100m freestyle at the regional championship.', original_date: '2023-03-15',
        issuing_org: 'Emirates Swimming Federation (DEMO)', country: 'United Arab Emirates', certificate_ref: 'ESF-2023-0117',
        evidence: [{ name: 'Example award letter (demo)', url: 'https://example.com/demo-award-letter', kind: 'link' }],
        profile_full_name: 'Demo Student (TEST MODE)', linkedin_url: null, personal_website: null,
        verifier_name: 'Demo Coach', verifier_email: 'demo.coach@blockward.test', verifier_role: 'Head Coach',
        verifier_org: 'Emirates Swimming Federation (DEMO)', verifier_linkedin: null,
        verifier_relationship: 'Coached the student for three seasons',
        verifier_authority_claim: 'Head coach who awarded the medal at the championship',
        verifier_proposals: 1, status: 'pending_review', demo: true,
        event_log: pushHEvent([], 'created', me.email, 'Synthetic demo request seeded from the Super Admin console'),
      });
      return Response.json({ ok: true, request_id: rec.id, request_ref: ref });
    }

    return bad(`Unknown action "${action}"`);
  } catch (error) {
    return Response.json({ ok: false, error: error?.message || 'Unexpected error' }, { status: 500 });
  }
}