// Blockward INTERNAL ADMIN authorization.
//
// This is the SOLE authority for Blockward internal operations (organisation
// approval, suspension, rejection, info requests). It is enforced SERVER-SIDE
// in every privileged backend function. Frontend gating is UX only.
//
// The allowlist below is the grant mechanism. Initial authorised accounts:
//   mazen@blockward.me
//   arya@blockward.me
//
// These accounts are ordinary Blockward users (Holder/Verifier/Owner) that
// ADDITIONALLY carry the internal-admin permission. There is no client-set
// role: a user cannot grant this to themselves, and editing frontend state or
// localStorage cannot elevate access — the backend re-checks on every call.
//
// For developer testing only, when TEST_MODE_ENABLED is set, the platform's
// test super user is also treated as internal admin so the console can be
// exercised end-to-end. This never affects production.

export const INTERNAL_ADMIN_EMAILS: string[] = ['mazen@blockward.me', 'arya@blockward.me'];

export function isInternalAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return INTERNAL_ADMIN_EMAILS.includes(String(email).trim().toLowerCase());
}

// Resolves the authenticated user via the SDK and returns a 403 Response error
// when the caller is not an internal admin. Callers check `error` and return it
// directly. Mirrors the {value, error} pattern used across the codebase.
export async function requireInternalAdmin(base44: any): Promise<{ me: any | null; error: Response | null }> {
  let me: any = null;
  try {
    me = await base44.auth.me();
  } catch {
    return { me: null, error: Response.json({ error: 'Authentication required' }, { status: 401 }) };
  }
  const email = String(me?.email || '').trim().toLowerCase();

  // Test-mode super user may act as internal admin for development/testing.
  let testSuperOk = false;
  try {
    const { isTestModeEnabled, getTestSuperUserEmail } = await import('./testMode.ts');
    testSuperOk = isTestModeEnabled() && email === getTestSuperUserEmail().toLowerCase();
  } catch { /* testMode not available */ }

  if (!isInternalAdmin(email) && !testSuperOk) {
    return { me: null, error: Response.json({ error: 'Blockward internal admin only' }, { status: 403 }) };
  }
  return { me, error: null };
}