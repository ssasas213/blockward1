/**
 * Loop guard for automatic auth redirects (Signup ↔ Onboarding-class bugs).
 *
 * Every automatic `window.location.href` in the auth flow must go through
 * guardedRedirect. It counts redirects in a 10-second window; after 3, it
 * stops navigating and shows a visible error page instead of looping forever.
 */
const REDIRECT_LOG_KEY = 'blockward_auth_redirect_log';
const WINDOW_MS = 10000;
const MAX_REDIRECTS = 3;

export const AUTH_LOOP_ERROR_URL = '/AuthLoopError';

export function resetRedirectLog() {
  try { sessionStorage.removeItem(REDIRECT_LOG_KEY); } catch { /* ignore */ }
}

/**
 * Navigates to `url`, unless the redirect budget for the last 10 seconds is
 * exhausted — then navigates to the loop-error page instead.
 * Returns true when the navigation to `url` went through.
 */
export function guardedRedirect(url) {
  const now = Date.now();
  let log = [];
  try {
    log = (JSON.parse(sessionStorage.getItem(REDIRECT_LOG_KEY) || '[]'))
      .filter((t) => now - t < WINDOW_MS);
  } catch {
    log = [];
  }
  log.push(now);
  try { sessionStorage.setItem(REDIRECT_LOG_KEY, JSON.stringify(log)); } catch { /* ignore */ }

  if (log.length > MAX_REDIRECTS) {
    // Reset first so the error page itself can navigate without re-tripping.
    resetRedirectLog();
    window.location.href = AUTH_LOOP_ERROR_URL;
    return false;
  }
  window.location.href = url;
  return true;
}