/**
 * opportunityData — read-side for the opportunities marketplace.
 *
 * Modes:
 *  - { mode: 'org' } (organisation admin) → own listings + every applicant
 *    with their verified credentials attached and matched to each listing's
 *    requirements (matched ones highlighted for the organisation).
 *  - {} (default) → the student-facing feed: every open opportunity with a
 *    computed match indicator against the student's verified credentials,
 *    plus the student's own applications with their message threads.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { resolveEffectiveActor } from '../../shared/testMode.ts';
import { computeMatch, getVerifiedCredentials, mapCredentialPublic } from '../../shared/opportunities.ts';

const mapOpportunity = (o: any) => ({
  id: o.id,
  organisation_id: o.organisation_id,
  organisation_name: o.organisation_name,
  title: o.title,
  type: o.type,
  category: o.category || 'special',
  description: o.description,
  location: o.location || null,
  is_remote: !!o.is_remote,
  application_deadline: o.application_deadline || null,
  required_credentials: o.required_credentials || [],
  preferred_credentials: o.preferred_credentials || [],
  min_age: o.min_age ?? null,
  application_questions: o.application_questions || [],
  status: o.status,
  created_date: o.created_date,
});

const mapApplication = (a: any) => ({
  id: a.id,
  opportunity_id: a.opportunity_id,
  opportunity_title: a.opportunity_title,
  organisation_name: a.organisation_name,
  status: a.status,
  answers: a.answers || [],
  completed_at: a.completed_at || null,
  credential_issued: !!a.credential_issued,
  credential_request_id: a.credential_request_id || null,
  messages: a.messages || [],
  created_date: a.created_date,
});

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

    // ---------- Organisation admin console ----------
    if (body.mode === 'org') {
      if (profile.user_type !== 'admin' || !profile.school_id) {
        return Response.json({ ok: false, error: 'Only organisation admins can view the opportunities console.' }, { status: 403 });
      }
      const [opps, apps] = await Promise.all([
        svc.entities.Opportunity.filter({ organisation_id: profile.school_id }, '-created_date'),
        svc.entities.OpportunityApplication.filter({ organisation_id: profile.school_id }, '-created_date'),
      ]);

      const credCache = new Map<string, any[]>();
      const applications = [];
      for (const app of apps) {
        if (!credCache.has(app.student_email)) {
          credCache.set(app.student_email, await getVerifiedCredentials(svc, app.student_email));
        }
        const creds = credCache.get(app.student_email);
        const opp = opps.find((o: any) => o.id === app.opportunity_id);
        applications.push({
          ...mapApplication(app),
          student_email: app.student_email,
          student_name: app.student_name,
          student_handle: app.student_handle || null,
          verified_credential_count: creds.length,
          credentials: creds.map(mapCredentialPublic),
          match: opp ? computeMatch(opp, creds) : null,
        });
      }

      const opportunities = opps.map((o: any) => ({
        ...mapOpportunity(o),
        applicant_count: apps.filter((a: any) => a.opportunity_id === o.id).length,
      }));
      return Response.json({ ok: true, opportunities, applications });
    }

    // ---------- Student feed ----------
    const [opps, myApps, creds] = await Promise.all([
      svc.entities.Opportunity.filter({ status: 'open' }, '-created_date'),
      svc.entities.OpportunityApplication.filter({ student_email: profile.user_email }, '-created_date'),
      getVerifiedCredentials(svc, profile.user_email),
    ]);

    const opportunities = opps.map((o: any) => ({
      ...mapOpportunity(o),
      match: computeMatch(o, creds),
      applied_application_id: myApps.find((a: any) => a.opportunity_id === o.id)?.id || null,
    }));

    return Response.json({
      ok: true,
      opportunities,
      applications: myApps.map(mapApplication),
      my_verified_count: creds.length,
    });
  } catch (error: any) {
    console.error('[opportunityData] fatal:', error?.message || error);
    return Response.json({ ok: false, error: 'Could not load opportunities.' }, { status: 500 });
  }
}