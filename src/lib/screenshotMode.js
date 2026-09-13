// Screenshot mode — a Test Mode visual toggle that hides the TEST MODE banner
// so demo captures are clean.
//
// SESSION-LOCAL and purely visual: it never changes what data is shown or
// fetched, only whether the banner is painted. The toggle itself only ever
// renders inside Test Mode UI, so it is unreachable for normal users — and a
// stale flag is harmless anyway, because the banner renders only for the
// server-authorised test super user.
const KEY = 'bw_screenshot_mode';
const EVT = 'bw:screenshot-mode-changed';

export function isScreenshotMode() {
  try {
    return sessionStorage.getItem(KEY) === 'on';
  } catch {
    return false;
  }
}

export function setScreenshotMode(on) {
  try {
    if (on) sessionStorage.setItem(KEY, 'on');
    else sessionStorage.removeItem(KEY);
  } catch {
    /* storage unavailable — visual only, never fatal */
  }
  window.dispatchEvent(new Event(EVT));
}

export function onScreenshotModeChange(fn) {
  window.addEventListener(EVT, fn);
  return () => window.removeEventListener(EVT, fn);
}