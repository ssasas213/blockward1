// ============================================================================
// historicalStudentAction — student-side actions on their OWN historical
// verification request: answer an information request, re-propose a verifier
// (capped), or withdraw. Every record is checked against the effective actor's
// email — a student can never touch another student's request.
// ============================================================================
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { resolveEffectiveActor } from '../../shared/testMode.ts';
import {
  OPEN_STATUSES, MAX_VERIFIER_PROPOSALS, pushHEvent, notifyStudentEvent,
  sendTemplateEmail, superAdminRecipients, validateLinkedIn, validateHttpUrl, lower,
} from '../../shared/historicalVerification.ts';

const bad = (msg: string, status = 400) => Response.json({ ok: false, error: msg }, { status });
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean = (s: any, max: number) => { const v = String(s ?? '').trim(); return v ? v.slice(0, max) : null; };

export default async function (req: Request): Promise<Response> {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
    if (req.method !== 'POST') return bad('Method not allowed', 405);
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({})) || {};
    const { action, request_id } = body;
    if (!action || !request_id) return bad('action and request_id are required');
    const svc = base44.asServiceRole;

    const actor = await resolveEffectiveActor(base44);
    if (!actor.authorized) return bad(actor.reason || 'Authentication required', actor.status || 401);

    const rows = await svc.entities.HistoricalAchievementRequest.filter({ id: request_id });
    const r = rows?.[0];
    if (!r) return bad('Request not found', 404);
    if (lower(r.student_email) !== lower(actor.actor_email)) return bad('This request belongs to another student', 403);

    if (action === 'provide_info') {
      if (r.status !== 'info_requested') return bad('More information is not currently requested on this verification');
      const message = clean(body.message, 2000);
      if (!message) return bad('Write your response');
      const extra = [];
      for (const e of (Array.isArray(body.extra_evidence) ? body.extra_evidence : []).slice(0, 5)) {
        if (!e || !e.url) continue;
        const isLink = e.kind === 'link' || /^https?:\/\//i.test(e.url);
        if (isLink && !validateHttpUrl(e.url)) return bad('Evidence links must be https URLs');
        extra.push({ name: clean(e.name, 160) || 'Additional evidence', url: String(e.url).slice(0, 1000), kind: isLink ? 'link' : 'file' });
      }
      const updates = [...(r.student_updates || []), { kind: 'info', message, evidence_added: extra, added_at: new Date().toISOString() }];
      const evidence = [...(r.evidence || []), ...extra];
      await svc.entities.HistoricalAchievementRequest.update(r.id, {
        status: 'pending_review', student_updates: updates, evidence,
        event_log: pushHEvent(r.event_log, 'student_info_added', actor.actor_email, message.slice(0, 200)),
      });
      if (!r.demo) {
        await Promise.allSettled(superAdminRecipients().map((to: string) => sendTemplateEmail(svc, {
          to, template_name: 'HistoricalAdminAlert', event_type: 'historical_admin_alert', related_id: r.id,
          subject: 'Student added information on a verification request',
          variables: {
            request_ref: r.request_ref, student_name: r.student_name, achievement_title: r.title,
            issuing_org: r.issuing_org, verifier_name: r.verifier_name, verifier_role: r.verifier_role,
            dashboard_url: `${appUrl()}/internal/admin`,
          },
        })));
      }
      return Response.json({ ok: true, status: 'pending_review' });
    }

    if (action === 'repropose_verifier') {
      if (['issued', 'rejected', 'withdrawn'].includes(r.status)) return bad('This verification is closed');
      const proposals = (r.verifier_proposals || 1) + 1;
      if (proposals > MAX_VERIFIER_PROPOSALS) return bad(`A verifier can only be re-nominated ${MAX_VERIFIER_PROPOSALS} times on one request`);
      const v = {
        name: clean(body.verifier_name, 140), email: lower(body.verifier_email),
        role: clean(body.verifier_role, 120), org: clean(body.verifier_org, 140),
        linkedin: clean(body.verifier_linkedin, 300), relationship: clean(body.verifier_relationship, 120),
        authority: clean(body.verifier_authority_claim, 1000),
      };
      if (!v.name || !EMAIL_RE.test(v.email) || !v.role || !v.org || !v.authority) {
        return bad('Complete all verifier details');
      }
      if (v.linkedin && !validateLinkedIn(v.linkedin)) return bad('The verifier LinkedIn URL is not valid');
      if (v.email === lower(r.student_email)) return bad('The verifier cannot be you');
      await svc.entities.HistoricalAchievementRequest.update(r.id, {
        status: 'pending_review',
        verifier_name: v.name, verifier_email: v.email, verifier_role: v.role, verifier_org: v.org,
        verifier_linkedin: v.linkedin, verifier_relationship: v.relationship, verifier_authority_claim: v.authority,
        verifier_proposals: proposals, verifier_token: null, verifier_token_expires_at: null, verifier_token_used_at: null,
        authority_review: null, review_rejected_reason: null,
        event_log: pushHEvent(r.event_log, 'verifier_reproposed', actor.actor_email, `New verifier proposed: ${v.name} (${v.email})`),
      });
      if (!r.demo) {
        await Promise.allSettled(superAdminRecipients().map((to: string) => sendTemplateEmail(svc, {
          to, template_name: 'HistoricalAdminAlert', event_type: 'historical_admin_alert', related_id: r.id,
          subject: 'Verifier re-nominated on a verification request',
          variables: {
            request_ref: r.request_ref, student_name: r.student_name, achievement_title: r.title,
            issuing_org: r.issuing_org, verifier_name: v.name, verifier_role: v.role,
            dashboard_url: `${appUrl()}/internal/admin`,
          },
        })));
      }
      return Response.json({ ok: true, status: 'pending_review' });
    }

    if (action === 'withdraw') {
      if (!OPEN_STATUSES.includes(r.status)) return bad('This verification can no longer be withdrawn');
      await svc.entities.HistoricalAchievementRequest.update(r.id, {
        status: 'withdrawn', verifier_token: null, verifier_token_expires_at: null,
        event_log: pushHEvent(r.event_log, 'withdrawn', actor.actor_email, 'Student withdrew the request'),
      });
      return Response.json({ ok: true, status: 'withdrawn' });
    }

    return bad(`Unknown action "${action}"`);
  } catch (error) {
    return Response.json({ ok: false, error: error?.message || 'Unexpected error' }, { status: 500 });
  }
}