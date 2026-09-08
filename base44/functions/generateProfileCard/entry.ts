/**
 * generateProfileCard — server-rendered PNG share cards (satori + resvg-wasm).
 *
 * Variants:
 *   og           1200x630   link preview (og:image / Twitter / LinkedIn)
 *   story        1080x1920  Instagram & TikTok story — downloadable
 *   square       1080x1080  feed post — downloadable
 *   achievement  1080x1080  one credential: issuing org, date, signer chain,
 *                           verify QR — offered right after verification
 *
 * Request: { variant, handle } for profile cards; { variant: 'achievement',
 * verification_id } for the per-credential card. Public (reads public data
 * only); results are written with the service role.
 *
 * Caching: each variant's content hash is stored on the profile (card_hashes)
 * or registry (share_card_hash). Any change to name, avatar, bio, theme,
 * pinned items or achievement count changes the hash, so the next request
 * re-renders; unchanged content returns the stored URL with zero render work.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import QRCode from 'npm:qrcode@1.5.4';

// ── Module-level singletons (fonts / wasm) — survive warm invocations ─────────
let fontsCache = null;
let resvgPromise = null;

async function ensureResvg() {
  if (!resvgPromise) {
    resvgPromise = (async () => {
      // The node build of resvg-wasm auto-initialises its embedded wasm on
      // import; browser builds export initWasm. Call it defensively and ignore
      // an "already initialised" throw.
      const mod = await import('npm:@resvg/resvg-wasm@2.0.0');
      if (typeof mod.initWasm === 'function') {
        try { await mod.initWasm(); } catch (_) { /* already initialised */ }
      }
      return mod;
    })();
  }
  return resvgPromise;
}

async function ensureSatori() {
  const mod = await import('npm:satori@0.10.14');
  return mod.default || mod;
}

// Inter TTFs from Google Fonts — css2 serves truetype URLs to legacy user
// agents, and satori cannot read woff2.
async function ensureFonts() {
  if (fontsCache) return fontsCache;
  const res = await fetch('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; rv:8.0) Gecko/20100101 Firefox/8.0' },
  });
  const css = await res.text();
  const fonts = [];
  for (const blockMatch of css.matchAll(/@font-face\s*{([^}]*)}/g)) {
    const block = blockMatch[1];
    const urlMatch = block.match(/url\((https:[^)]+)\)/);
    const weightMatch = block.match(/font-weight:\s*(\d+)/);
    if (!urlMatch) continue;
    const data = await (await fetch(urlMatch[1])).arrayBuffer();
    fonts.push({ name: 'Inter', data, weight: parseInt(weightMatch?.[1] || '400', 10), style: 'normal' });
  }
  if (!fonts.length) throw new Error('No fonts could be loaded for card rendering');
  fontsCache = fonts;
  return fonts;
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function toB64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

async function toDataUri(url) {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const type = (res.headers.get('content-type') || 'image/png').split(';')[0];
    return `data:${type};base64,${toB64(buf)}`;
  } catch (_) { return null; }
}

