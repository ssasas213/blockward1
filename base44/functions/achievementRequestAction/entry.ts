// achievementRequestAction — the full lifecycle of a student achievement
// request: save draft, submit (with anti-abuse caps), resubmit, verifier
// sign-off, admin second approval, Tier 3 external verification via a
// one-time expiring link, request changes, reject (with rejection-rate
// flagging), bulk Tier 1 sign-off, and minting to the canonical credential
// pipeline on final approval.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { resolveEffectiveActor } from '../../shared/testMode.ts';
import {
  OPEN_STATUSES, VERIFICATION_METHODS,
  OPEN_REQUEST_LIMIT, WEEKLY_PER_ORG_LIMIT, DAY_MS,
  logEvent, appendEvent, rejectionStatsFor, requestEmailHtml, notifyRequest, appUrl,
} from '../../shared/achievementRequests.ts';
import { mintRequestCredential } from '../../shared/credentialDelivery.ts';
import {
  INDEPENDENT_ROLES, INDEPENDENT_MONTHLY_CAP, INDEPENDENT_TOKEN_DAYS,
  isDisposableEmail, selfVerificationError, independentVerifierFlags,
} from '../../shared/independentVerification.ts';
import { MAX_TEAM_PARTICIPANTS } from '../../shared/teamCredentials.ts';
import { notifyEvent } from '../../shared/eventNotifications.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'content-type': 'application/json',
};

const CATEGORIES = ['academic', 'sports', 'arts', 'leadership', 'community', 'behaviour', 'special'];

function ipCountry(req) {
  return req.headers.get('cf-ipcountry') || req.headers.get('x-vercel-ip-country') || req.headers.get('x-country-code') || null;
}

function requestIp(req) {
  const fwd = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for');
  return fwd ? fwd.split(',')[0].trim() : null;
}

