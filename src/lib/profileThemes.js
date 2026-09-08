// ============================================================================
// Public profile visual customisation — designed presets only, never raw
// styling. These profiles are read by admissions officers and employers as
// well as peers, so every option here is a finished design decision.
// ============================================================================

// ── 10 named themes ─────────────────────────────────────────────────────────
// `tokens` overrides the app's HSL-channel CSS custom properties for the
// profile page subtree (theme: null = inherit the classic BlockWard look).
export const THEMES = [
  {
    id: 'slate', label: 'Slate', desc: 'The classic BlockWard look',
    tokens: null,
    preview: { bg: '#08070D', card: '#16121F', accent: '#8B5CF6', text: '#F7F5FA' },
    banner: 'linear-gradient(135deg, #16121F, #241E33 55%, #312E58)',
    radius: '16px', shadow: '0 20px 60px -24px rgba(0,0,0,0.55)',
  },
  {
    id: 'midnight', label: 'Midnight', desc: 'Deep navy, glass cards',
    tokens: {
      background: '222 47% 6%', foreground: '220 30% 96%',
      card: '222 40% 10%', 'card-foreground': '220 30% 96%',
      border: '220 25% 18%', 'muted-foreground': '220 15% 65%',
      secondary: '222 35% 14%', primary: '243 75% 62%', 'primary-foreground': '0 0% 100%',
    },
    preview: { bg: '#0B1220', card: '#111A2E', accent: '#6366F1', text: '#E2E8F0' },
    banner: 'linear-gradient(135deg, #0F172A, #1E293B 45%, #3730A3)',
    radius: '18px', shadow: '0 24px 70px -24px rgba(15,23,42,0.7)',
  },
  {
    id: 'paper', label: 'Paper', desc: 'Warm editorial white',
    tokens: {
      background: '40 30% 97%', foreground: '20 14% 12%',
      card: '0 0% 100%', 'card-foreground': '20 14% 12%',
      border: '20 8% 88%', 'muted-foreground': '20 8% 40%',
      secondary: '40 20% 92%', primary: '243 60% 40%', 'primary-foreground': '0 0% 100%',
    },
    preview: { bg: '#FAF9F7', card: '#FFFFFF', accent: '#4338CA', text: '#1C1917' },
    banner: 'linear-gradient(135deg, #F5F5F4, #E7E5E4 55%, #D6D3D1)',
    radius: '12px', shadow: '0 12px 40px -16px rgba(120,113,108,0.28)',
  },
  {
    id: 'terracotta', label: 'Terracotta', desc: 'Warm clay tones',
    tokens: {
      background: '24 35% 96%', foreground: '20 20% 14%',
      card: '0 0% 100%', 'card-foreground': '20 20% 14%',
      border: '20 14% 87%', 'muted-foreground': '20 8% 40%',
      secondary: '24 30% 92%', primary: '14 63% 47%', 'primary-foreground': '0 0% 100%',
    },
    preview: { bg: '#FBF3EE', card: '#FFFFFF', accent: '#C2410C', text: '#2A1A12' },
    banner: 'linear-gradient(135deg, #FED7AA, #FB923C 50%, #C2410C)',
    radius: '14px', shadow: '0 12px 40px -16px rgba(194,65,12,0.28)',
  },
  {
    id: 'forest', label: 'Forest', desc: 'Calm deep greens',
    tokens: {
      background: '150 20% 96%', foreground: '160 20% 12%',
      card: '0 0% 100%', 'card-foreground': '160 20% 12%',
      border: '150 12% 87%', 'muted-foreground': '160 8% 34%',
      secondary: '150 25% 92%', primary: '160 84% 28%', 'primary-foreground': '0 0% 100%',
    },
    preview: { bg: '#F0F7F3', card: '#FFFFFF', accent: '#059669', text: '#0F231A' },
    banner: 'linear-gradient(135deg, #D1FAE5, #34D399 45%, #065F46)',
    radius: '14px', shadow: '0 12px 40px -16px rgba(5,150,105,0.28)',
  },
  {
    id: 'cobalt', label: 'Cobalt', desc: 'Confident deep blue',
    tokens: {
      background: '225 45% 96%', foreground: '228 28% 12%',
      card: '0 0% 100%', 'card-foreground': '228 28% 12%',
      border: '225 18% 87%', 'muted-foreground': '225 10% 36%',
      secondary: '225 40% 92%', primary: '225 76% 48%', 'primary-foreground': '0 0% 100%',
    },
    preview: { bg: '#F0F4FC', card: '#FFFFFF', accent: '#2563EB', text: '#131E36' },
    banner: 'linear-gradient(135deg, #DBEAFE, #3B82F6 45%, #1E3A8A)',
    radius: '14px', shadow: '0 12px 40px -16px rgba(37,99,235,0.3)',
  },
  {
    id: 'rose', label: 'Rose', desc: 'Soft, expressive pink',
    tokens: {
      background: '340 50% 97%', foreground: '335 25% 14%',
      card: '0 0% 100%', 'card-foreground': '335 25% 14%',
      border: '340 22% 89%', 'muted-foreground': '335 10% 38%',
      secondary: '340 45% 93%', primary: '340 74% 45%', 'primary-foreground': '0 0% 100%',
    },
    preview: { bg: '#FCF2F5', card: '#FFFFFF', accent: '#E11D48', text: '#2E1220' },
    banner: 'linear-gradient(135deg, #FCE7F3, #F472B6 45%, #9D174D)',
    radius: '16px', shadow: '0 12px 40px -16px rgba(225,29,72,0.28)',
  },
  {
    id: 'mono', label: 'Mono', desc: 'Editorial black and white',
    tokens: {
      background: '0 0% 96%', foreground: '0 0% 10%',
      card: '0 0% 100%', 'card-foreground': '0 0% 10%',
      border: '0 0% 87%', 'muted-foreground': '0 0% 40%',
      secondary: '0 0% 92%', primary: '0 0% 12%', 'primary-foreground': '0 0% 100%',
    },
    preview: { bg: '#F5F5F5', card: '#FFFFFF', accent: '#171717', text: '#171717' },
    banner: 'linear-gradient(135deg, #E5E5E5, #A3A3A3 55%, #262626)',
    radius: '8px', shadow: '0 10px 30px -14px rgba(0,0,0,0.25)',
  },
  {
    id: 'gradient', label: 'Gradient', desc: 'Soft mesh, playful',
    tokens: {
      background: '250 40% 97%', foreground: '248 25% 12%',
      card: '0 0% 100%', 'card-foreground': '248 25% 12%',
      border: '250 20% 88%', 'muted-foreground': '248 10% 38%',
      secondary: '250 45% 92%', primary: '262 83% 52%', 'primary-foreground': '0 0% 100%',
    },
    preview: { bg: '#F7F6FD', card: '#FFFFFF', accent: '#7C3AED', text: '#1B1636' },
    banner: 'linear-gradient(120deg, #C4B5FD, #F0ABFC 30%, #67E8F9 65%, #A5B4FC)',
    radius: '20px', shadow: '0 16px 50px -18px rgba(124,58,237,0.35)',
  },
  {
    id: 'carbon', label: 'Carbon', desc: 'Technical, high contrast',
    tokens: {
      background: '0 0% 7%', foreground: '0 0% 93%',
      card: '0 0% 12%', 'card-foreground': '0 0% 93%',
      border: '0 0% 22%', 'muted-foreground': '0 0% 60%',
      secondary: '0 0% 15%', primary: '0 0% 85%', 'primary-foreground': '0 0% 7%',
    },
    preview: { bg: '#0D0D0D', card: '#161616', accent: '#D4D4D4', text: '#F5F5F5' },
    banner: 'linear-gradient(135deg, #171717, #3F3F46 50%, #52525B)',
    radius: '12px', shadow: '0 20px 60px -24px rgba(0,0,0,0.8)',
  },
];

