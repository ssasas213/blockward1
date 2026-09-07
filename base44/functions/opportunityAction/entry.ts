/**
 * opportunityAction — write-side for the opportunities marketplace.
 *
 * Actions:
 *  - create / update   → organisation admins manage their listings
 *  - apply             → student applies; their verified credentials attach
 *                        automatically (no CV upload, no unverifiable claims)
 *  - update_status     → applicant pipeline: applied → shortlisted →
 *                        interviewing → offered / rejected
 *  - message           → in-platform thread between applicant and organisation
 *  - complete          → organisation records the student completed it
 *  - issue_credential  → closes the loop: creates an achievement request so
 *                        the completion becomes a verified credential
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { resolveEffectiveActor } from '../../shared/testMode.ts';
import { getVerifiedCredentials, notifyUser, isDeadlineOpen, computeMatch } from '../../shared/opportunities.ts';
import { notifyEvent } from '../../shared/eventNotifications.ts';
import { requestEmailHtml, appUrl } from '../../shared/achievementRequests.ts';

const TYPES = ['internship', 'competition', 'volunteering', 'scholarship', 'trial', 'workshop', 'part_time_role'];
const CATEGORIES = ['academic', 'sports', 'arts', 'leadership', 'community', 'behaviour', 'special'];
const APP_STATUSES = ['applied', 'shortlisted', 'interviewing', 'offered', 'rejected'];

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function cleanRequirements(list: any) {
  return (list || [])
    .filter((r: any) => (r?.label || '').trim())
    .map((r: any) => ({ label: r.label.trim(), category: CATEGORIES.includes(r.category) ? r.category : null }));
}

function cleanQuestions(list: any) {
  return (list || [])
    .filter((q: any) => (q?.question || '').trim())
    .map((q: any) => ({ question: q.question.trim(), required: !!q.required }));
}

async function getOwnedOpportunity(svc: any, profile: any, opportunity_id: string) {
  if (profile.user_type !== 'admin' || !profile.school_id) {
    throw new HttpError(403, 'Only organisation admins can manage opportunities.');
  }
  const rows = await svc.entities.Opportunity.filter({ id: opportunity_id });
  const opp = rows[0];
  if (!opp) throw new HttpError(404, 'Opportunity not found.');
  if (opp.organisation_id !== profile.school_id) {
    throw new HttpError(403, 'This opportunity belongs to another organisation.');
  }
  return opp;
}

async function getOwnedApplication(svc: any, profile: any, application_id: string) {
  if (profile.user_type !== 'admin' || !profile.school_id) {
    throw new HttpError(403, 'Only organisation admins can manage applications.');
  }
  const rows = await svc.entities.OpportunityApplication.filter({ id: application_id });
  const app = rows[0];
  if (!app) throw new HttpError(404, 'Application not found.');
  if (app.organisation_id !== profile.school_id) {
    throw new HttpError(403, 'This application belongs to another organisation.');
  }
  return app;
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));

    const actor = await resolveEffectiveActor(base44);
    if (!actor.authorized) {
      return Response.json({ ok: false, error: actor.reason }, { status: actor.status || 403 });
    }

    const profileRows = await svc.entities.UserProfile.filter({ id: actor.actor_id });
    const profile = profileRows[0];
    if (!profile) return Response.json({ ok: false, error: 'Profile not found' }, { status: 404 });

    const actorName = `${actor.first_name || ''} ${actor.last_name || ''}`.trim() || profile.user_email;
    const now = new Date().toISOString();

    switch (body.action) {
      // ---------------- create listing ----------------
      case 'create': {
        if (profile.user_type !== 'admin' || !profile.school_id) {
          throw new HttpError(403, 'Only organisation admins can post opportunities.');
        }
        const o = body.opportunity || {};
        const title = (o.title || '').trim();
        if (!title) throw new HttpError(400, 'Please give the opportunity a title.');
        if (!(o.description || '').trim()) throw new HttpError(400, 'Please describe the opportunity.');
        if (!TYPES.includes(o.type)) throw new HttpError(400, 'Please pick a valid opportunity type.');

        const schoolRows = await svc.entities.School.filter({ id: profile.school_id });
        const school = schoolRows[0];

        const created = await svc.entities.Opportunity.create({
          organisation_id: profile.school_id,
          organisation_name: school?.name || profile.school_id,
          created_by: actor.actor_email,
          created_by_name: actorName,
          title,
          type: o.type,
          category: CATEGORIES.includes(o.category) ? o.category : 'special',
          description: o.description.trim(),
          location: (o.location || '').trim() || null,
          is_remote: !!o.is_remote,
          application_deadline: o.application_deadline || null,
          required_credentials: cleanRequirements(o.required_credentials),
          preferred_credentials: cleanRequirements(o.preferred_credentials),
          min_age: typeof o.min_age === 'number' && o.min_age > 0 ? o.min_age : null,
          application_questions: cleanQuestions(o.application_questions),
          status: o.status === 'draft' ? 'draft' : 'open',
        });

        // Best-effort: notify students whose verified credentials match the
        // new listing (per-type preferences apply). Never blocks the create.
        try {
          if (created.status === 'open' && (created.required_credentials || []).length > 0) {
            const regRows = await svc.entities.BlockWardVerificationRegistry.filter({}, '-created_date', 500);
            const credsByEmail = new Map<string, any[]>();
            for (const r of regRows) {
              if ((r.approval_status || 'approved') !== 'approved' || !r.student_email) continue;
              if (!credsByEmail.has(r.student_email)) credsByEmail.set(r.student_email, []);
              credsByEmail.get(r.student_email)!.push(r);
            }
            const oppUrl = `${appUrl()}/Opportunities`;
            let notified = 0;
            for (const [email, creds] of credsByEmail) {
              if (notified >= 50) break;
              const match = computeMatch(created, creds);
              if (match.matched_count === 0) continue;
              await notifyEvent(svc, {
                to_email: email,
                school_id: null,
                event_type: 'opportunity_match',
                title: `New opportunity matching your credentials: ${created.title}`,
                body: `${created.organisation_name} posted "${created.title}" — ${match.matched_count} of your verified credential${match.matched_count === 1 ? '' : 's'} match${match.matched_count === 1 ? 'es' : ''}.`,
                related_id: created.id,
                email_subject: `A new opportunity matches your verified credentials`,
                email_html: requestEmailHtml(`A new opportunity matches your credentials`, [
                  `<strong>${created.organisation_name}</strong> posted <strong>${created.title}</strong> (${created.type.replace(/_/g, ' ')}).`,
                  `${match.matched_count} of your verified credential${match.matched_count === 1 ? '' : 's'} match${match.matched_count === 1 ? 'es' : ''} what they're looking for.`,
                ], oppUrl, 'View the opportunity'),
              });
              notified++;
            }
          }
        } catch (e: any) {
          console.log('[opportunityAction] match notifications failed:', e?.message || e);
        }

        return Response.json({ ok: true, opportunity_id: created.id });
      }

      // ---------------- update listing ----------------
      case 'update': {
        const opp = await getOwnedOpportunity(svc, profile, body.opportunity_id);
        const c = body.changes || {};
        const updates: any = {};
        if (c.title !== undefined) {
          const t = (c.title || '').trim();
          if (!t) throw new HttpError(400, 'Title cannot be empty.');
          updates.title = t;
        }
        if (c.description !== undefined) {
          const d = (c.description || '').trim();
          if (!d) throw new HttpError(400, 'Description cannot be empty.');
          updates.description = d;
        }
        if (c.type !== undefined) {
          if (!TYPES.includes(c.type)) throw new HttpError(400, 'Invalid opportunity type.');
          updates.type = c.type;
        }
        if (c.category !== undefined) updates.category = CATEGORIES.includes(c.category) ? c.category : 'special';
        if (c.location !== undefined) updates.location = (c.location || '').trim() || null;
        if (c.is_remote !== undefined) updates.is_remote = !!c.is_remote;
        if (c.application_deadline !== undefined) updates.application_deadline = c.application_deadline || null;
        if (c.min_age !== undefined) updates.min_age = typeof c.min_age === 'number' && c.min_age > 0 ? c.min_age : null;
        if (c.required_credentials !== undefined) updates.required_credentials = cleanRequirements(c.required_credentials);
        if (c.preferred_credentials !== undefined) updates.preferred_credentials = cleanRequirements(c.preferred_credentials);
        if (c.application_questions !== undefined) updates.application_questions = cleanQuestions(c.application_questions);
        if (c.status !== undefined) {
          if (!['draft', 'open', 'closed'].includes(c.status)) throw new HttpError(400, 'Invalid status.');
          updates.status = c.status;
        }
        if (Object.keys(updates).length === 0) throw new HttpError(400, 'Nothing to update.');
        await svc.entities.Opportunity.update(opp.id, updates);
        return Response.json({ ok: true });
      }

      // ---------------- student applies ----------------
      case 'apply': {
        const rows = await svc.entities.Opportunity.filter({ id: body.opportunity_id });
        const opp = rows[0];
        if (!opp || opp.status !== 'open') throw new HttpError(400, 'This opportunity is not open for applications.');
        if (!isDeadlineOpen(opp)) throw new HttpError(400, 'The application deadline has passed.');

        const existing = await svc.entities.OpportunityApplication.filter({
          opportunity_id: opp.id,
          student_email: profile.user_email,
        });
        if (existing.length > 0) throw new HttpError(400, 'You have already applied to this opportunity.');

        const questions = opp.application_questions || [];
        const answers = (body.answers || []).map((a: any) => ({
          question: a.question,
          answer: (a.answer || '').trim(),
        }));
        for (const q of questions) {
          if (q.required) {
            const ans = answers.find((a: any) => a.question === q.question)?.answer;
            if (!ans) throw new HttpError(400, `Please answer the required question: "${q.question}"`);
          }
        }

        const creds = await getVerifiedCredentials(svc, profile.user_email);
        const app = await svc.entities.OpportunityApplication.create({
          opportunity_id: opp.id,
          opportunity_title: opp.title,
          organisation_id: opp.organisation_id,
          organisation_name: opp.organisation_name,
          student_profile_id: profile.id,
          student_email: profile.user_email,
          student_name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.user_email,
          student_handle: profile.handle || null,
          status: 'applied',
          answers,
          verified_credential_count: creds.length,
          credential_issued: false,
          messages: [],
        });

        await notifyUser(
          svc, opp.created_by, opp.organisation_id,
          `New applicant for ${opp.title}`,
          `${profile.first_name || 'A student'} applied with ${creds.length} verified credential${creds.length === 1 ? '' : 's'} attached.`,
          app.id
        );
        return Response.json({ ok: true, application_id: app.id });
      }

      // ---------------- applicant pipeline ----------------
      case 'update_status': {
        const app = await getOwnedApplication(svc, profile, body.application_id);
        if (!APP_STATUSES.includes(body.status)) throw new HttpError(400, 'Invalid application status.');
        await svc.entities.OpportunityApplication.update(app.id, { status: body.status });
        await notifyUser(
          svc, app.student_email, app.organisation_id,
          `Application update: ${app.opportunity_title}`,
          `Your application at ${app.organisation_name} is now "${body.status}".`,
          app.id
        );
        return Response.json({ ok: true });
      }

      // ---------------- in-platform messaging ----------------
      case 'message': {
        const rows = await svc.entities.OpportunityApplication.filter({ id: body.application_id });
        const app = rows[0];
        if (!app) throw new HttpError(404, 'Application not found.');
        const text = (body.text || '').trim();
        if (!text) throw new HttpError(400, 'Please write a message.');

        const isOrgAdmin = profile.user_type === 'admin' && profile.school_id && app.organisation_id === profile.school_id;
        const isApplicant = app.student_email === profile.user_email;
        if (!isOrgAdmin && !isApplicant) throw new HttpError(403, 'You cannot message on this application.');

        const messages = [...(app.messages || []), {
          sender: isOrgAdmin ? 'organisation' : 'student',
          sender_name: actorName,
          text,
          timestamp: now,
        }];
        await svc.entities.OpportunityApplication.update(app.id, { messages });

        let recipientEmail: string | null = null;
        if (isOrgAdmin) {
          recipientEmail = app.student_email;
        } else {
          const oppRows = await svc.entities.Opportunity.filter({ id: app.opportunity_id });
          recipientEmail = oppRows[0]?.created_by || null;
        }
        if (recipientEmail) {
          await notifyUser(
            svc, recipientEmail, app.organisation_id,
            `New message — ${app.opportunity_title}`,
            `${actorName}: ${text.slice(0, 100)}`,
            app.id
          );
        }
        return Response.json({ ok: true });
      }

      // ---------------- mark completed ----------------
      case 'complete': {
        const app = await getOwnedApplication(svc, profile, body.application_id);
        if (app.completed_at) return Response.json({ ok: true, already: true });
        await svc.entities.OpportunityApplication.update(app.id, { completed_at: now });
        await notifyUser(
          svc, app.student_email, app.organisation_id,
          `Marked complete: ${app.opportunity_title}`,
          `${app.organisation_name} recorded that you completed this opportunity.`,
          app.id
        );
        return Response.json({ ok: true });
      }

      // ---------------- close the loop: issue the completion credential ----------------
      case 'issue_credential': {
        const app = await getOwnedApplication(svc, profile, body.application_id);
        if (app.credential_issued) throw new HttpError(400, 'A credential has already been issued for this application.');

        const oppRows = await svc.entities.Opportunity.filter({ id: app.opportunity_id });
        const opp = oppRows[0];
        if (!opp) throw new HttpError(404, 'Opportunity not found.');

        const title = (body.title || `Completed ${opp.title}`).trim().slice(0, 120);
        const dateAchieved = (app.completed_at || now).slice(0, 10);

        const request = await svc.entities.AchievementRequest.create({
          school_id: opp.organisation_id,
          school_name: opp.organisation_name,
          student_id: app.student_profile_id,
          student_email: app.student_email,
          student_name: app.student_name,
          title,
          description: `${app.student_name} completed "${opp.title}" (${opp.type}) hosted by ${opp.organisation_name}.`,
          category: opp.category || 'special',
          date_achieved: dateAchieved,
          evidence: [],
          is_team: false,
          nominated_verifier_id: profile.id,
          nominated_verifier_email: profile.user_email,
          nominated_verifier_name: actorName,
          verification_tier: 1,
          status: 'submitted',
          submitted_at: now,
          event_log: [{
            event: 'submitted',
            actor_email: actor.actor_email,
            actor_name: actorName,
            actor_role: 'admin',
            note: 'Created from a completed opportunity.',
            timestamp: now,
          }],
        });

        await svc.entities.OpportunityApplication.update(app.id, {
          credential_issued: true,
          credential_request_id: request.id,
          completed_at: app.completed_at || now,
        });

        await notifyUser(
          svc, app.student_email, app.organisation_id,
          'A credential has been requested for you',
          `${opp.organisation_name} submitted "${title}" for verification — it will appear on your profile once signed off.`,
          app.id
        );
        return Response.json({ ok: true, credential_request_id: request.id });
      }

      default:
        return Response.json({ ok: false, error: 'Unknown action.' }, { status: 400 });
    }
  } catch (error: any) {
    if (error instanceof HttpError) {
      return Response.json({ ok: false, error: error.message }, { status: error.status });
    }
    console.error('[opportunityAction] fatal:', error?.message || error);
    return Response.json({ ok: false, error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}