function bad(error, status = 400) {
  return Response.json({ ok: false, error }, { status, headers: CORS });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    // ── Public, token-authenticated external verifier actions ──
    if (['external_get', 'external_confirm', 'external_decline', 'external_report_false'].includes(action)) {
      return await handleExternal(svc, body, req);
    }

    const actor = await resolveEffectiveActor(base44);
    if (!actor.authorized) {
      return Response.json({ ok: false, error: actor.reason || 'Unauthorized' }, { status: actor.status || 401, headers: CORS });
    }
    const email = actor.actor_email;
    const role = actor.actor_role;
    const country = ipCountry(req);

    // ═════════════════════ STUDENT ACTIONS ═════════════════════

    if (action === 'save_draft' || action === 'submit' || action === 'resubmit') {
      if (role !== 'student') return bad('Only students can create achievement requests', 403);

      const form = await normalizeForm(svc, actor, body.form || {});
      if (form.errors) return bad(form.errors.join('. '));

      // Load existing request (edit) or start a new one.
      let request = null;
      if (body.request_id) {
        const rows = await svc.entities.AchievementRequest.filter({ id: body.request_id });
        request = rows?.[0] || null;
        if (!request) return bad('Request not found', 404);
        if (request.student_email !== email) return bad('This is not your request', 403);
        if (action === 'resubmit' && request.status !== 'changes_requested') return bad('This request is not awaiting your changes');
        if (action !== 'resubmit' && !['draft', 'changes_requested'].includes(request.status)) return bad('This request can no longer be edited');
      }

      const now = new Date().toISOString();
      const baseData = {
        verification_mode: form.data.verification_mode,
        independent_verifier: form.data.independent_verifier,
        school_id: form.data.school_id,
        school_name: form.data.school_name,
        student_id: actor.actor_id,
        student_email: email,
        student_name: `${actor.first_name || ''} ${actor.last_name || ''}`.trim() || email,
        credential_type_id: form.data.credential_type_id,
        credential_type_title: form.data.credential_type_title,
        is_custom_credential: form.data.is_custom_credential,
        category: form.data.category,
        title: form.data.title,
        description: form.data.description,
        image_url: form.data.image_url,
        date_achieved: form.data.date_achieved,
        evidence: form.data.evidence,
        nominated_verifier_id: form.data.nominated_verifier_id,
        nominated_verifier_email: form.data.nominated_verifier_email,
        nominated_verifier_name: form.data.nominated_verifier_name,
        verification_tier: form.data.verification_tier,
        external_verifier_email: form.data.external_verifier_email || null,
        is_team: form.data.is_team,
        my_team_role: form.data.my_team_role,
        team_participants: form.data.team_participants,
      };

      if (action !== 'save_draft') {
        // Submit-level validation.
        if (!form.data.date_achieved) return bad('Date achieved is required to submit');
        if (form.data.evidence.length === 0) return bad('Attach at least one piece of evidence to submit');

        // ── Anti-abuse caps ──
        const mine = await svc.entities.AchievementRequest.filter({ student_email: email }, '-created_date', 200);
        const excludingSelf = mine.filter((r) => r.id !== request?.id);
        const openCount = excludingSelf.filter((r) => OPEN_STATUSES.includes(r.status)).length;
        if (openCount >= OPEN_REQUEST_LIMIT) {
          return bad(`You already have ${OPEN_REQUEST_LIMIT} open requests. Wait for some to be resolved before submitting more.`);
        }
        const weekAgo = new Date(Date.now() - 7 * DAY_MS).toISOString();
        const weeklyCount = excludingSelf.filter(
          (r) => r.school_id === form.data.school_id && r.submitted_at && r.submitted_at >= weekAgo && r.status !== 'draft'
        ).length;
        if (weeklyCount >= WEEKLY_PER_ORG_LIMIT) {
          return bad(`You can submit up to ${WEEKLY_PER_ORG_LIMIT} requests per organisation each week. Try again later.`);
        }

        // ── Independent-verification anti-abuse: hard rejection only for
        // self-verification (including aliases), disposable domains and the
        // rolling monthly cap. Everything softer is a flag at confirm time.
        if (form.data.verification_mode === 'independent') {
          const profRows = await svc.entities.UserProfile.filter({ user_email: email });
          const p = profRows?.[0] || {};
          const selfErr = selfVerificationError(
            form.data.independent_verifier.email, email,
            [p.parent_email, p.admin_email, p.primary_teacher_email],
          );
          if (selfErr) return bad(selfErr);
          if (isDisposableEmail(form.data.independent_verifier.email)) {
            return bad('Disposable email addresses cannot verify achievements. Use a real contact address.');
          }
          const monthAgo = new Date(Date.now() - 30 * DAY_MS).toISOString();
          const monthCount = excludingSelf.filter((r) => r.verification_mode === 'independent' && r.submitted_at && r.submitted_at >= monthAgo).length;
          if (monthCount >= INDEPENDENT_MONTHLY_CAP) {
            return bad(`You can request up to ${INDEPENDENT_MONTHLY_CAP} independent verifications every 30 days. Try again later.`);
          }
        }
      }

      const events = [];
      if (!request) {
        events.push(logEvent('created', email, baseData.student_name, 'student', null));
      } else {
        events.push(logEvent('updated', email, baseData.student_name, 'student', null));
      }

      let status, extra = {};
      if (action === 'save_draft') {
        status = request?.status === 'changes_requested' ? 'changes_requested' : 'draft';
      } else if (action === 'resubmit') {
        status = 'under_review';
        extra = { resubmitted_at: now };
        events.push(logEvent('resubmitted', email, baseData.student_name, 'student', null));
      } else if (form.data.verification_mode === 'independent') {
        // Straight to the verifier's inbox — no staff queue without an org.
        status = 'awaiting_external_verification';
        extra = { submitted_at: now, last_reviewer_action_at: now };
        events.push(logEvent('submitted', email, baseData.student_name, 'student', null));
      } else {
        status = 'submitted';
        extra = { submitted_at: now };
        events.push(logEvent('submitted', email, baseData.student_name, 'student', null));
      }

      let saved;
      if (request) {
        const mergedLog = appendEvent(request.event_log, events);
        saved = await svc.entities.AchievementRequest.update(request.id, { ...baseData, status, ...extra, event_log: mergedLog });
      } else {
        saved = await svc.entities.AchievementRequest.create({ ...baseData, status, ...extra, event_log: events });
      }

      // Independent verification — email the verifier a one-time 14-day link.
      if (status === 'awaiting_external_verification' && form.data.verification_mode === 'independent') {
        const iv = form.data.independent_verifier;
        const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').substring(0, 8);
        const expires = new Date(Date.now() + INDEPENDENT_TOKEN_DAYS * DAY_MS).toISOString();
        await svc.entities.AchievementRequest.update(saved.id, {
          external_token: token,
          external_token_expires_at: expires,
          submit_ip: requestIp(req),
        });
        const roleLabel = (iv.role || '').replace(/_/g, ' ');
        const html = requestEmailHtml(
          `Can you verify an achievement for ${baseData.student_name}?`,
          [
            `<strong>${baseData.student_name}</strong> has asked you to verify: <strong>${baseData.title}</strong>`,
            iv.relationship ? `They wrote: <em>"${iv.relationship}"</em>` : null,
            `You were named as their ${roleLabel}${iv.organisation_label ? ` at ${iv.organisation_label}` : ''}. If you were in a position to confirm this, follow the link — no account needed.`,
            `The link is one-time and expires on ${new Date(expires).toUTCString()}.`,
          ].filter(Boolean),
          `${appUrl()}/external-verify/${token}`,
          'Review this achievement'
        );
        await notifyRequest(iv.email, `Can you verify an achievement for ${baseData.student_name}?`, html);
      }

      // Email the nominated verifier when a request lands in their queue.
      if (status === 'submitted' || status === 'under_review') {
        const html = requestEmailHtml(
          `New achievement request from ${baseData.student_name}`,
          [
            `<strong>${baseData.student_name}</strong> has requested a verified credential:`,
            `<em>${baseData.title}</em> — ${form.data.credential_type_title}`,
            `You were nominated as the verifier. Please review the evidence and sign off, request changes, or reject.`,
          ],
          `${appUrl()}/PendingSignoffs`,
          'Review request'
        );
        await notifyRequest(baseData.nominated_verifier_email, `New achievement request from ${baseData.student_name}`, html);
      }

      return Response.json({ ok: true, request: saved, status }, { headers: CORS });
    }

    // ═════════════════════ STUDENT WITHDRAW ═════════════════════
    // The student's way out of a mistake: wrong verifier, wrong details,
    // wrong org. Once a request is approved it exists publicly — a verified
    // credential can never be silently unmade, so withdrawal is refused.
    if (action === 'withdraw') {
      if (role !== 'student') return bad('Only students can withdraw their requests', 403);
      let request = null;
      try {
        const rows = await svc.entities.AchievementRequest.filter({ id: body.request_id || 'none' });
        request = rows?.[0] || null;
      } catch { /* invalid id — treated as not found */ }
      if (!request) return bad('Request not found', 404);
      if (request.student_email !== email) return bad('This is not your request', 403);
      const WITHDRAWABLE = ['draft', 'submitted', 'under_review', 'changes_requested', 'awaiting_external_verification'];
      // Recovery hatch: a request that was verified but never published
      // (mint failed) has no public credential to unmake — the student may
      // withdraw it, or republish via retry_mint. Once a BlockWard exists
      // (blockward_id / verification_id) the credential is public and can
      // never be silently withdrawn.
      const published = !!request.blockward_id || !!request.verification_id;
      if (!WITHDRAWABLE.includes(request.status) && !(request.status === 'approved' && !published)) {
        return bad('This credential has already been verified and published — it cannot be withdrawn');
      }
      const now = new Date().toISOString();
      await svc.entities.AchievementRequest.update(request.id, {
        status: 'withdrawn',
        // Kill the outstanding verifier link so it stops working immediately.
        external_token: null,
        external_token_expires_at: null,
        last_reviewer_action_at: now,
        event_log: appendEvent(request.event_log, logEvent('withdrawn', email, `${actor.first_name || ''} ${actor.last_name || ''}`.trim() || null, 'student', null)),
      });
      // Courtesy note to whoever was asked to verify — no response needed.
      const notifyTo = request.verification_mode === 'independent'
        ? request.external_verifier_email
        : request.nominated_verifier_email;
      if (notifyTo && request.status !== 'draft') {
        const html = requestEmailHtml(
          'No action needed — a verification request was withdrawn',
          [
            `<strong>${request.student_name || 'A student'}</strong> withdrew their request for <strong>${request.title}</strong> before you reviewed it.`,
            `No response is needed — this is just a courtesy note.`,
          ],
          appUrl(),
          'Go to BlockWard'
        );
        await notifyRequest(notifyTo, `Request withdrawn: "${request.title}"`, html);
      }
      return Response.json({ ok: true, status: 'withdrawn' }, { headers: CORS });
    }

    // ═════════════════════ STUDENT REPUBLISH ═════════════════════
    // Recovery for verified-but-unpublished requests (a mint failure). The
    // student re-runs the mint; on repeated failure they're pointed at
    // withdraw-and-resubmit. Only the requesting student, only before the
    // credential exists publicly.
    if (action === 'retry_mint') {
      if (role !== 'student') return bad('Only students can republish their requests', 403);
      let request = null;
      try {
        const rows = await svc.entities.AchievementRequest.filter({ id: body.request_id || 'none' });
        request = rows?.[0] || null;
      } catch { /* invalid id — treated as not found */ }
      if (!request) return bad('Request not found', 404);
      if (request.student_email !== email) return bad('This is not your request', 403);
      if (request.status !== 'approved' || request.blockward_id || request.verification_id) {
        return bad('Only requests that were verified but never published can be republished');
      }
      let mint: any = null;
      try {
        mint = await mintRequestCredential(svc, request);
      } catch (e: any) {
        console.error(`[retry_mint] request ${request.id} threw`, e?.message || e);
        mint = { ok: false, error: 'publishing failed' };
      }
      if (!mint.ok) {
        console.error(`[retry_mint] request ${request.id} failed`, mint.error);
        await svc.entities.AchievementRequest.update(request.id, {
          event_log: appendEvent(request.event_log, logEvent('mint_failed', email, `${actor.first_name || ''} ${actor.last_name || ''}`.trim() || null, 'student', mint.error)),
        });
        return bad('Publishing still fails for this request — you can withdraw it and resubmit');
      }
      return Response.json({ ok: true, status: 'archived', verification_id: mint.verificationId }, { headers: CORS });
    }

    // ═════════════════════ REVIEWER ACTIONS ═════════════════════

    const rows = await svc.entities.AchievementRequest.filter({ id: body.request_id || 'none' });
    const request = rows?.[0] || null;
    if (!request) return bad('Request not found', 404);

    const isNominatedVerifier = email === request.nominated_verifier_email;
    const isAdmin = role === 'admin' && actor.school_id === request.school_id;
    const reviewerCanAct = isNominatedVerifier || isAdmin;
    const actorName = `${actor.first_name || ''} ${actor.last_name || ''}`.trim() || email;
    const now = new Date().toISOString();

    if (action === 'sign' || action === 'bulk_sign') {
      // Nominated verifier sign-off.
      if (!isNominatedVerifier) return bad('Only the nominated verifier can sign off this request', 403);

      const ids = action === 'bulk_sign' ? (body.request_ids || []) : [request.id];
      if (action === 'bulk_sign' && ids.length === 0) return bad('Select at least one request to sign');

      const signCheck = validateSignoff(body);
      if (signCheck.error) return bad(signCheck.error);

      const signed = [];
      const failed = [];
      for (const id of ids) {
        const r = id === request.id ? request : (await svc.entities.AchievementRequest.filter({ id }))[0];
        if (!r) { failed.push({ id, error: 'not found' }); continue; }
        if (r.nominated_verifier_email !== email) { failed.push({ id, error: 'not nominated' }); continue; }
        if (action === 'bulk_sign' && r.verification_tier !== 1) { failed.push({ id, error: 'bulk sign-off is Tier 1 only' }); continue; }
        if (!['submitted', 'under_review'].includes(r.status)) { failed.push({ id, error: 'not actionable' }); continue; }
        try {
          await signAndAdvance(svc, r, 'verifier', body, email, actorName, country, now);
          signed.push(id);
        } catch (e) {
          failed.push({ id, error: e?.message || String(e) });
        }
      }
      return Response.json({ ok: failed.length === 0, signed, failed }, { headers: CORS });
    }

    if (action === 'admin_approve') {
      if (!isAdmin) return bad('Only organisation admins can give second approval', 403);
      if (request.status !== 'awaiting_second_approval') return bad('This request is not awaiting second approval');
      if (!request.verifier_signoff) return bad('The nominated verifier has not signed yet');
      if (email === request.nominated_verifier_email) {
        return bad('The admin approver must be a different person from the nominated verifier');
      }
      const signCheck = validateSignoff(body);
      if (signCheck.error) return bad(signCheck.error);

      await svc.entities.AchievementRequest.update(request.id, {
        admin_signoff: buildSignoff(body, actor, email, actorName, 'admin', country, now),
        status: request.verification_tier === 3 ? 'awaiting_external_verification' : 'approved',
        approved_at: request.verification_tier === 3 ? null : now,
        last_reviewer_action_at: now,
        event_log: appendEvent(request.event_log, logEvent('admin_approved', email, actorName, 'admin', null)),
      });

      if (request.verification_tier === 3) {
        // One-time expiring link to the external verifier.
        const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').substring(0, 8);
        const expires = new Date(Date.now() + 7 * DAY_MS).toISOString();
        await svc.entities.AchievementRequest.update(request.id, {
          external_token: token,
          external_token_expires_at: expires,
        });
        const html = requestEmailHtml(
          `External verification request from ${request.school_name || 'an organisation'}`,
          [
            `${request.student_name || 'A student'} has been awarded <strong>${request.title}</strong>.`,
            `As an independent verifier, please confirm this achievement is accurate.`,
            `This link is one-time use and expires on ${new Date(expires).toUTCString()}.`,
          ],
          `${appUrl()}/external-verify/${token}`,
          'Verify this achievement'
        );
        await notifyRequest(request.external_verifier_email, `Verify an achievement for ${request.school_name || 'an organisation'}`, html);
        return Response.json({ ok: true, status: 'awaiting_external_verification' }, { headers: CORS });
      }

      const fresh = (await svc.entities.AchievementRequest.filter({ id: request.id }))[0];
      const mint = await mintRequestCredential(svc, fresh);
      if (!mint.ok) {
        await svc.entities.AchievementRequest.update(request.id, {
          event_log: appendEvent(fresh.event_log, logEvent('mint_failed', email, actorName, 'admin', mint.error)),
        });
        return Response.json({ ok: false, error: 'Signed off, but publishing failed: ' + mint.error }, { status: 500, headers: CORS });
      }
      await notifyEvent(svc, {
        to_email: request.student_email,
        school_id: request.school_id,
        event_type: 'request_signed_off',
        title: `"${request.title}" was approved`,
        body: `Your achievement was approved by ${actorName} — it's now live on your profile.`,
        related_id: request.id,
        email_subject: `Verified: "${request.title}"`,
        email_html: requestEmailHtml('Your achievement has been verified and published', [
          `<strong>${request.title}</strong> was approved by ${actorName} and is now live on your profile.`,
        ], `${appUrl()}/StudentBlockWards`, 'View my credentials'),
      });
      return Response.json({ ok: true, status: 'archived', verification_id: mint.verificationId }, { headers: CORS });
    }

    if (action === 'request_changes') {
      if (!reviewerCanAct) return bad('Only the nominated verifier or an organisation admin can review this request', 403);
      if (!['submitted', 'under_review', 'verifier_signed', 'awaiting_second_approval'].includes(request.status)) {
        return bad('This request cannot be sent back for changes right now');
      }
      const comment = (body.comment || '').trim();
      if (!comment) return bad('A comment is required when requesting changes');
      await svc.entities.AchievementRequest.update(request.id, {
        status: 'changes_requested',
        changes_requested_reason: comment,
        last_reviewer_action_at: now,
        event_log: appendEvent(request.event_log, logEvent('changes_requested', email, actorName, role, comment)),
      });
      const html = requestEmailHtml(
        'Changes requested on your achievement',
        [
          `${actorName} reviewed your request for <strong>${request.title}</strong> and asked for some changes:`,
          `<blockquote style="border-left:3px solid #7c3aed;padding-left:12px;color:#64748b;">${comment}</blockquote>`,
          `Edit your request and resubmit it for review.`,
        ],
        `${appUrl()}/AchievementRequests`,
        'Edit my request'
      );
      await notifyRequest(request.student_email, `Changes requested on "${request.title}"`, html);
      // In-app notification (per-type preferences apply); the email above already covers this event.
      await notifyEvent(svc, {
        to_email: request.student_email,
        school_id: request.school_id,
        event_type: 'request_changes',
        title: `Changes requested on "${request.title}"`,
        body: comment,
        related_id: request.id,
      });
      return Response.json({ ok: true, status: 'changes_requested' }, { headers: CORS });
    }

    if (action === 'reject') {
      if (!reviewerCanAct) return bad('Only the nominated verifier or an organisation admin can review this request', 403);
      if (['draft', 'approved', 'minted', 'archived', 'rejected', 'expired'].includes(request.status)) {
        return bad('This request can no longer be rejected');
      }
      const reason = (body.reason || '').trim();
      if (!reason) return bad('A reason is required when rejecting a request');
      await svc.entities.AchievementRequest.update(request.id, {
        status: 'rejected',
        rejection_reason: reason,
        last_reviewer_action_at: now,
        event_log: appendEvent(request.event_log, logEvent('rejected', email, actorName, role, reason)),
      });
      const html = requestEmailHtml(
        'Your achievement request was not approved',
        [
          `${actorName} did not approve your request for <strong>${request.title}</strong>:`,
          `<blockquote style="border-left:3px solid #dc2626;padding-left:12px;color:#64748b;">${reason}</blockquote>`,
          `Rejections are private — they never appear on your public profile.`,
        ],
        `${appUrl()}/AchievementRequests`,
        'View my requests'
      );
      await notifyRequest(request.student_email, `Your request for "${request.title}" was not approved`, html);

      // ── Rejection-rate abuse signal → organisation admins ──
      const stats = await rejectionStatsFor(svc, request.student_email, request.school_id);
      if (stats.flagged && request.student_flagged !== true) {
        await svc.entities.AchievementRequest.update(request.id, { student_flagged: true });
        const admins = await svc.entities.UserProfile.filter({ school_id: request.school_id, user_type: 'admin' });
        const html2 = requestEmailHtml(
          'High rejection rate flagged',
          [
            `<strong>${request.student_name || request.student_email}</strong> has had ${stats.rejected} of ${stats.total} achievement requests rejected (over 40%).`,
            `You may want to review their recent requests.`,
          ],
          `${appUrl()}/PendingSignoffs`,
          'Review queue'
        );
        for (const a of admins) {
          if (a.user_email) await notifyRequest(a.user_email, `High rejection rate: ${request.student_name || request.student_email}`, html2);
        }
      }
      return Response.json({ ok: true, status: 'rejected' }, { headers: CORS });
    }

    if (action === 'mint') {
      if (!isAdmin) return bad('Only organisation admins can retry publishing', 403);
      if (request.status !== 'approved') return bad('Only approved requests can be published');
      const mint = await mintRequestCredential(svc, request);
      if (!mint.ok) return Response.json({ ok: false, error: mint.error }, { status: 500, headers: CORS });
      return Response.json({ ok: true, status: 'archived', verification_id: mint.verificationId }, { headers: CORS });
    }

    return bad('Unknown action');
  } catch (e) {
    return Response.json({ ok: false, error: e?.message || String(e) }, { status: 500, headers: CORS });
  }
});

