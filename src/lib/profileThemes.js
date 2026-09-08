// ============================================================================
// profileThemes — the bounded visual customisation system for public
// /@handle profiles. Students choose from designed presets, never raw
// styling: these profiles are read by admissions officers and employers as
// well as peers.
//
// Themes are expressed as overrides of the app's HSL token channels, applied
// to the profile page wrapper — every token-based class inside the profile
// (cards, borders, text) follows the chosen theme automatically.
// ============================================================================

const h = (hu, sa, li) => `${hu} ${sa}% ${li}%`;

// ── 10 named themes ───────────────────────────────────────────────────────
// Each defines background treatment, card style, border radius, shadow depth
// and text colour. `tokens: null` means "inherit the app's default tokens".
export const THEMES = [
  {
    id: 'slate', label: 'Slate',
    desc: 'The BlockWard standard — quiet neutrals, achievements lead.',
    tokens: null,
    banner: 'linear-gradient(120deg, #0f172a 0%, #1e293b 55%, #334155 100%)',
    radius: '16px', shadow: '0 8px 30px rgba(2,6,23,0.25)',
  },
  {
    id: 'midnight', label: 'Midnight',
    desc: 'Deep navy, glass cards, indigo glow.',
    tokens: {
      background: h(224, 47, 6), foreground: h(220, 40, 95),
      card: h(225, 40, 11), 'card-foreground': h(220, 40, 95),
      border: h(222, 32, 20), muted: h(224, 30, 16), 'muted-foreground': h(220, 20, 65),
      tertiary: h(220, 15, 50), secondary: h(224, 30, 15), 'secondary-foreground': h(220, 40, 95),
      primary: h(243, 75, 59), 'primary-foreground': h(0, 0, 100),
      ring: h(243, 75, 59), accent: h(243, 60, 16), 'accent-foreground': h(220, 40, 95),
    },
    banner: 'radial-gradient(120% 150% at 20% 0%, #312e81 0%, transparent 60%), radial-gradient(100% 120% at 85% 15%, #0e7490 0%, transparent 55%), #0b1020',
    radius: '18px', shadow: '0 20px 50px rgba(2,6,23,0.5)',
  },
  {
    id: 'paper', label: 'Paper',
    desc: 'Warm editorial white — calm and credible on paper.',
    tokens: {
      background: h(40, 30, 97), foreground: h(20, 14, 12),
      card: h(0, 0, 100), 'card-foreground': h(20, 14, 12),
      border: h(20, 10, 88), muted: h(40, 20, 94), 'muted-foreground': h(20, 8, 42),
      tertiary: h(20, 6, 55), secondary: h(40, 20, 94), 'secondary-foreground': h(20, 14, 12),
      primary: h(243, 70, 40), 'primary-foreground': h(0, 0, 100),
      ring: h(243, 70, 40), accent: h(40, 30, 92), 'accent-foreground': h(20, 14, 12),
    },
    banner: 'linear-gradient(115deg, #f7f3ec 0%, #efe6d8 45%, #e3d5c0 100%)',
    radius: '12px', shadow: '0 2px 12px rgba(28,25,23,0.08)',
  },
  {
    id: 'terracotta', label: 'Terracotta',
    desc: 'Warm clay tones — earthy and confident.',
    tokens: {
      background: h(24, 45, 95), foreground: h(20, 25, 14),
      card: h(0, 0, 100), 'card-foreground': h(20, 25, 14),
      border: h(20, 15, 87), muted: h(24, 35, 91), 'muted-foreground': h(20, 10, 40),
      tertiary: h(20, 8, 52), secondary: h(24, 35, 91), 'secondary-foreground': h(20, 25, 14),
      primary: h(14, 68, 46), 'primary-foreground': h(0, 0, 100),
      ring: h(14, 68, 46), accent: h(24, 45, 90), 'accent-foreground': h(20, 25, 14),
    },
    banner: 'radial-gradient(130% 160% at 15% 10%, #c2410c 0%, transparent 55%), radial-gradient(120% 140% at 85% 90%, #7c2d12 0%, transparent 60%), #f5e8dd',
    radius: '16px', shadow: '0 8px 24px rgba(124,45,18,0.15)',
  },
  {
    id: 'forest', label: 'Forest',
    desc: 'Calm greens — grounded and outdoorsy.',
    tokens: {
      background: h(152, 25, 95), foreground: h(160, 25, 12),
      card: h(0, 0, 100), 'card-foreground': h(160, 25, 12),
      border: h(150, 15, 86), muted: h(152, 20, 91), 'muted-foreground': h(160, 10, 35),
      tertiary: h(160, 8, 48), secondary: h(152, 20, 91), 'secondary-foreground': h(160, 25, 12),
      primary: h(160, 84, 28), 'primary-foreground': h(0, 0, 100),
      ring: h(160, 84, 28), accent: h(152, 25, 90), 'accent-foreground': h(160, 25, 12),
    },
    banner: 'radial-gradient(120% 150% at 20% 0%, #14532d 0%, transparent 60%), radial-gradient(110% 130% at 80% 100%, #065f46 0%, transparent 55%), #ecfdf5',
    radius: '16px', shadow: '0 8px 24px rgba(6,78,59,0.15)',
  },
  {
    id: 'cobalt', label: 'Cobalt',
    desc: 'Classic academic blue — reads like a letterhead.',
    tokens: {
      background: h(225, 50, 96), foreground: h(228, 30, 12),
      card: h(0, 0, 100), 'card-foreground': h(228, 30, 12),
      border: h(225, 20, 86), muted: h(225, 35, 92), 'muted-foreground': h(225, 12, 38),
      tertiary: h(225, 10, 50), secondary: h(225, 35, 92), 'secondary-foreground': h(228, 30, 12),
      primary: h(225, 85, 45), 'primary-foreground': h(0, 0, 100),
      ring: h(225, 85, 45), accent: h(225, 45, 90), 'accent-foreground': h(228, 30, 12),
    },
    banner: 'linear-gradient(120deg, #1e3a8a 0%, #1d4ed8 50%, #0ea5e9 100%)',
    radius: '14px', shadow: '0 10px 30px rgba(30,58,138,0.18)',
  },
  {
    id: 'rose', label: 'Rose',
    desc: 'Soft blush background with a confident rose accent.',
    tokens: {
      background: h(340, 55, 96), foreground: h(335, 25, 14),
      card: h(0, 0, 100), 'card-foreground': h(335, 25, 14),
      border: h(340, 30, 89), muted: h(340, 45, 92), 'muted-foreground': h(340, 12, 40),
      tertiary: h(340, 8, 52), secondary: h(340, 45, 92), 'secondary-foreground': h(335, 25, 14),
      primary: h(340, 78, 44), 'primary-foreground': h(0, 0, 100),
      ring: h(340, 78, 44), accent: h(340, 55, 90), 'accent-foreground': h(335, 25, 14),
    },
    banner: 'radial-gradient(120% 150% at 20% 10%, #e11d48 0%, transparent 55%), radial-gradient(120% 140% at 85% 90%, #9f1239 0%, transparent 60%), #fff1f5',
    radius: '18px', shadow: '0 8px 26px rgba(159,18,57,0.14)',
  },
  {
    id: 'mono', label: 'Mono',
    desc: 'Pure grayscale — editorial, lets the work speak.',
    tokens: {
      background: h(0, 0, 96), foreground: h(0, 0, 10),
      card: h(0, 0, 100), 'card-foreground': h(0, 0, 10),
      border: h(0, 0, 85), muted: h(0, 0, 92), 'muted-foreground': h(0, 0, 35),
      tertiary: h(0, 0, 50), secondary: h(0, 0, 92), 'secondary-foreground': h(0, 0, 10),
      primary: h(0, 0, 10), 'primary-foreground': h(0, 0, 100),
      ring: h(0, 0, 10), accent: h(0, 0, 92), 'accent-foreground': h(0, 0, 10),
    },
    banner: 'linear-gradient(120deg, #171717 0%, #404040 60%, #525252 100%)',
    radius: '8px', shadow: '0 1px 3px rgba(0,0,0,0.12)',
  },
  {
    id: 'gradient', label: 'Gradient',
    desc: 'Soft light base with a vibrant mesh banner — playful but tidy.',
    tokens: {
      background: h(250, 45, 97), foreground: h(250, 25, 12),
      card: h(0, 0, 100), 'card-foreground': h(250, 25, 12),
      border: h(250, 25, 88), muted: h(250, 35, 93), 'muted-foreground': h(250, 12, 42),
      tertiary: h(250, 10, 52), secondary: h(250, 35, 93), 'secondary-foreground': h(250, 25, 12),
      primary: h(262, 80, 55), 'primary-foreground': h(0, 0, 100),
      ring: h(262, 80, 55), accent: h(262, 50, 92), 'accent-foreground': h(250, 25, 12),
    },
    banner: 'conic-gradient(from 200deg at 70% 30%, #7c3aed, #ec4899, #f59e0b, #10b981, #3b82f6, #7c3aed)',
    radius: '22px', shadow: '0 16px 40px rgba(124,58,237,0.18)',
  },
  {
    id: 'carbon', label: 'Carbon',
    desc: 'Technical dark grey — precise, portfolio-grade.',
    tokens: {
      background: h(0, 0, 7), foreground: h(0, 0, 92),
      card: h(0, 0, 11), 'card-foreground': h(0, 0, 92),
      border: h(0, 0, 24), muted: h(0, 0, 14), 'muted-foreground': h(0, 0, 58),
      tertiary: h(0, 0, 45), secondary: h(0, 0, 15), 'secondary-foreground': h(0, 0, 92),
      primary: h(0, 0, 85), 'primary-foreground': h(0, 0, 8),
      ring: h(0, 0, 85), accent: h(0, 0, 18), 'accent-foreground': h(0, 0, 92),
    },
    banner: 'linear-gradient(120deg, #0a0a0a 0%, #1c1c1c 55%, #262626 100%)',
    radius: '12px', shadow: '0 16px 44px rgba(0,0,0,0.6)',
  },
];

