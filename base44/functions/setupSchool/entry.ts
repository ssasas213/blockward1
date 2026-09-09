import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { createSchoolForAdmin } from '../../shared/schoolSetup.ts';
import { requireRealIdentity } from '../../shared/testMode.ts';

// setupSchool — self-service school creation ("I'm setting up a new school").
// SECURITY: the creator becomes super_admin of THIS school only, and the school
// is created with verification_status 'unverified' — usable normally, but
// blockchain-anchored credentials are paused until BlockWard verifies it.
// The school-creation logic lives in shared/schoolSetup.ts (one code path,
// shared with the demo seeding).
export default async function(req: Request): Promise<Response> {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

    const base44 = createClientFromRequest(req);

    // PRIVILEGED — school creation makes the caller an owner-admin, so it
    // authorises against the REAL controller identity, never the active test
    // persona (which would hand the persona a real school).
    const real = await requireRealIdentity(base44);
    if (!real.authorized) return Response.json({ error: real.reason || 'Unauthorized' }, { status: real.status || 401 });
    const user = real.user;
    const profile = real.profile;

    const body = await req.json();
    const {
      name, country, city, school_type, contact_email,
      logo_url, website, address,
      admin_full_name, admin_job_title, admin_department,
    } = body;

    if (!name?.trim()) return Response.json({ error: 'School name is required' }, { status: 400 });
    if (!contact_email?.trim()) return Response.json({ error: 'Contact email is required' }, { status: 400 });

    const svc = base44.asServiceRole;

    // Check for duplicate school owned by this admin
    const existingSchools = await svc.entities.School.filter({
      admin_email: user.email,
      status: 'active'
    });
    const duplicate = existingSchools.find(s =>
      s.name.trim().toLowerCase() === name.trim().toLowerCase()
    );
    if (duplicate) {
      return Response.json({ error: `You already own a school named "${duplicate.name}"` }, { status: 409 });
    }

    // Founding an organisation is how someone BECOMES an admin, so it cannot
    // require the role it grants. Allowed: existing admins (additional
    // schools), pending profiles, and student-default accounts (self-signup
    // now defaults to 'student' with no organisation — founding converts the
    // account to admin of THIS school only). Teachers may not — they join via
    // invitation or code and are approved by an admin. real.profile is the
    // controller's own profile, never a persona; it may be null for a
    // brand-new account, which the shared path provisions below.
    if (profile && !['admin', 'pending', 'student'].includes(profile.user_type)) {
      return Response.json({ error: 'Only administrators can create a school' }, { status: 403 });
    }

    const result = await createSchoolForAdmin(svc, {
      user, profile,
      name, school_type, country, city, website, contact_email, logo_url,
      address, admin_full_name, admin_job_title, admin_department,
    });

    return Response.json({
      success: true,
      school: {
        id: result.school.id,
        name: result.school.name,
        logo_url: result.school.logo_url,
        school_type: result.school.school_type,
      },
      verification_status: 'unverified',
      codes: result.codes,
      code_ids: result.code_ids,
    });
  } catch (error) {
    console.error('setupSchool error:', error);
    return Response.json({ error: error.message || 'Failed to create school' }, { status: 500 });
  }
}