// ── Helpers ──

function validateSignoff(body) {
  if (!VERIFICATION_METHODS.includes(body.method)) return { error: 'Select a verification method' };
  if (body.method === 'other' && !(body.method_note || '').trim()) return { error: 'Describe your verification method' };
  if (body.attestation !== true) return { error: 'You must confirm the attestation to sign' };
  if (!(body.signature || '').trim()) return { error: 'Type your full name as your signature' };
  return { ok: true };
}

function buildSignoff(body, actor, email, actorName, role, country, now) {
  const signoff = {
    method: body.method,
    method_note: (body.method_note || '').trim() || null,
    attestation: true,
    signature: body.signature.trim(),
    ip_country: country,
    signed_at: now,
  };
  if (role === 'admin') {
    return { ...signoff, signer_id: actor.actor_id, signer_email: email, signer_name: actorName, signer_role: 'admin' };
  }
  return { ...signoff, signer_id: actor.actor_id, signer_email: email, signer_name: actorName, signer_role: 'nominated_verifier' };
}

// Tier 1 verifier sign-off → approved → mint.
async function signAndAdvance(svc, request, kind, body, email, actorName, country, now) {
  const signoff = buildSignoff(body, { actor_id: request.nominated_verifier_id }, email, actorName, 'verifier', country, now);
  await svc.entities.AchievementRequest.update(request.id, {
    verifier_signoff: signoff,
    status: request.verification_tier === 1 ? 'approved' : 'awaiting_second_approval',
    approved_at: request.verification_tier === 1 ? now : null,
    last_reviewer_action_at: now,
    event_log: appendEvent(request.event_log, logEvent('verifier_signed', email, actorName, 'teacher', body.method)),
  });
  if (request.verification_tier === 1) {
    const fresh = (await svc.entities.AchievementRequest.filter({ id: request.id }))[0];
    const mint = await mintRequestCredential(svc, fresh);
    if (!mint.ok) {
      await svc.entities.AchievementRequest.update(request.id, {
        event_log: appendEvent(fresh.event_log, logEvent('mint_failed', email, actorName, 'teacher', mint.error)),
      });
      throw new Error(mint.error);
    }
    // Per-type "signed off" notification to the student (in-app + email, per preferences).
    await notifyEvent(svc, {
      to_email: request.student_email,
      school_id: request.school_id,
      event_type: 'request_signed_off',
      title: `"${request.title}" was signed off`,
      body: `${actorName} verified your achievement — it's now live on your profile.`,
      related_id: request.id,
      email_subject: `Verified: "${request.title}"`,
      email_html: requestEmailHtml('Your achievement has been verified and published', [
        `<strong>${request.title}</strong> was verified by ${actorName} and is now live on your profile.`,
      ], `${appUrl()}/StudentBlockWards`, 'View my credentials'),
    });
    return mint;
  }
  return { ok: true };
}