export const THEME_IDS = THEMES.map((t) => t.id);

// ── Fixed accent palette — 12 colours, no free picker ──────────────────────
export const ACCENT_PALETTE = [
  { hex: '#7c3aed', label: 'Violet' },
  { hex: '#4f46e5', label: 'Indigo' },
  { hex: '#2563eb', label: 'Cobalt' },
  { hex: '#0d9488', label: 'Teal' },
  { hex: '#059669', label: 'Emerald' },
  { hex: '#d97706', label: 'Amber' },
  { hex: '#ea580c', label: 'Orange' },
  { hex: '#dc2626', label: 'Red' },
  { hex: '#e11d48', label: 'Rose' },
  { hex: '#db2777', label: 'Pink' },
  { hex: '#334155', label: 'Slate' },
  { hex: '#171717', label: 'Ink' },
];

// ── 4 curated heading font pairings ────────────────────────────────────────
export const FONT_OPTIONS = [
  { id: 'sans', label: 'Modern', heading: "'Inter', system-ui, sans-serif", desc: 'Clean and neutral — the BlockWard default' },
  { id: 'serif', label: 'Editorial', heading: "'Fraunces', Georgia, serif", desc: 'A serif headline voice — reads like a feature article' },
  { id: 'mono', label: 'Technical', heading: "'JetBrains Mono', ui-monospace, monospace", desc: 'Monospaced — engineers and developers' },
  { id: 'display', label: 'Bold', heading: "'Sora', 'Inter', sans-serif", desc: 'Rounded geometric display type' },
];

