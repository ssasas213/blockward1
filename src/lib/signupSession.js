/**
 * Signup details stashed in sessionStorage so they survive the Google OAuth
 * redirect (same tab, full-page navigations) and the provisioning call on return.
 */
export const SIGNUP_STORAGE_KEYS = {
  first: 'blockward_signup_first',
  last: 'blockward_signup_last',
  code: 'blockward_signup_code',
  dob: 'blockward_signup_dob',
  guardian: 'blockward_signup_guardian',
};

/** True when the user arrived from the Signup flow with details stashed. */
export function hasSignupContext() {
  try {
    return Object.values(SIGNUP_STORAGE_KEYS).some((k) => sessionStorage.getItem(k));
  } catch {
    return false;
  }
}

/** Clears the pending signup state (details, claim handle). */
export function clearSignupSession() {
  try {
    Object.values(SIGNUP_STORAGE_KEYS).forEach((k) => sessionStorage.removeItem(k));
    sessionStorage.removeItem('blockward_claim_handle');
  } catch {
    /* ignore */
  }
}