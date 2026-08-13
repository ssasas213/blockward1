// Lightweight, local-first onboarding tour state.
// The tour is an EXPERIENCE layered over the app — no backend schema changes.
const TOUR_KEY = 'bw_tour_completed_v1';

export function isTourCompleted() {
  try { return localStorage.getItem(TOUR_KEY) === '1'; } catch { return false; }
}

export function completeTour() {
  try { localStorage.setItem(TOUR_KEY, '1'); } catch {}
}

export function resetTour() {
  try { localStorage.removeItem(TOUR_KEY); } catch {}
  window.dispatchEvent(new CustomEvent('bw-replay-tour'));
}