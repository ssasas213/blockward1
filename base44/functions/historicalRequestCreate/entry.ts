// ============================================================================
// historicalRequestCreate — Step 1 of the historical pipeline. A student
// submits a past achievement with private evidence and a PROPOSED verifier.
// The verifier has no authority until a Blockward Super Admin authorises them.
// Demo records (TEST MODE) are isolated: no external emails, no credentials.
// ============================================================================
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { resolveEffectiveActor, isTestModeEnabled, getTestSuperUserEmail } from '../../shared/testMode.ts';
import {
  HISTORICAL_CATEGORIES, OPEN_STATUSES, MAX_OPEN_PER_STUDENT,
  genRequestRef, pushHEvent, notifyStudentEvent, sendTemplateEmail,
  superAdminRecipients, validateLinkedIn, validateHttpUrl, lower, appUrl,
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
    const form = body.form || {};
    const svc = base44.asServiceRole;

    const actor = await resolveEffectiveActor(base44);
    if (!actor.authorized) return bad(actor.reason || 'Authentication required', actor.status || 401);
    const studentEmail = lower(actor.actor_email);

    // Demo isolation — demo requests exist only while TEST_MODE is enabled,
    // for the test super user or an active test persona. Production data is
    // never touched and no external email is ever sent for a demo record.
    const isTestSuper = isTestModeEnabled() && lower(actor.controller_email) === lower(getTestSuperUserEmail());
    const demo = body.demo === true && isTestModeEnabled() && (actor.is_test_mode === true || isTestSuper);

    // ── Validation ──
    const title = clean(form.title, 140);
    if (!title || title.length < 3) return bad('Achievement title is required');
    const category = HISTORICAL_CATEGORIES.includes(form.category) ? form.category : 'other';
    const originalDate = clean(form.original_date, 10);
    if (!originalDate || !/^\d{4}-\d{2}-\d{2}$/.test(originalDate)) return bad('Original achievement date is required');
    if (originalDate > new Date().toISOString().slice(0, 10)) return bad('The original achievement date cannot be in the future');
    const issuingOrg = clean(form.issuing_org, 140);
    if (!issuingOrg || issuingOrg.length < 2) return bad('Issuing organisation is required');

    const evidence = [];
    for (const e of (Array.isArray(form.evidence) ? form.evidence : []).slice(0, 8)) {
      if (!e || !e.url) continue;
      const isLink = e.kind === 'link' || /^https?:\/\//i.test(e.url);
      if (isLink && !validateHttpUrl(e.url)) return bad('Evidence links must be https URLs');
      evidence.push({ name: clean(e.name, 160) || 'Evidence', url: String(e.url).slice(0, 1000), kind: isLink ? 'link' : 'file' });
    }
    if (evidence.length === 0) return bad('Add at least one piece of evidence (a file or an official verification link)');

    const profileFullName = clean(form.profile?.full_name, 140) || `${actor.first_name || ''} ${actor.last_name || ''}`.trim() || 'Blockward member';
    const linkedinUrl = clean(form.profile?.linkedin_url, 300);
    if (linkedinUrl && !validateLinkedIn(linkedinUrl)) return bad('LinkedIn URL must look like https://www.linkedin.com/in/your-name');
    const personalWebsite = clean(form.profile?.personal_website, 300);
    if (personalWebsite && !validateHttpUrl(personalWebsite)) return bad('Personal website must be an https URL');

    const verifier = {
      name: clean(form.verifier?.name, 140),
      email: lower(form.verifier?.email),
      role: clean(form.verifier?.role, 120),
      org: clean(form.verifier?.org, 140),
      linkedin_url: clean(form.verifier?.linkedin_url, 300),
      relationship: clean(form.verifier?.relationship, 120),
      authority_claim: clean(form.verifier?.authority_claim, 1000),
    };
    if (!verifier.name || !EMAIL_RE.test(verifier.email) || !verifier.role || !verifier.org || !verifier.authority_claim) {
      return bad('Complete all proposed verifier details (name, email, role, organisation and why they are authorised)');
    }
    if (verifier.linkedin_url && !validateLinkedIn(verifier.linkedin_url)) return bad('The verifier LinkedIn URL is not valid');
    if (verifier.email === studentEmail) return bad('The verifier cannot be you. Nominate the person who originally awarded the achievement.');

    // ── Rate limiting + duplicate detection (real requests only) ──
    const mine = await svc.entities.HistoricalAchievementRequest.filter({ student_email: studentEmail }).catch(() => []);
    if (!demo) {
      const open = (mine || []).filter((r: any) => OPEN_STATUSES.includes(r.status));
      if (open.length >= MAX_OPEN_PER_STUDENT) {
        return bad(`You already have ${MAX_OPEN_PER_STUDENT} verifications in progress. Wait for one to complete before submitting another.`);
      }
      const dupe = (mine || []).find((r: any) =>
        !['withdrawn', 'rejected'].includes(r.status) &&
        lower(r.title) === lower(title) && lower(r.issuing_org) === lower(issuingOrg) && r.original_date === originalDate);
      if (dupe) return bad(`You have already submitted "${title}" from ${issuingOrg} for verification`);
    }

    // ── Create (service-role only by design) ──
    const requestRef = await genRequestRef(svc);
    const rec = await svc.entities.HistoricalAchievementRequest.create({
      request_ref: requestRef,
      student_email: studentEmail,
      student_id: actor.actor_id,
      student_name: profileFullName,
      title, category,
      description: clean(form.description, 2000),
      original_date: originalDate,
      issuing_org: issuingOrg,
      country: clean(form.country, 80),
      certificate_ref: clean(form.certificate_ref, 120),
      evidence,
      profile_full_name: profileFullName,
      linkedin_url: linkedinUrl,
      personal_website: personalWebsite,
      verifier_name: verifier.name, verifier_email: verifier.email, verifier_role: verifier.role,
      verifier_org: verifier.org, verifier_linkedin: verifier.linkedin_url,
      verifier_relationship: verifier.relationship, verifier_authority_claim: verifier.authority_claim,
      verifier_proposals: 1,
      status: 'pending_review',
      demo,
      event_log: pushHEvent([], 'created', studentEmail, demo ? 'Submitted (DEMO — no external emails)' : 'Submitted for Super Admin authority review'),
    });

    // ── Super Admin notifications (real mode only, never for demo records) ──
    if (!demo) {
      const recipients = superAdminRecipients();
      await Promise.allSettled(recipients.map((to: string) => sendTemplateEmail(svc, {
        to, template_name: 'HistoricalAdminAlert', event_type: 'historical_admin_alert', related_id: rec.id,
        variables: {
          request_ref: requestRef, student_name: profileFullName, achievement_title: title,
          issuing_org: issuingOrg, verifier_name: verifier.name, verifier_role: verifier.role,
          dashboard_url: `${appUrl()}/internal/admin`,
        },
      })));
    }
    await notifyStudentEvent(svc, studentEmail, 'Past achievement submitted',
      `"${title}" is saved in your Vault as Pending Verification. Blockward will review the proposed verifier next — your achievement stays unverified until the full process completes.`,
      'verification_sent', rec.id);

    return Response.json({ ok: true, request_id: rec.id, request_ref: requestRef, demo });
  } catch (error) {
    return Response.json({ ok: false, error: error?.message || 'Unexpected error' }, { status: 500 });
  }
}