const STORAGE_KEY = 'blockward_theme';

export function getStoredTheme() {
  try {
    return localStorage.getItem(STORAGE_KEY) || 'system';
  } catch {
    return 'system';
  }
}

export function resolveTheme(preference) {
  if (!preference || preference === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return preference;
}

export function applyTheme(preference) {
  const resolved = resolveTheme(preference);
  try {
    localStorage.setItem(STORAGE_KEY, preference || 'system');
  } catch {}
  const html = document.documentElement;
  if (resolved === 'light') {
    html.classList.add('light');
  } else {
    html.classList.remove('light');
  }
}

export function initTheme() {
  applyTheme(getStoredTheme());

  let mq;
  try {
    mq = window.matchMedia('(prefers-color-scheme: dark)');
  } catch {
    return;
  }
  if (mq && typeof mq.addEventListener === 'function') {
    mq.addEventListener('change', () => {
      if (getStoredTheme() === 'system') {
        applyTheme('system');
      }
    });
  }
}