// ── 12-colour accent palette (fixed — no free picker) ──────────────────────
export const ACCENTS = [
  { name: 'Violet', hex: '#7C3AED' },
  { name: 'Indigo', hex: '#4F46E5' },
  { name: 'Cobalt', hex: '#2563EB' },
  { name: 'Teal', hex: '#0D9488' },
  { name: 'Emerald', hex: '#059669' },
  { name: 'Amber', hex: '#D97706' },
  { name: 'Orange', hex: '#EA580C' },
  { name: 'Red', hex: '#DC2626' },
  { name: 'Rose', hex: '#E11D48' },
  { name: 'Pink', hex: '#DB2777' },
  { name: 'Slate', hex: '#334155' },
  { name: 'Black', hex: '#171717' },
];

// ── 12 built-in abstract banners ('preset:<id>' stored in banner_url) ──────
export const PRESET_BANNERS = [
  { id: 'aurora', label: 'Aurora', css: 'linear-gradient(120deg, #0EA5E9 0%, #6366F1 35%, #A855F7 65%, #F0ABFC 100%)' },
  { id: 'dusk', label: 'Dusk', css: 'linear-gradient(120deg, #312E81 0%, #7C3AED 45%, #F472B6 100%)' },
  { id: 'ember', label: 'Ember', css: 'linear-gradient(120deg, #7C2D12 0%, #EA580C 45%, #FBBF24 100%)' },
  { id: 'glacier', label: 'Glacier', css: 'linear-gradient(120deg, #164E63 0%, #0891B2 50%, #A5F3FC 100%)' },
  { id: 'prism', label: 'Prism', css: 'conic-gradient(from 180deg at 50% 50%, #F87171, #FBBF24, #34D399, #60A5FA, #A78BFA, #F472B6, #F87171)' },
  { id: 'sandstone', label: 'Sandstone', css: 'linear-gradient(120deg, #78350F 0%, #D97706 45%, #FDE68A 100%)' },
  { id: 'tide', label: 'Tide', css: 'linear-gradient(120deg, #134E4A 0%, #0D9488 45%, #5EEAD4 100%)' },
  { id: 'orchid', label: 'Orchid', css: 'linear-gradient(120deg, #4A044E 0%, #A21CAF 50%, #F0ABFC 100%)' },
  { id: 'voltage', label: 'Voltage', css: 'linear-gradient(120deg, #052E16 0%, #16A34A 40%, #A3E635 100%)' },
  { id: 'botanical', label: 'Botanical', css: 'linear-gradient(120deg, #14532D 0%, #22C55E 45%, #BBF7D0 100%)' },
  { id: 'nebula', label: 'Nebula', css: 'radial-gradient(ellipse at 20% 20%, #7C3AED 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, #0EA5E9 0%, transparent 50%), linear-gradient(120deg, #0F172A, #1E1B4B)' },
  { id: 'blueprint', label: 'Blueprint', css: 'linear-gradient(120deg, #1E3A8A 0%, #2563EB 55%, #93C5FD 100%)' },
];

