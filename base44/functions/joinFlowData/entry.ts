import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { normalizeJoinCode, roleFromCode } from '../../shared/profileProvisioning.ts';

// joinFlowData — pre-signup lookups for the new join flow. Works WITHOUT a
// signed-in user (Screen 1 validates the code while the visitor types).
//
//   { code }            → live validation: { valid, reason?, role?, school?, code? }
//   { invitation_token } → invitation peek: { valid, reason?, role?, school?,
//                             invited_email (masked), invited_by_name? }
//
// It only ever reveals what the code/QR/invitation link itself already carries:
// the school's public name, logo, location and the role it grants.
export default async function(req: Request): Promise<Response> {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

    const body = await req.json().catch(() => ({}));
    const svc = createClientFromRequest(req).asServiceRole;

    const schoolInfo = (school) => ({
      name: school.name,
      logo_url: school.logo_url || null,
      city: school.city || null,
      country: school.country || null,
      org_type: school.org_type || 'school',
    });

    if (body.code) {
      const normalized = normalizeJoinCode(body.code);
      if (normalized.length < 5) {
        return Response.json({ ok: true, valid: false, reason: 'Keep typing your code…' });
      }
      const codes = await svc.entities.SchoolCode.filter({ status: 'active' });
      const code = codes.find(c => normalizeJoinCode(c.code) === normalized);
      if (!code) {
        return Response.json({ ok: true, valid: false, reason: 'Code not recognised. Check it with your teacher or school admin.' });
      }
      if (code.expires_at && new Date(code.expires_at) < new Date()) {
        return Response.json({ ok: true, valid: false, reason: 'This code has expired. Ask your school for a new one.' });
      }
      if (code.max_uses && (code.use_count || 0) >= code.max_uses) {
        return Response.json({ ok: true, valid: false, reason: 'This code has reached its usage limit.' });
      }
      let role;
      try {
        role = roleFromCode(code); // never admin
      } catch (e) {
        return Response.json({ ok: true, valid: false, reason: e.message });
      }
      const schools = await svc.entities.School.filter({ id: code.school_id });
      const school = schools[0];
      if (!school || school.status !== 'active') {
        return Response.json({ ok: true, valid: false, reason: 'This school is no longer active.' });
      }
      return Response.json({
        ok: true,
        valid: true,
        code: code.code,
        role,
        school: schoolInfo(school),
      });
    }

    if (body.invitation_token) {
      const invites = await svc.entities.SchoolInvitation.filter({ token: body.invitation_token });
      const invitation = invites[0];
      if (!invitation) return Response.json({ ok: true, valid: false, reason: 'This invitation could not be found.' });
      if (invitation.status === 'accepted') return Response.json({ ok: true, valid: false, reason: 'This invitation has already been used.' });
      if (invitation.status === 'revoked') return Response.json({ ok: true, valid: false, reason: 'This invitation has been cancelled by the administrator.' });
      if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
        return Response.json({ ok: true, valid: false, reason: 'This invitation has expired. Please ask your administrator to send a new one.' });
      }
      const schools = await svc.entities.School.filter({ id: invitation.school_id });
      const school = schools[0];
      if (!school || school.status === 'suspended' || school.status === 'inactive') {
        return Response.json({ ok: true, valid: false, reason: 'This school is no longer available.' });
      }
      // Mask the invited email — the link itself must not leak the full address.
      const [local, domain] = (invitation.invited_email || '').split('@');
      const masked = domain ? `${(local || '')[0] || '*'}***@${domain}` : invitation.invited_email;
      return Response.json({
        ok: true,
        valid: true,
        role: invitation.role,
        school: schoolInfo(school),
        invited_email: masked,
        invited_by_name: invitation.invited_by_name || invitation.invited_by || null,
      });
    }

    return Response.json({ error: 'code or invitation_token is required' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to check' }, { status: 500 });
  }
}