// Validates & normalises an independent-verification form. No organisation,
// no staff list, no template — just the student, the claim, the evidence and
// the person who was there.
async function normalizeIndependentForm(svc, actor, form) {
  const errors = [];
  const title = (form.title || '').trim();
  if (!title) errors.push('A title is required');

  let category = form.category || null;
  if (!category) errors.push('Pick a category');
  else if (!CATEGORIES.includes(category)) errors.push('Invalid category');

  const iv = form.independent_verifier || {};
  const ivName = (iv.name || '').trim();
  const ivEmail = (iv.email || '').trim().toLowerCase();
  const ivRole = (iv.role || '').trim();
  const ivOrg = (iv.organisation_label || '').trim();
  const ivRelationship = (iv.relationship || '').trim();
  if (!ivName) errors.push("Add the verifier's full name");
  if (!ivEmail || !ivEmail.includes('@')) errors.push("Add the verifier's email");
  if (!ivRole || !INDEPENDENT_ROLES.includes(ivRole)) errors.push("Pick the verifier's role");

  const evidence = (form.evidence || [])
    .filter((e) => e && e.url && ['file', 'link'].includes(e.type))
    .map((e) => ({ type: e.type, url: e.url, name: (e.name || '').trim() || e.url }));

  if (errors.length) return { errors };

  return {
    data: {
      verification_mode: 'independent',
      // No organisation. The free-text label is DISPLAY ONLY — it never
      // creates or links a BlockWard organisation.
      school_id: null,
      school_name: ivOrg || null,
      independent_verifier: {
        name: ivName,
        email: ivEmail,
        role: ivRole,
        organisation_label: ivOrg || null,
        relationship: ivRelationship || null,
      },
      credential_type_id: null,
      credential_type_title: null,
      is_custom_credential: false,
      category: category || 'special',
      title,
      description: (form.description || '').trim() || null,
      image_url: (typeof form.image_url === 'string' && form.image_url.trim().startsWith('http')) ? form.image_url.trim() : null,
      date_achieved: form.date_achieved || null,
      evidence,
      nominated_verifier_id: null,
      nominated_verifier_email: null,
      nominated_verifier_name: null,
      verification_tier: null,
      // Doubles as the maintenance-reminder recipient and the anti-abuse
      // history key for this verifier address.
      external_verifier_email: ivEmail,
      is_team: false,
      my_team_role: null,
      team_participants: [],
    },
  };
}

