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
  { id: 'spotify', label: 'Spotify' },
  { id: 'twitch', label: 'Twitch' },
  { id: 'substack', label: 'Substack' },
  { id: 'medium', label: 'Medium' },
  { id: 'bluesky', label: 'Bluesky' },
  { id: 'threads', label: 'Threads' },
  { id: 'whatsapp', label: 'WhatsApp Channel' },
  { id: 'duolingo', label: 'Duolingo' },
  { id: 'codeforces', label: 'Codeforces' },
  { id: 'kaggle', label: 'Kaggle' },
  { id: 'goodreads', label: 'Goodreads' },
  { id: 'letterboxd', label: 'Letterboxd' },
  { id: 'website', label: 'Website' },
];

// ── Extended public-profile customisation (bounded presets, never raw CSS) ─
export const AVATAR_FRAMES = [
  { id: 'none', label: 'None', desc: 'Clean circle' },
  { id: 'accent-ring', label: 'Accent ring', desc: 'Ring in your accent colour' },
  { id: 'gradient-ring', label: 'Gradient ring', desc: 'Two-stop accent gradient' },
  { id: 'squircle', label: 'Squircle', desc: 'Soft rounded square' },
  { id: 'square', label: 'Square', desc: 'Editorial corners' },
];

export const CARD_STYLES = [
  { id: 'elevated', label: 'Elevated', desc: 'Soft shadow under cards' },
  { id: 'flat', label: 'Flat', desc: 'Shadow-free and calm' },
  { id: 'outlined', label: 'Outlined', desc: 'Transparent with strong borders' },
];

export const CORNER_STYLES = [
  { id: 'sharp', label: 'Sharp', desc: 'Technical, precise', radius: '4px', btn: '4px' },
  { id: 'rounded', label: 'Rounded', desc: 'The BlockWard default', radius: '14px', btn: '10px' },
  { id: 'pill', label: 'Pill', desc: 'Very soft, friendly', radius: '24px', btn: '999px' },
];

export const SURFACE_PATTERNS = [
  { id: 'none', label: 'None', desc: 'Clean surface' },
  { id: 'grain', label: 'Grain', desc: 'Fine paper grain' },
  { id: 'dots', label: 'Dots', desc: 'Even dot lattice' },
  { id: 'grid', label: 'Grid', desc: 'Graph-paper lines' },
  { id: 'topo', label: 'Topo', desc: 'Contour rings' },
  { id: 'mesh', label: 'Mesh', desc: 'Soft accent washes' },
];

export const HERO_STYLES = [
  { id: 'banner', label: 'Banner', desc: 'Classic cover, overlapping card' },
  { id: 'split', label: 'Split', desc: 'Identity beside the cover' },
  { id: 'minimal', label: 'Minimal', desc: 'No cover — quiet and editorial' },
  { id: 'fullbleed', label: 'Full-bleed', desc: 'Tall edge-to-edge cover' },
];

export const CARD_DENSITY = [
  { id: 'comfortable', label: 'Comfortable', desc: 'Roomy spacing' },
  { id: 'compact', label: 'Compact', desc: 'Tighter gaps, more per screen' },
];

export const HIGHLIGHT_STYLES = [
  { id: 'carousel', label: 'Carousel', desc: 'Scrollable hero cards' },
  { id: 'grid', label: 'Grid', desc: 'Even card grid' },
  { id: 'spotlight', label: 'Spotlight', desc: 'One large feature card' },
];

export const FORCED_SCHEMES = [
  { id: 'auto', label: 'Auto', desc: "Follows the viewer's setting" },
  { id: 'light', label: 'Always light' },
  { id: 'dark', label: 'Always dark' },
];

export const OPEN_TO_OPTIONS = [
  { id: 'internships', label: 'Internships' },
  { id: 'team_trials', label: 'Team trials' },
  { id: 'collaborations', label: 'Collaborations' },
  { id: 'tutoring', label: 'Tutoring' },
  { id: 'work_experience', label: 'Work experience' },
];

export const LANGUAGE_OPTIONS = [
  'Arabic', 'Bengali', 'Chinese (Mandarin)', 'Dutch', 'English', 'French', 'German',
  'Hindi', 'Italian', 'Japanese', 'Korean', 'Malay', 'Persian', 'Polish', 'Portuguese',
  'Punjabi', 'Russian', 'Spanish', 'Swahili', 'Tagalog', 'Tamil', 'Turkish', 'Urdu', 'Vietnamese',
];

