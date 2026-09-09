import { base44 } from '@/api/base44Client';
import { clearSignupSession } from '@/lib/signupSession';

/**
 * Auth redirect + reload guards. Every automatic auth redirect in the app
 * goes through this module — the two loop classes it prevents:
 *   1. in-app redirect ping-pong (counted, MAX_REDIRECTS within 10s)
 *   2. document RELOAD loops (401 → logout → reload → 401 …), which an
 *      in-app counter can never see — page LOADS are counted separately.
 */

const REDIRECT_LOG_KEY = 'blockward_auth_redirect_log';
const WINDOW_MS = 10000;
const MAX_REDIRECTS = 3;

const AUTH_LOAD_LOG_KEY = 'blockward_auth_load_log';
const AUTH_LOAD_ROUTES = ['/Login', '/Signup'];
const LOAD_WINDOW_MS = 10000;
const LOAD_TRIP_COUNT = 4;
const LOAD_RESET_MS = 30000;

export const AUTH_LOOP_ERROR_URL = '/AuthLoopError';

function isSamePath(url) {
  try {
    return new URL(url, window.location.origin).pathname === window.location.pathname;
  } catch {
    return false;
  }
}

export function resetRedirectLog() {
  try { sessionStorage.removeItem(REDIRECT_LOG_KEY); } catch { /* ignore */ }
}

/**
 * The ONE helper for automatic redirects:
 * - NEVER navigates to the page we are already on (that is a reload loop)
 * - counts in-app redirects; over budget → visible error page, not a loop.
 */
export function guardedRedirect(url) {
  if (isSamePath(url)) return false;

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

/** All '/Login' redirects route through here. */
export function toLogin() {
  return guardedRedirect('/Login');
}

/**
 * Sign out with an explicit destination. NEVER pass the current URL to
 * base44.auth.logout — that reload-loops any page where logout can be
 * triggered by a page load (it redirected /Login to itself). Clears the
 * token, then goes to /Login; already there, one clean reload is enough (an
 * explicit Sign Out click is a user action, one load — it cannot loop).
 */
export function logoutToLogin() {
  try { base44.auth.logout(); } catch { /* ignore */ }
  if (isSamePath('/Login')) {
    window.location.reload();
    return;
  }
  toLogin();
}

// ── Reload-loop guard ────────────────────────────────────────────────
// Counts page LOADS of auth routes (/Login, /Signup). On the 4th load within
// 10 seconds it stops, clears all auth + signup session state, and renders
// the loop-error page. The log ages out after 30 seconds and resets on a
// successful authentication (AuthContext calls resetAuthLoadLog).

export function resetAuthLoadLog() {
  try { sessionStorage.removeItem(AUTH_LOAD_LOG_KEY); } catch { /* ignore */ }
}

/** Run once per document load (src/main.jsx). */
export function initAuthLoadGuard() {
  try {
    if (!AUTH_LOAD_ROUTES.includes(window.location.pathname)) return;

    const now = Date.now();
    let log = [];
    try {
      log = (JSON.parse(sessionStorage.getItem(AUTH_LOAD_LOG_KEY) || '[]'))
        .filter((t) => now - t < LOAD_RESET_MS);
    } catch {
      log = [];
    }
    log.push(now);
    try { sessionStorage.setItem(AUTH_LOAD_LOG_KEY, JSON.stringify(log)); } catch { /* ignore */ }

    const recent = log.slice(-LOAD_TRIP_COUNT);
    if (recent.length === LOAD_TRIP_COUNT && now - recent[0] < LOAD_WINDOW_MS) {
      resetAuthLoadLog();
      resetRedirectLog();
      clearSignupSession();
      try { base44.auth.logout(); } catch { /* ignore */ }
      window.location.replace(AUTH_LOOP_ERROR_URL);
    }
  } catch {
    /* ignore */
  }
}