// Validates & normalises the student's form. Returns { errors } or { data }.
async function normalizeForm(svc, actor, form) {
  if (form.verification_mode === 'independent') {
    return await normalizeIndependentForm(svc, actor, form);
  }
  const errors = [];
  const schoolId = form.school_id;
  if (!schoolId) errors.push('Pick an organisation');
  else if (schoolId !== actor.school_id) errors.push('You can only request achievements at your own organisation');

  const title = (form.title || '').trim();
  if (!title) errors.push('A title is required');

  let credentialTypeId = null;
  let credentialTypeTitle = null;
  let isCustom = false;
  let category = form.category || null;
  let tier = Number(form.verification_tier) || null;

  if (form.credential_type_id) {
    const rows = await svc.entities.AwardTypes.filter({ id: form.credential_type_id });
    const t = rows?.[0];
    if (!t) errors.push('Credential type not found');
    else if (t.school_id !== schoolId) errors.push('That credential type does not belong to this organisation');
    else {
      credentialTypeId = t.id;
      credentialTypeTitle = t.title;
      category = t.category || category;
      tier = Number(t.verification_tier) || 1;
    }
  } else {
    const label = (form.custom_credential_label || '').trim();
    if (!label) errors.push('Pick a credential type');
    else {
      isCustom = true;
      credentialTypeTitle = label;
      if (!category) errors.push('Pick a category for a custom credential type');
      if (![1, 2, 3].includes(tier)) errors.push('Pick a verification tier for a custom credential type');
    }
  }
  if (category && !CATEGORIES.includes(category)) errors.push('Invalid category');

  let verifier = null;
  const vEmail = (form.nominated_verifier_email || '').trim().toLowerCase();
  if (!vEmail) errors.push('Nominate a verifier');
  else {
    const rows = await svc.entities.UserProfile.filter({ user_email: vEmail });
    verifier = rows?.find((p) => p.school_id === schoolId && ['teacher', 'admin'].includes(p.user_type)) || null;
    // An organisation the student invited (inbound lead) has no staff yet —
    // its invited admin email may be nominated, so the verification request
    // can be sent by email before they join. It waits in their queue.
    if (!verifier) {
      try {
        const schools = await svc.entities.School.filter({ id: schoolId });
        const org = schools?.[0];
        if (org && (org.admin_email || '').toLowerCase() === vEmail) {
          verifier = { id: null, user_email: org.admin_email, first_name: org.name, last_name: 'invited admin' };
        }
      } catch (e) { /* ignore */ }
    }
    if (!verifier) errors.push('The nominated verifier must be a teacher or admin of this organisation');
  }

  const externalEmail = (form.external_verifier_email || '').trim().toLowerCase() || null;
  if (tier === 3 && !externalEmail) errors.push('A Tier 3 credential needs an external verifier contact email');

  const evidence = (form.evidence || [])
    .filter((e) => e && e.url && ['file', 'link'].includes(e.type))
    .map((e) => ({ type: e.type, url: e.url, name: (e.name || '').trim() || e.url }));

  // ── Team achievement participants ──
  const creatorEmail = (actor.actor_email || '').toLowerCase();
  const isTeam = form.is_team === true;
  let teamParticipants: any[] = [];
  if (isTeam) {
    const seenEmails = new Set<string>();
    teamParticipants = (form.team_participants || [])
      .map((p) => ({
        email: String(p?.email || '').trim().toLowerCase(),
        name: String(p?.name || '').trim() || null,
        role: String(p?.role || '').trim().slice(0, 40) || 'Member',
      }))
      .filter((p) => p.email && p.email.includes('@') && p.email !== creatorEmail && !seenEmails.has(p.email) && seenEmails.add(p.email));
    if (teamParticipants.length === 0) errors.push('Add at least one teammate for a team achievement');
    if (teamParticipants.length > MAX_TEAM_PARTICIPANTS) errors.push(`A team achievement can list at most ${MAX_TEAM_PARTICIPANTS} teammates`);
  }

  let schoolName = null;
  if (schoolId) {
    const schools = await svc.entities.School.filter({ id: schoolId });
    schoolName = schools?.[0]?.name || null;
  }

  if (errors.length) return { errors };

  return {
    data: {
      verification_mode: 'organisation',
      school_id: schoolId,
      school_name: schoolName,
      credential_type_id: credentialTypeId,
      credential_type_title: credentialTypeTitle,
      is_custom_credential: isCustom,
      category: category || 'special',
      title,
      description: (form.description || '').trim() || null,
      image_url: (typeof form.image_url === 'string' && form.image_url.trim().startsWith('http')) ? form.image_url.trim() : null,
      date_achieved: form.date_achieved || null,
      evidence,
      nominated_verifier_id: verifier.id,
      nominated_verifier_email: verifier.user_email,
      nominated_verifier_name: `${verifier.first_name || ''} ${verifier.last_name || ''}`.trim() || verifier.user_email,
      verification_tier: tier || 1,
      external_verifier_email: externalEmail,
      is_team: isTeam,
      my_team_role: isTeam ? (String(form.my_team_role || '').trim().slice(0, 40) || 'Member') : null,
      team_participants: isTeam ? teamParticipants : [],
    },
  };
}