// ── 4 curated font pairings (heading font; body stays Inter) ────────────────
export const FONTS = [
  { id: 'sans', label: 'Sans', desc: 'Clean and neutral', heading: "'Inter', system-ui, sans-serif" },
  { id: 'serif', label: 'Serif', desc: 'Editorial, traditional', heading: "'Fraunces', Georgia, serif" },
  { id: 'mono', label: 'Mono', desc: 'Technical, precise', heading: "'JetBrains Mono', ui-monospace, monospace" },
  { id: 'display', label: 'Display', desc: 'Bold and modern', heading: "'Sora', 'Inter', sans-serif" },
];

// ── Social platforms (whitelist — the link-in-bio mechanic) ─────────────────
export const SOCIAL_PLATFORMS = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'github', label: 'GitHub' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'twitter', label: 'X' },
  { id: 'discord', label: 'Discord' },
  { id: 'behance', label: 'Behance' },
  { id: 'dribbble', label: 'Dribbble' },
  { id: 'strava', label: 'Strava' },
  { id: 'chess', label: 'Chess.com' },
  { id: 'website', label: 'Website' },
];

export const LAYOUTS = [
  { id: 'grid', label: 'Grid', desc: 'Card grid — best for many achievements' },
  { id: 'list', label: 'List', desc: 'Compact rows — best for a long record' },
  { id: 'showcase', label: 'Showcase', desc: 'Large hero for your top pinned achievement' },
];

// ── Helpers ────────────────────────────────────────────────────────────────

export function findTheme(id) {
  return THEMES.find((t) => t.id === id) || THEMES[0];
}

export function findFont(id) {
  return FONTS.find((f) => f.id === id) || FONTS[0];
}

// hex → HSL channel string ("h s% l%") for the app's CSS custom properties.
export function hexToHsl(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function isLightHex(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const lum = 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
  return lum > 150;
}

// The inline style object for the profile page subtree. Overriding the app's
// token variables themes every child component at once.
export function themeVars(themeId, accentHex, fontId) {
  const theme = findTheme(themeId);
  const vars = {};
  if (theme.tokens) {
    for (const [k, v] of Object.entries(theme.tokens)) vars[`--${k}`] = v;
  }
  if (accentHex && ACCENTS.some((a) => a.hex.toLowerCase() === accentHex.toLowerCase())) {
    const hsl = hexToHsl(accentHex);
    if (hsl) {
      vars['--primary'] = hsl;
      vars['--primary-foreground'] = isLightHex(accentHex) ? '0 0% 10%' : '0 0% 100%';
    }
  }
  const font = findFont(fontId);
  vars['--font-heading'] = font.heading;
  vars['--pf-radius'] = theme.radius;
  if (theme.shadow) vars['--pf-shadow'] = theme.shadow;
  vars['--pf-banner'] = theme.banner;
  return vars;
}

// CSS style for a banner value — preset gradient or uploaded image.
export function bannerStyle(url) {
  if (!url) return null;
  if (url.startsWith('preset:')) {
    const p = PRESET_BANNERS.find((b) => `preset:${b.id}` === url);
    return p ? { background: p.css } : null;
  }
  return { backgroundImage: `url(${url})`, backgroundSize: 'cover', backgroundPosition: 'center' };
}

// Normalize a user-typed URL: force https, reject other protocols.
export function normalizeSocialUrl(raw) {
  let url = (raw || '').trim();
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') u.protocol = 'https:';
    if (!/^https:$/.test(u.protocol)) return null;
    return u.toString();
  } catch {
    return null;
  }
}