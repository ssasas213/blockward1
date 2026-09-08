import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// checkSigninEmail — unauthenticated probe used by the sign-in screen's email
// step. Reveals ONLY whether the email already has an account (the same signal
// every email-first login form gives), so a brand-new email is routed into the
// signup flow with the email carried over instead of hitting a dead-end error.
export default async function(req: Request): Promise<Response> {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

    const body = await req.json().catch(() => ({}));
    const email = (body.email || '').trim().toLowerCase();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return Response.json({ error: 'A valid email is required' }, { status: 400 });
    }

    const svc = createClientFromRequest(req).asServiceRole;

    const profiles = await svc.entities.UserProfile.filter({ user_email: email });
    if (profiles.length > 0) return Response.json({ has_account: true });

    // Registered on the platform but never finished creating a BlockWard
    // profile — still an existing account; they sign in and land in onboarding.
    try {
      const users = await svc.entities.User.filter({ email });
      return Response.json({ has_account: users.length > 0 });
    } catch {
      return Response.json({ has_account: false });
    }
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to check' }, { status: 500 });
  }
}