// ── Layout variants ────────────────────────────────────────────────────────
export const LAYOUT_OPTIONS = [
  { id: 'grid', label: 'Grid', desc: 'Card grid — best for many achievements' },
  { id: 'list', label: 'List', desc: 'Compact rows — best for a long verified record' },
  { id: 'showcase', label: 'Showcase', desc: 'Large hero for pinned highlights — best for a few standout achievements' },
];

// ── Supported social platforms (link-in-bio mechanic) ──────────────────────
export const SOCIAL_PLATFORMS = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'github', label: 'GitHub' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'x', label: 'X' },
  { id: 'discord', label: 'Discord' },
  { id: 'behance', label: 'Behance' },
  { id: 'dribbble', label: 'Dribbble' },
  { id: 'strava', label: 'Strava' },
  { id: 'chesscom', label: 'Chess.com' },
  { id: 'website', label: 'Personal website' },
];

export const SOCIAL_PLATFORM_IDS = SOCIAL_PLATFORMS.map((p) => p.id);

// ── 12 built-in abstract banners — a student with no image still gets a ─────
// distinctive profile. Encoded as 'preset:<id>' in banner_url.
export const PRESET_BANNERS = [
  { id: 'aurora', label: 'Aurora', css: 'radial-gradient(120% 140% at 10% 15%, #7c3aed 0%, transparent 55%), radial-gradient(110% 130% at 90% 20%, #0ea5e9 0%, transparent 60%), radial-gradient(150% 160% at 50% 115%, #db2777 0%, transparent 55%), #0b0a10' },
  { id: 'dusk', label: 'Dusk', css: 'linear-gradient(160deg, #312e81 0%, #6d28d9 35%, #be185d 70%, #f59e0b 100%)' },
  { id: 'ember', label: 'Ember', css: 'radial-gradient(130% 150% at 15% 85%, #dc2626 0%, transparent 55%), radial-gradient(120% 140% at 80% 20%, #f59e0b 0%, transparent 55%), #1c0a0a' },
  { id: 'glacier', label: 'Glacier', css: 'linear-gradient(150deg, #e0f2fe 0%, #a5d8f3 40%, #38bdf8 75%, #0369a1 100%)' },
  { id: 'prism', label: 'Prism', css: 'conic-gradient(from 180deg at 30% 20%, #7c3aed, #ec4899, #f59e0b, #10b981, #0ea5e9, #7c3aed)' },
  { id: 'sandstone', label: 'Sandstone', css: 'radial-gradient(90% 120% at 80% 10%, rgba(255,255,255,0.35) 0%, transparent 55%), linear-gradient(135deg, #d8c7ae 0%, #b08d6d 55%, #7a5c44 100%)' },
  { id: 'tide', label: 'Tide', css: 'radial-gradient(120% 140% at 85% 15%, #14b8a6 0%, transparent 60%), radial-gradient(130% 150% at 15% 85%, #0f766e 0%, transparent 55%), #042f2e' },
  { id: 'orchid', label: 'Orchid', css: 'radial-gradient(120% 150% at 20% 20%, #a855f7 0%, transparent 55%), radial-gradient(110% 130% at 85% 80%, #f472b6 0%, transparent 55%), #2e1065' },
  { id: 'voltage', label: 'Voltage', css: 'radial-gradient(100% 130% at 50% 0%, #facc15 0%, transparent 40%), linear-gradient(160deg, #18181b 30%, #3f3f46 100%)' },
  { id: 'botanical', label: 'Botanical', css: 'radial-gradient(120% 140% at 15% 20%, #15803d 0%, transparent 55%), radial-gradient(120% 150% at 85% 85%, #4d7c0f 0%, transparent 55%), #052e16' },
  { id: 'nebula', label: 'Nebula', css: 'radial-gradient(110% 130% at 25% 30%, #6366f1 0%, transparent 55%), radial-gradient(110% 130% at 75% 70%, #a21caf 0%, transparent 55%), #0b0a1e' },
  { id: 'blueprint', label: 'Blueprint', css: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.06) 0 1px, transparent 1px 40px), repeating-linear-gradient(90deg, rgba(255,255,255,0.06) 0 1px, transparent 1px 40px), linear-gradient(135deg, #1e3a8a, #1d4ed8)' },
];