// Icon presets for custom links — 'auto' renders the destination's favicon.
export const CUSTOM_LINK_ICONS = [
  { id: 'auto', label: 'Auto (favicon)' },
  { id: 'globe', label: 'Website' },
  { id: 'file', label: 'Document' },
  { id: 'code', label: 'Code' },
  { id: 'video', label: 'Video' },
  { id: 'music', label: 'Music' },
  { id: 'book', label: 'Writing' },
  { id: 'cart', label: 'Store' },
  { id: 'pen', label: 'Art' },
  { id: 'briefcase', label: 'Work' },
];

// Page sections the student can reorder or hide individually.
export const PROFILE_SECTIONS = [
  { id: 'highlights', label: 'Highlights', desc: 'Your pinned achievements' },
  { id: 'achievements', label: 'Achievements', desc: 'The verified record' },
  { id: 'endorsements', label: 'Endorsements', desc: 'What peers say' },
  { id: 'timeline', label: 'Timeline', desc: 'Everything in order' },
  { id: 'organisations', label: 'Organisations', desc: 'Your schools and clubs' },
];
export const DEFAULT_SECTION_ORDER = PROFILE_SECTIONS.map((s) => s.id);

// The default state of every customisation field — the single source of
// truth for the editor's "Reset to default" and for read-side fallbacks.
export const DEFAULT_PROFILE_CUSTOM = {
  banner_url: null,
  theme_id: 'slate',
  accent_colour: null,
  accent_gradient: null,
  profile_layout: 'grid',
  display_font: 'sans',
  social_links: [],
  featured_link: null,
  avatar_frame: 'none',
  card_style: 'elevated',
  corner_style: 'rounded',
  surface_pattern: 'none',
  hero_style: 'banner',
  card_density: 'comfortable',
  highlight_style: 'carousel',
  forced_scheme: 'auto',
  tagline: null,
  pronouns: null,
  languages: [],
  open_to: [],
  custom_links: [],
  section_order: DEFAULT_SECTION_ORDER,
  section_visibility: { highlights: true, achievements: true, endorsements: true, timeline: true, organisations: true },
};

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

// Perceptual (sRGB-weighted) luminance of a hex colour.
function srgbLum(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim());
  if (!m) return 255;
  const n = parseInt(m[1], 16);
  return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
}

// WCAG-safe text colour for a two-stop accent gradient, judged against the
// LIGHTER stop so the worst point on the gradient always passes AA. Light
// palette stops (amber, emerald, orange) get dark ink; dark stops get white.
export function gradientForeground(stops) {
  return Math.max(...stops.map(srgbLum)) < 110 ? '#FFFFFF' : '#17121F';
}

export function findCorner(id) {
  return CORNER_STYLES.find((c) => c.id === id) || CORNER_STYLES[1];
}

// Full token bundle for the public profile page — themeVars (theme + accent
// + font) extended with the newer presets. Separate from themeVars so
// existing callers stay untouched.
export function publicProfileVars(custom = {}) {
  const vars = themeVars(custom.theme_id, custom.accent_colour, custom.display_font);
  const corner = findCorner(custom.corner_style);
  vars['--pf-radius'] = corner.radius;
  vars['--pf-btn-radius'] = corner.btn;
  if (custom.accent_colour && custom.accent_gradient) {
    const stops = [custom.accent_colour, custom.accent_gradient];
    vars['--pf-accent-grad'] = `linear-gradient(135deg, ${stops.join(', ')})`;
    vars['--pf-accent-grad-fg'] = gradientForeground(stops);
  }
  return vars;
}

// A coherent random combination — designed pairs, never noise. Visual
// fields only; content and links are left exactly as they are.
export function randomProfileCustom() {
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const a1 = pick(ACCENTS);
  const a2 = pick(ACCENTS.filter((a) => a.hex !== a1.hex));
  const withGradient = Math.random() < 0.5;
  return {
    theme_id: pick(THEMES).id,
    accent_colour: a1.hex,
    accent_gradient: withGradient ? a2.hex : null,
    display_font: pick(FONTS).id,
    banner_url: Math.random() < 0.6 ? `preset:${pick(PRESET_BANNERS).id}` : null,
    profile_layout: pick(LAYOUTS).id,
    avatar_frame: pick(AVATAR_FRAMES).id,
    card_style: pick(CARD_STYLES).id,
    corner_style: pick(CORNER_STYLES).id,
    surface_pattern: Math.random() < 0.5 ? 'none' : pick(SURFACE_PATTERNS.filter((p) => p.id !== 'none')).id,
    hero_style: pick(HERO_STYLES).id,
    card_density: pick(CARD_DENSITY).id,
    highlight_style: pick(HIGHLIGHT_STYLES).id,
    forced_scheme: Math.random() < 0.7 ? 'auto' : pick(['light', 'dark']),
  };
}