// ── External verifier: public, token-authenticated ──
async function handleExternal(svc, body, req) {
  const token = body.token;
  if (!token) {
    return Response.json({ ok: false, code: 'invalid', error: 'This link is invalid — check you opened the exact link from the email.' }, { headers: CORS });
  }
  const rows = await svc.entities.AchievementRequest.filter({ external_token: token });
  const request = rows?.[0] || null;
  // Distinct outcomes for distinct situations — a coach or examiner seeing
  // BlockWard for the first time must never get a generic "invalid link" for
  // a link that actually expired, was used, or the student withdrew.
  if (!request) {
    return Response.json({ ok: false, code: 'invalid', error: 'This link is invalid — check you opened the exact link from the email.' }, { headers: CORS });
  }
  if (request.status === 'withdrawn') {
    return Response.json({ ok: false, code: 'withdrawn', error: 'The student withdrew this request before you reviewed it. No action is needed.' }, { headers: CORS });
  }
  if (request.status !== 'awaiting_external_verification') {
    return Response.json({ ok: false, code: 'used', error: 'This verification has already been completed or is no longer awaiting your confirmation.' }, { headers: CORS });
  }
  if (request.external_token_expires_at && new Date(request.external_token_expires_at) < new Date()) {
    return Response.json({ ok: false, code: 'expired', error: 'This verification link has expired. Ask the student to send a fresh verification request.' }, { headers: CORS });
  }

  if (body.action === 'external_get') {
    return Response.json({
      ok: true,
      request: {
        student_name: request.student_name,
        school_name: request.school_name,
        title: request.title,
        credential_type_title: request.credential_type_title,
        category: request.category,
        description: request.description,
        date_achieved: request.date_achieved,
        evidence: request.evidence || [],
        nominated_verifier_name: request.nominated_verifier_name,
        expires_at: request.external_token_expires_at,
        verification_mode: request.verification_mode || 'organisation',
        relationship: request.independent_verifier?.relationship || null,
        verifier: request.verification_mode === 'independent' ? {
          name: request.independent_verifier?.name || null,
          role: request.independent_verifier?.role || null,
          organisation_label: request.independent_verifier?.organisation_label || null,
        } : null,
      },
    }, { headers: CORS });
  }

  // Verifier declines — the request goes back to the student to pick someone else.
  if (body.action === 'external_decline') {
    const nowIso = new Date().toISOString();
    const declinerName = (body.name || '').trim() || 'Your nominated verifier';
    await svc.entities.AchievementRequest.update(request.id, {
      status: 'changes_requested',
      changes_requested_reason: `${declinerName} declined to verify this achievement. Edit your request and choose a different verifier.`,
      external_token: null,
      external_token_expires_at: null,
      last_reviewer_action_at: nowIso,
      event_log: appendEvent(request.event_log, logEvent('external_declined', request.external_verifier_email || null, (body.name || '').trim() || null, 'external_verifier', (body.reason || '').trim() || null)),
    });
    const html = requestEmailHtml(
      'Your verifier declined this achievement',
      [
        `The person you nominated to verify <strong>${request.title}</strong> declined.`,
        `You can edit your request and nominate someone else.`,
      ],
      `${appUrl()}/AchievementRequests`,
      'Edit my request'
    );
    await notifyRequest(request.student_email, `Your verifier declined: "${request.title}"`, html);
    await notifyEvent(svc, {
      to_email: request.student_email,
      school_id: request.school_id,
      event_type: 'request_changes',
      title: `Your verifier declined "${request.title}"`,
      body: 'The person you nominated could not verify this. Edit your request and choose a different verifier.',
      related_id: request.id,
    });
    return Response.json({ ok: true, status: 'changes_requested' }, { headers: CORS });
  }

  // Verifier reports the claim as false — the request is withdrawn and the
  // report is audited for review.
  if (body.action === 'external_report_false') {
    const reason = (body.reason || '').trim();
    const reporter = (body.name || '').trim() || 'The nominated verifier';
    if (!reason) return bad('A reason is required to report a request as false');
    const nowIso = new Date().toISOString();
    await svc.entities.AchievementRequest.update(request.id, {
      status: 'rejected',
      rejection_reason: `${reporter} reported this claim as inaccurate: ${reason}`,
      false_report: { reason, name: reporter, at: nowIso },
      external_token: null,
      external_token_expires_at: null,
      last_reviewer_action_at: nowIso,
      event_log: appendEvent(request.event_log, logEvent('reported_false', request.external_verifier_email || null, reporter, 'external_verifier', reason)),
    });
    try {
      await svc.entities.AuditLog.create({
        record_id: request.id,
        school_id: request.school_id,
        actor_email: request.external_verifier_email || 'unknown',
        actor_name: reporter,
        actor_role: 'external_verifier',
        action: 'false_report',
        notes: `Verifier reported "${request.title}" as false: ${reason}`,
        timestamp: nowIso,
      });
    } catch { /* best-effort audit */ }
    const html = requestEmailHtml(
      'Your achievement request was withdrawn',
      [
        `The person you nominated to verify <strong>${request.title}</strong> reported the claim as inaccurate:`,
        `<blockquote style="border-left:3px solid #dc2626;padding-left:12px;color:#64748b;">${reason}</blockquote>`,
        `The request has been withdrawn. Rejections are private — nothing appears on your public profile.`,
      ],
      `${appUrl()}/AchievementRequests`,
      'View my requests'
    );
    await notifyRequest(request.student_email, `Your request for "${request.title}" was withdrawn`, html);
    return Response.json({ ok: true, status: 'rejected' }, { headers: CORS });
  }

  // external_confirm
  const name = (body.name || '').trim();
  const role_ = (body.role || '').trim();
  const organisation = (body.organisation || '').trim();
  const email = (body.email || '').trim();
  const signCheck = validateSignoff(body);
  const errs = [];
  if (!name) errs.push('Your name is required');
  if (!role_) errs.push('Your role is required');
  if (!organisation) errs.push('Your organisation is required');
  if (!email || !email.includes('@')) errs.push('A valid email is required');
  if (signCheck.error) errs.push(signCheck.error);
  if (errs.length) return bad(errs.join('. '));

  const isIndependent = request.verification_mode === 'independent';
  if (isIndependent) {
    // Re-check the confirmed email against the student's own identities —
    // access to the link's inbox proves nothing about who owns it.
    let accountEmails: any[] = [];
    try {
      const rows = await svc.entities.UserProfile.filter({ user_email: request.student_email });
      const p = rows?.[0];
      if (p) accountEmails = [p.parent_email, p.admin_email, p.primary_teacher_email];
    } catch { /* best-effort */ }
    const selfErr = selfVerificationError(email, request.student_email, accountEmails);
    if (selfErr) return bad(selfErr);
    if (isDisposableEmail(email)) return bad('Disposable email addresses cannot verify achievements');
  }

  const now = new Date().toISOString();
  const country = ipCountry(req);

  // Anti-abuse review flags — recorded, never auto-rejecting.
  let flags: any[] = [];
  if (isIndependent) {
    try {
      flags = await independentVerifierFlags(svc, request, email, requestIp(req));
    } catch { /* flags are best-effort */ }
  }
  await svc.entities.AchievementRequest.update(request.id, {
    external_signoff: {
      name, role: role_, organisation, email,
      method: body.method,
      method_note: (body.method_note || '').trim() || null,
      attestation: true,
      signature: body.signature.trim(),
      ip_country: country,
      signed_at: now,
    },
    status: 'approved',
    approved_at: now,
    last_reviewer_action_at: now,
    external_token: null,
    external_token_expires_at: null,
    ...(flags.length ? { review_flags: [...(request.review_flags || []), ...flags] } : {}),
    event_log: (() => {
      let log = appendEvent(request.event_log, logEvent('external_confirmed', email, name, 'external_verifier', body.method));
      for (const f of flags) {
        log = appendEvent(log, logEvent('flagged', 'system', 'BlockWard', 'system', `${f.reason}: ${f.detail}`));
      }
      return log;
    })(),
  });

  // Publishing must never surface a raw database error to the verifier.
  // The real error is logged server-side, the student is notified with a
  // recovery path, and the verifier sees one calm sentence.
  let fresh: any = null;
  let mint: any = null;
  try {
    fresh = (await svc.entities.AchievementRequest.filter({ id: request.id }))[0];
    mint = await mintRequestCredential(svc, fresh);
  } catch (e: any) {
    console.error(`[mint] request ${request.id} threw`, e?.message || e);
    mint = { ok: false, error: 'publishing failed' };
  }
  if (!mint.ok) {
    console.error(`[mint] request ${request.id} failed`, mint.error);
    const freshLog = fresh?.event_log || request.event_log || [];
    await svc.entities.AchievementRequest.update(request.id, {
      event_log: appendEvent(freshLog, logEvent('mint_failed', email, name, 'external_verifier', mint.error)),
    });
    const failHtml = requestEmailHtml(
      'Publishing your verified achievement hit a snag',
      [
        `<strong>${request.title}</strong> was verified, but publishing it to your profile failed on our side.`,
        `Open the request and press "Finish publishing" to retry. If it keeps failing, you can withdraw it and resubmit.`,
      ],
      `${appUrl()}/StudentBlockWards`,
      'Open my credentials'
    );
    await notifyRequest(request.student_email, `Publishing "${request.title}" failed — action needed`, failHtml);
    await notifyEvent(svc, {
      to_email: request.student_email,
      school_id: request.school_id,
      event_type: 'request_signed_off',
      title: `Publishing "${request.title}" failed`,
      body: 'Your verifier confirmed it, but publishing failed on our side. Open the request to retry or withdraw it.',
      related_id: request.id,
    });
    return Response.json({ ok: false, error: 'Something went wrong publishing this — the student has been notified. Your confirmation was recorded; nothing more is needed from you.' }, { status: 500, headers: CORS });
  }

  const ivName = isIndependent ? (name || request.independent_verifier?.name || 'your verifier') : null;
  const ivRole = isIndependent ? ((role_ || request.independent_verifier?.role || '').replace(/_/g, ' ')) : null;
  const html = requestEmailHtml(
    'Your achievement has been verified and published',
    [isIndependent
      ? `<strong>${request.title}</strong> was independently verified by <strong>${ivName}${ivRole ? `, ${ivRole}` : ''}</strong> and is now published on your profile.`
      : `<strong>${request.title}</strong> has been fully verified and published to your profile.`],
    `${appUrl()}/StudentBlockWards`,
    'View my credentials'
  );
  await notifyRequest(request.student_email, `Verified: "${request.title}"`, html);
  // In-app record for the same event (the email above already covered this).
  await notifyEvent(svc, {
    to_email: request.student_email,
    school_id: request.school_id,
    event_type: 'request_signed_off',
    title: `Verified: "${request.title}"`,
    body: 'Your achievement has been fully verified and published to your profile.',
    related_id: request.id,
  });

  return Response.json({ ok: true, status: 'archived', verification_id: mint.verificationId }, { headers: CORS });
}