// ── Helpers ────────────────────────────────────────────────────────────────

// Hex → HSL channel triplet ('h s% l%') for the token system.
export function hexToHslChannels(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let hue = 0, sat = 0;
  const lig = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    sat = lig > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) hue = ((b - r) / d + 2) * 60;
    else hue = ((r - g) / d + 4) * 60;
  }
  return `${Math.round(hue)} ${Math.round(sat * 100)}% ${Math.round(lig * 100)}%`;
}

// Inline CSS custom properties for the profile page wrapper. Overriding the
// app's token channels themes every token-based class inside the wrapper.
export function themeVars(themeId, accentHex, fontId) {
  const theme = THEMES.find((t) => t.id === themeId) || THEMES[0];
  const vars = {};
  if (theme.tokens) {
    for (const [k, v] of Object.entries(theme.tokens)) vars[`--${k}`] = v;
  }
  if (accentHex && /^#[0-9a-f]{6}$/i.test(accentHex)) {
    const c = hexToHslChannels(accentHex);
    if (c) { vars['--primary'] = c; vars['--ring'] = c; }
  }
  const font = FONT_OPTIONS.find((f) => f.id === fontId) || FONT_OPTIONS[0];
  vars['--font-heading'] = font.heading;
  vars['--pf-radius'] = theme.radius;
  vars['--pf-shadow'] = theme.shadow;
  vars['--pf-banner'] = theme.banner;
  return vars;
}

// Style object for the banner strip: uploaded image, built-in preset, or the
// theme's own fallback treatment so every profile has a cover.
export function bannerStyle(bannerUrl, themeId) {
  if (bannerUrl && bannerUrl.startsWith('preset:')) {
    const p = PRESET_BANNERS.find((b) => b.id === bannerUrl.slice(7));
    if (p) return { background: p.css };
  }
  if (bannerUrl && /^https?:\/\//.test(bannerUrl)) {
    return { backgroundImage: `url(${bannerUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' };
  }
  const theme = THEMES.find((t) => t.id === themeId) || THEMES[0];
  return { background: theme.banner };
}