function hashOf(parts) {
  const s = JSON.stringify(parts);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

function fmtDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

const E = (style, ...children) => ({
  type: 'div',
  props: { style: { display: 'flex', ...style }, children: children.length === 1 ? children[0] : children },
});
const Img = (src, style) => ({ type: 'img', props: { src, style } });

// Profile theme palette — matches the named public-profile themes. Every
// preset stays legible and credible for adult reviewers.
const THEMES = {
  slate:      { bg: ['#131024', '#0B0A10', '#1A0F2E'], accent: '#7C3AED', accentText: '#A78BFA', light: false },
  midnight:   { bg: ['#0A1128', '#060B18', '#101B3C'], accent: '#4F46E5', accentText: '#818CF8', light: false },
  paper:      { bg: ['#FAF7F2', '#F3EEE6', '#FFFFFF'], accent: '#243B86', accentText: '#243B86', light: true },
  terracotta: { bg: ['#FBF2ED', '#F6E7DE', '#FFFFFF'], accent: '#C2552C', accentText: '#C2552C', light: true },
  forest:     { bg: ['#F1F7F2', '#E8F1E9', '#FFFFFF'], accent: '#1F7A4D', accentText: '#1F7A4D', light: true },
  cobalt:     { bg: ['#F0F4FC', '#E4ECFA', '#FFFFFF'], accent: '#2563EB', accentText: '#2563EB', light: true },
  rose:       { bg: ['#FCF1F4', '#F9E4EA', '#FFFFFF'], accent: '#D6336C', accentText: '#D6336C', light: true },
  mono:       { bg: ['#F5F5F5', '#ECECEC', '#FFFFFF'], accent: '#171717', accentText: '#171717', light: true },
  gradient:   { bg: ['#1B1240', '#0D0A1F', '#3A1D6E'], accent: '#8B5CF6', accentText: '#C4B5FD', light: false },
  carbon:     { bg: ['#121212', '#0A0A0A', '#1C1C1C'], accent: '#D4D4D4', accentText: '#E5E5E5', light: false },
};

function paletteFor(profile) {
  const t = THEMES[profile?.theme_id] || THEMES.slate;
  const accent = /^#[0-9a-fA-F]{6}$/.test(profile?.accent_colour || '') ? profile.accent_colour : t.accent;
  return {
    bg: t.bg,
    accent,
    accentText: t.accentText,
    text: t.light ? '#14121A' : '#F7F5FA',
    muted: t.light ? 'rgba(20,18,26,0.62)' : 'rgba(247,245,250,0.65)',
    faint: t.light ? 'rgba(20,18,26,0.38)' : 'rgba(247,245,250,0.40)',
    rowFill: t.light ? 'rgba(20,18,26,0.04)' : 'rgba(255,255,255,0.05)',
    rowBorder: t.light ? 'rgba(20,18,26,0.12)' : 'rgba(255,255,255,0.12)',
    light: t.light,
  };
}

function initialsAvatar(name, size, fontSize) {
  const initials = (name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return E({
    width: size, height: size, borderRadius: Math.round(size * 0.28),
    backgroundImage: 'linear-gradient(135deg, #8B5CF6, #EC4899)',
    alignItems: 'center', justifyContent: 'center',
    fontSize, fontWeight: 800, color: '#FFFFFF', flexShrink: 0,
  }, initials);
}

function orgLogoEl(dataUri, name, size) {
  if (dataUri) {
    return Img(dataUri, { width: size, height: size, borderRadius: size, objectFit: 'cover', flexShrink: 0 });
  }
  return initialsAvatar(name || '?', size, Math.round(size * 0.42));
}

function countPill(p, count, fontSize, pad) {
  return E({
    padding: `${Math.round(pad * 0.6)}px ${pad}px`, borderRadius: 999,
    border: `2px solid ${p.accent}55`, backgroundColor: `${p.accent}1F`,
    fontSize, fontWeight: 700, color: p.accentText,
  }, `${count} verified achievement${count === 1 ? '' : 's'}`);
}

function bgStyle(p) {
  return { backgroundImage: `linear-gradient(160deg, ${p.bg[0]} 0%, ${p.bg[1]} 55%, ${p.bg[2]} 100%)` };
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ── Card layouts ────────────────────────────────────────────────────────────
function buildOgCard(d) {
  const p = d.palette;
  return E({ width: 1200, height: 630, ...bgStyle(p), padding: 56, flexDirection: 'column', boxSizing: 'border-box', overflow: 'hidden', position: 'relative', fontFamily: 'Inter' },
    E({ flexDirection: 'row', alignItems: 'center', gap: 36 },
      d.avatarUri ? Img(d.avatarUri, { width: 150, height: 150, borderRadius: 42, objectFit: 'cover', border: `4px solid ${p.accent}55` })
                  : initialsAvatar(d.name, 150, 52),
      E({ flexDirection: 'column', gap: 6, minWidth: 0 },
        E({ fontSize: 56, fontWeight: 800, color: p.text, letterSpacing: '-1px' }, d.name),
        E({ fontSize: 27, fontWeight: 600, color: p.accentText }, `@${d.handle}`),
        d.bio ? E({ fontSize: 23, color: p.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 620 }, d.bio) : null,
        E({ marginTop: 14 }, countPill(p, d.count, 22, 26)),
      ),
    ),
    E({ marginTop: 40, marginBottom: 14, fontSize: 18, fontWeight: 700, letterSpacing: 3, color: p.faint }, 'TOP ACHIEVEMENTS'),
    E({ flexDirection: 'column', gap: 12 },
      d.top3.map((a) =>
        E({ flexDirection: 'row', alignItems: 'center', gap: 18, padding: '18px 24px', borderRadius: 22, backgroundColor: p.rowFill, border: `1px solid ${p.rowBorder}` },
          orgLogoEl(a.logoUri, a.orgName, 46),
          E({ flexDirection: 'column', gap: 3, minWidth: 0 },
            E({ fontSize: 25, fontWeight: 700, color: p.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 780 }, a.title),
            E({ fontSize: 19, color: p.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 780 }, a.orgName),
          ),
        ),
      ),
    ),
    E({ position: 'absolute', bottom: 36, left: 56, right: 56, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
      E({ fontSize: 21, color: p.faint }, `blockward.app/@${d.handle}`),
      E({ fontSize: 21, fontWeight: 700, color: p.accentText }, 'Verified by BlockWard'),
    ),
  );
}

function buildSquareCard(d) {
  const p = d.palette;
  return E({ width: 1080, height: 1080, ...bgStyle(p), alignItems: 'center', justifyContent: 'center', padding: 90, boxSizing: 'border-box', overflow: 'hidden', position: 'relative', fontFamily: 'Inter' },
    E({ position: 'absolute', top: -140, left: 360, width: 900, height: 520, backgroundImage: `radial-gradient(ellipse, ${hexToRgba(p.accent, 0.22)}, transparent 70%)` }),
    E({ position: 'absolute', bottom: -120, right: -80, width: 620, height: 520, backgroundImage: `radial-gradient(ellipse, ${hexToRgba(p.accent, 0.12)}, transparent 70%)` }),
    E({ flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
      d.avatarUri ? Img(d.avatarUri, { width: 210, height: 210, borderRadius: 58, objectFit: 'cover', border: `4px solid ${p.accent}55` })
                  : initialsAvatar(d.name, 210, 74),
      E({ fontSize: 64, fontWeight: 800, color: p.text, marginTop: 44, letterSpacing: '-1px', textAlign: 'center' }, d.name),
      E({ fontSize: 33, fontWeight: 600, color: p.accentText, marginTop: 8 }, `@${d.handle}`),
      d.bio ? E({ fontSize: 29, color: p.muted, marginTop: 26, maxWidth: 760, textAlign: 'center', lineHeight: 1.45 }, d.bio) : null,
      E({ marginTop: 40 }, countPill(p, d.count, 30, 40)),
    ),
    E({ position: 'absolute', bottom: 52, left: 0, right: 0, justifyContent: 'center', fontSize: 24, color: p.faint },
      `blockward.app/@${d.handle} · Verified by BlockWard`),
  );
}

function buildStoryCard(d) {
  const p = d.palette;
  return E({ width: 1080, height: 1920, ...bgStyle(p), flexDirection: 'column', alignItems: 'center', padding: '120px 90px', boxSizing: 'border-box', overflow: 'hidden', position: 'relative', fontFamily: 'Inter' },
    E({ position: 'absolute', top: -200, left: 40, width: 1000, height: 600, backgroundImage: `radial-gradient(ellipse, ${hexToRgba(p.accent, 0.20)}, transparent 70%)` }),
    E({ flexDirection: 'column', alignItems: 'center' },
      d.avatarUri ? Img(d.avatarUri, { width: 300, height: 300, borderRadius: 84, objectFit: 'cover', border: `5px solid ${p.accent}55` })
                  : initialsAvatar(d.name, 300, 104),
      E({ fontSize: 84, fontWeight: 800, color: p.text, marginTop: 52, letterSpacing: '-2px', textAlign: 'center' }, d.name),
      E({ fontSize: 40, fontWeight: 600, color: p.accentText, marginTop: 12 }, `@${d.handle}`),
      d.bio ? E({ fontSize: 32, color: p.muted, marginTop: 30, maxWidth: 820, textAlign: 'center', lineHeight: 1.5 }, d.bio) : null,
      E({ marginTop: 48 }, countPill(p, d.count, 34, 44)),
    ),
    E({ flexDirection: 'column', width: '100%', marginTop: 72 },
      E({ fontSize: 22, fontWeight: 700, letterSpacing: 3, color: p.faint, marginBottom: 20 }, 'TOP ACHIEVEMENTS'),
      d.top3.map((a) =>
        E({ flexDirection: 'row', alignItems: 'center', gap: 24, padding: '28px 34px', borderRadius: 28, backgroundColor: p.rowFill, border: `1px solid ${p.rowBorder}`, marginBottom: 20 },
          orgLogoEl(a.logoUri, a.orgName, 60),
          E({ flexDirection: 'column', gap: 5, minWidth: 0 },
            E({ fontSize: 32, fontWeight: 700, color: p.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 640 }, a.title),
            E({ fontSize: 24, color: p.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 640 }, a.orgName),
          ),
        ),
      ),
    ),
    E({ position: 'absolute', bottom: 72, left: 0, right: 0, flexDirection: 'column', alignItems: 'center', gap: 8 },
      E({ fontSize: 26, color: p.faint }, `blockward.app/@${d.handle}`),
      E({ fontSize: 26, fontWeight: 700, color: p.accentText }, 'Verified by BlockWard'),
    ),
  );
}

function buildAchievementCard(d) {
  const p = d.palette;
  return E({ width: 1080, height: 1080, ...bgStyle(p), flexDirection: 'column', padding: 72, boxSizing: 'border-box', overflow: 'hidden', position: 'relative', fontFamily: 'Inter' },
    E({ position: 'absolute', top: -140, right: -120, width: 640, height: 560, backgroundImage: `radial-gradient(ellipse, ${hexToRgba(p.accent, 0.18)}, transparent 70%)` }),
    E({ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
      E({ flexDirection: 'row', alignItems: 'center', gap: 20 },
        d.avatarUri ? Img(d.avatarUri, { width: 84, height: 84, borderRadius: 24, objectFit: 'cover' }) : initialsAvatar(d.name, 84, 30),
        E({ flexDirection: 'column', gap: 2 },
          E({ fontSize: 28, fontWeight: 700, color: p.text }, d.name),
          E({ fontSize: 22, fontWeight: 600, color: p.accentText }, `@${d.handle}`),
        ),
      ),
      E({ flexDirection: 'row', alignItems: 'center', gap: 16 },
        d.orgLogoUri ? Img(d.orgLogoUri, { width: 60, height: 60, borderRadius: 60, objectFit: 'cover' }) : null,
        E({ flexDirection: 'column', alignItems: 'flex-end', gap: 2 },
          E({ fontSize: 22, color: p.faint }, 'Issued by'),
          E({ fontSize: 26, fontWeight: 700, color: p.text }, d.orgName),
        ),
      ),
    ),
    E({ flexDirection: 'column', justifyContent: 'center', flex: 1 },
      E({ fontSize: 20, fontWeight: 700, letterSpacing: 3, color: p.accentText }, 'VERIFIED ACHIEVEMENT'),
      E({ fontSize: 60, fontWeight: 800, color: p.text, marginTop: 16, lineHeight: 1.15, maxWidth: 900 }, d.title),
      d.date ? E({ fontSize: 26, color: p.muted, marginTop: 22 }, `Achieved ${d.date}`) : null,
      (d.signers || []).length > 0
        ? E({ flexDirection: 'column', gap: 10, marginTop: 32 },
            d.signers.map((s) => E({ fontSize: 24, color: p.muted }, s)),
          )
        : null,
    ),
    E({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 36, padding: 28, borderRadius: 28, backgroundColor: p.rowFill, border: `1px solid ${p.rowBorder}` },
      Img(d.qrUri, { width: 260, height: 260, borderRadius: 20 }),
      E({ flexDirection: 'column', gap: 8 },
        E({ fontSize: 28, fontWeight: 700, color: p.text }, 'Scan to verify'),
        E({ fontSize: 23, fontWeight: 600, color: p.accentText }, d.verificationId),
        E({ fontSize: 21, color: p.muted }, d.verifyUrl),
      ),
    ),
    E({ marginTop: 36, justifyContent: 'center' },
      E({ fontSize: 22, fontWeight: 700, color: p.accentText }, 'Verified by BlockWard'),
    ),
  );
}

// ── Data assembly ───────────────────────────────────────────────────────────
async function profileCardData(svc, handle) {
  const rows = await svc.entities.UserProfile.filter({ handle });
  const profile = rows.find((r) => r.user_type === 'student' && r.status !== 'inactive' && r.status !== 'suspended');
  if (!profile || !profile.handle) return null;
  if (profile.profile_visibility === 'private') return { private: true };

  let registry = [];
  try { registry = await svc.entities.BlockWardVerificationRegistry.filter({ student_id: profile.id }); } catch (_) {}
  const visible = registry.filter((r) =>
    r.approval_status === 'approved' &&
    r.visibility !== 'private' &&
    (r.visibility ? true : r.is_public !== false),
  );

  const pinnedIds = (profile.pinned_achievement_ids || []).filter((id) => visible.some((r) => r.id === id)).slice(0, 3);
  const byDate = (a, b) =>
    new Date(b.date_delivered || b.date_approved || b.date_achieved || 0) - new Date(a.date_delivered || a.date_approved || a.date_achieved || 0);
  const chosen = pinnedIds.length > 0
    ? pinnedIds.map((id) => visible.find((r) => r.id === id))
    : [...visible].sort(byDate).slice(0, 3);

  const orgIds = [...new Set(chosen.map((r) => r.school_id).filter(Boolean))];
  const logos = {};
  for (const oid of orgIds) {
    try { const s = await svc.entities.School.filter({ id: oid }); if (s[0]?.logo_url) logos[oid] = s[0].logo_url; } catch (_) {}
  }

  const avatarUri = await toDataUri(profile.avatar_url);
  const top3 = [];
  for (const r of chosen) {
    top3.push({
      title: r.achievement_title,
      orgName: r.organisation_name || 'Organisation',
      logoUri: logos[r.school_id] ? await toDataUri(logos[r.school_id]) : null,
    });
  }

  return {
    private: false,
    profile,
    name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Student',
    handle: profile.handle,
    bio: profile.bio || null,
    count: visible.length,
    avatarUri,
    top3,
    palette: paletteFor(profile),
    hash: hashOf([
      profile.first_name, profile.last_name, profile.handle, profile.avatar_url,
      profile.bio, profile.theme_id, profile.accent_colour,
      pinnedIds.length > 0 ? pinnedIds : chosen.map((r) => r.id), visible.length,
    ]),
  };
}

async function achievementCardData(svc, verificationId) {
  const rows = await svc.entities.BlockWardVerificationRegistry.filter({ verification_id: verificationId });
  const r = rows[0];
  if (!r || r.approval_status !== 'approved' || r.visibility === 'private') return null;

  let profile = null;
  try { const ps = await svc.entities.UserProfile.filter({ id: r.student_id }); profile = ps[0] || null; } catch (_) {}
  let orgLogoUri = null;
  if (r.school_id) {
    try { const s = await svc.entities.School.filter({ id: r.school_id }); if (s[0]?.logo_url) orgLogoUri = await toDataUri(s[0].logo_url); } catch (_) {}
  }

  const signers = [];
  for (const s of r.signer_chain || []) {
    const when = fmtDate(s.timestamp);
    signers.push([s.name || 'Signer', s.role || 'verifier', when].filter(Boolean).join(' · '));
  }
  if (signers.length === 0) {
    if (r.teacher_name) signers.push(`${r.teacher_name} · Nominated verifier`);
    if (r.admin_name) signers.push(`${r.admin_name} · Organisation admin`);
  }

  const avatarUri = await toDataUri(profile?.avatar_url || null);
  const name = profile
    ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || r.student_name || 'Student'
    : (r.student_name || 'Student');
  const handle = profile?.handle || (name || 'student').toLowerCase().replace(/[^a-z0-9]+/g, '');

  return {
    name,
    handle,
    avatarUri,
    orgName: r.organisation_name || 'Organisation',
    orgLogoUri,
    title: r.achievement_title,
    date: fmtDate(r.date_achieved || r.date_approved || r.date_delivered),
    signers,
    verificationId: r.verification_id,
    verifyUrl: (r.public_verification_url || `https://blockward.base44.app/verify/${r.verification_id}`).replace(/^https?:\/\//, ''),
    palette: paletteFor(profile),
    hash: hashOf([r.achievement_title, r.organisation_name, orgLogoUri, r.date_achieved, r.signer_chain, r.verification_id, name, profile?.theme_id, profile?.accent_colour]),
  };
}

// ── Render + cache ──────────────────────────────────────────────────────────
async function renderPng(element, width, height) {
  const [satori, resvgMod, fonts] = await Promise.all([ensureSatori(), ensureResvg(), ensureFonts()]);
  const svg = await satori(element, { width, height, fonts });
  const { Resvg } = resvgMod;
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng();
  return new Uint8Array(png);
}

export default async function (req: Request): Promise<Response> {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const variant = body.variant || 'og';

    // ── Achievement card ──
    if (variant === 'achievement') {
      if (!body.verification_id) return Response.json({ error: 'Missing verification_id' }, { status: 400 });
      const d = await achievementCardData(svc, body.verification_id);
      if (!d) return Response.json({ error: 'Achievement not found' }, { status: 404 });

      const rows = await svc.entities.BlockWardVerificationRegistry.filter({ verification_id: body.verification_id });
      const r = rows[0];
      if (!body.force && r.share_card_url && r.share_card_hash === d.hash) {
        return Response.json({ ok: true, url: r.share_card_url, cached: true });
      }
      d.qrUri = await QRCode.toDataURL(`https://blockward.base44.app/verify/${d.verificationId}`, { width: 480, margin: 1 });
      const png = await renderPng(buildAchievementCard(d), 1080, 1080);
      const up = await svc.integrations.Core.UploadFile({
        file: new File([png], `card-${d.verificationId}.png`, { type: 'image/png' }),
      });
      const url = up?.file_url || up?.url;
      if (!url) return Response.json({ error: 'Failed to store the card' }, { status: 500 });
      await svc.entities.BlockWardVerificationRegistry.update(r.id, { share_card_url: url, share_card_hash: d.hash });
      return Response.json({ ok: true, url, cached: false });
    }

    // ── Profile cards ──
    if (!['og', 'story', 'square'].includes(variant)) {
      return Response.json({ error: 'Unknown variant' }, { status: 400 });
    }
    const d = await profileCardData(svc, String(body.handle || '').trim().toLowerCase());
    if (!d) return Response.json({ error: 'Profile not found' }, { status: 404 });
    if (d.private) return Response.json({ error: 'This profile is private' }, { status: 403 });

    const cachedUrl = { og: d.profile.og_image_url, story: d.profile.story_card_url, square: d.profile.feed_card_url }[variant];
    const storedHash = (d.profile.card_hashes || {})[variant];
    if (!body.force && cachedUrl && storedHash === d.hash) {
      return Response.json({ ok: true, url: cachedUrl, cached: true });
    }

    const element = { og: buildOgCard, story: buildStoryCard, square: buildSquareCard }[variant](d);
    const size = { og: [1200, 630], story: [1080, 1920], square: [1080, 1080] }[variant];
    const png = await renderPng(element, size[0], size[1]);
    const up = await svc.integrations.Core.UploadFile({
      file: new File([png], `card-${d.handle}-${variant}.png`, { type: 'image/png' }),
    });
    const url = up?.file_url || up?.url;
    if (!url) return Response.json({ error: 'Failed to store the card' }, { status: 500 });

    const cardHashes = { ...(d.profile.card_hashes || {}), [variant]: d.hash };
    const fields = { card_hashes: cardHashes };
    if (variant === 'og') fields.og_image_url = url;
    if (variant === 'story') fields.story_card_url = url;
    if (variant === 'square') fields.feed_card_url = url;
    await svc.entities.UserProfile.update(d.profile.id, fields);

    return Response.json({ ok: true, url, cached: false });
  } catch (error) {
    console.error('generateProfileCard error:', error?.stack || error);
    return Response.json({ error: error?.message || 'Card generation failed' }, { status: 500 });
  }
}