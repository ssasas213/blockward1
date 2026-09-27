import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { guardedRedirect, setPostAuthRedirect } from '@/lib/authRedirectGuard';
import { handlePostLoginRedirect } from '@/lib/authHelpers';
import { Loader2 } from 'lucide-react';

/**
 * SignupEntryRoute — the classifier behind the platform signup entry URLs
 * (/schools/signup, /organisations/signup).
 *
 * A route whose purpose is to CREATE the account/profile/school can never
 * require that account/profile/school to already exist, so it routes each
 * visitor by their ACTUAL state:
 *
 *   1. Not authenticated            → /Signup (account registration). When an
 *      `intent` destination is given (e.g. /SchoolSetup for organisation
 *      creation), it is preserved across registration and honoured as soon
 *      as the account is provisioned.
 *   2. Authenticated, no profile    → /Signup's details form finishes the
 *      onboarding — with the intent preserved so an organisation founder
 *      lands on school creation right after.
 *   3. Authenticated, complete      → the canonical post-login router sends
 *      them to their own dashboard (or the pending/consent holding screen on
 *      the sign-in page). Never a duplicate profile or membership.
 *
 * Previously these routes were unconditional toLogin() stubs — a new visitor
 * could never register through them and just bounced back to Sign In.
 */
export default function SignupEntryRoute({ intent = null }) {
  const [status, setStatus] = useState('checking');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let user = null;
      try { user = await base44.auth.me(); } catch { /* not signed in */ }

      // Unauthenticated — straight into registration, intent preserved.
      if (!user) {
        if (intent) setPostAuthRedirect(intent);
        if (!cancelled) { setStatus('redirecting'); guardedRedirect('/Signup'); }
        return;
      }

      // Authenticated — does a BlockWard profile exist yet?
      let profiles = [];
      try { profiles = await base44.entities.UserProfile.filter({ user_email: user.email }); } catch { /* treat as none */ }

      if (profiles.length === 0) {
        // Account exists but onboarding is unfinished — /Signup's details
        // form is the canonical place to finish it, and the intent carries
        // the founder on to organisation creation afterwards.
        if (intent) setPostAuthRedirect(intent);
        if (!cancelled) { setStatus('redirecting'); guardedRedirect('/Signup'); }
        return;
      }

      // Completed account — the canonical post-login router picks the right
      // dashboard (or holding state) in one hop.
      const result = await handlePostLoginRedirect().catch(() => null);
      if (!cancelled) {
        setStatus('redirecting');
        if (result) guardedRedirect('/Login'); // pending/suspended/consent holding screens
      }
    })();
    return () => { cancelled = true; };
  }, [intent]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Loading" />
    </div>
  );
}