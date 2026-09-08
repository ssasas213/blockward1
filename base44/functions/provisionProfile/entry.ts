import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { provisionProfile } from '../../shared/profileProvisioning.ts';

// provisionProfile — the ONLY endpoint clients can call to create a
// UserProfile (UserProfile create is locked to the service role, so a direct
// entity create from the browser is refused). Accepts first name, last name
// and OPTIONALLY a join code or invitation token. The role and school are
// derived entirely server-side — a role in the request body is ignored.
//
// Response `next` tells the client where to go:
//   join_school      → 'pending' profile, no school yet — join or create a school
//   awaiting_approval→ teacher who joined via code, awaiting admin approval
//   student_setup    → student linked to a school — guided setup
//   teacher_dashboard→ teacher added via email invitation (pre-authorised)
//   admin_dashboard  → admin added via email invitation
//   login            → profile already existed — normal post-login routing
export default async function(req: Request): Promise<Response> {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const result = await provisionProfile(base44.asServiceRole, user, {
      first_name: body.first_name,
      last_name: body.last_name,
      join_code: body.join_code,
      invitation_token: body.invitation_token,
    });

    let next;
    if (result.already_exists) next = 'login';
    else if (result.status === 'pending_approval') next = 'awaiting_approval';
    else if (result.role === 'student') next = 'student_setup';
    else if (result.role === 'teacher') next = 'teacher_dashboard';
    else if (result.role === 'admin') next = 'admin_dashboard';
    else next = 'join_school';

    return Response.json({
      ok: true,
      next,
      role: result.role,
      status: result.status,
      school_name: result.school_name,
      mechanism: result.mechanism,
    });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to create profile' }, { status: 400 });
  }
}