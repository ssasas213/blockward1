import React from 'react';

/**
 * ShareCardPreview — renders the four Blockward Network share-card templates
 * at their real pixel sizes. Purely presentational (inline styles for
 * pixel-exact rendering at 1200/1080px widths) so the same node can be
 * captured with html2canvas for PNG download.
 *
 * Privacy: `data.showName` controls whether the holder's display name is
 * rendered at all — off means no name anywhere on the card.
 */

export const CARD_TEMPLATES = [
  { id: 'professional', name: 'Professional', hint: 'Minimal white & blue — ideal for LinkedIn' },
  { id: 'celebration', name: 'Celebration', hint: 'Colourful premium dark — ideal for Instagram' },
  { id: 'academic', name: 'Academic', hint: 'Formal certificate-inspired design' },
  { id: 'minimal', name: 'Minimal', hint: 'Cover image, title and badge' },
];

export const CARD_FORMATS = [
  { id: 'linkedin', name: 'LinkedIn', w: 1200, h: 627, hint: '1200 × 627' },
  { id: 'square', name: 'Instagram', w: 1080, h: 1080, hint: '1080 × 1080' },
  { id: 'story', name: 'Story', w: 1080, h: 1920, hint: '1080 × 1920' },
];

const fmtDate = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt)) return String(d);
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

const BLUE = '#2563EB';
const LIGHT = '#60A5FA';
const NAVY = '#0A0F1A';

function Mark({ size = 28, color = '#fff', bg = BLUE }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: size * 0.28, background: bg,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none">
        <path d="M12 2L4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3z" fill={color} opacity="0.95" />
        <path d="M8.5 12.2l2.4 2.4 4.6-4.9" stroke={bg} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    </span>
  );
}

function Badge({ size = 'md', dark = false }) {
  const pad = size === 'lg' ? '14px 26px' : '9px 18px';
  const font = size === 'lg' ? 22 : 15;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 8, padding: pad,
      borderRadius: 999, fontWeight: 700, fontSize: font, letterSpacing: '0.01em',
      background: dark ? 'rgba(37,99,235,0.16)' : 'rgba(37,99,235,0.10)',
      border: `1.5px solid ${dark ? 'rgba(96,165,250,0.5)' : 'rgba(37,99,235,0.35)'}`,
      color: dark ? '#93C5FD' : BLUE,
    }}>
      <svg width={font} height={font} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="11" fill={dark ? '#2563EB' : BLUE} />
        <path d="M7.5 12.4l3 3 6-6.4" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
      Blockward Verified
    </span>
  );
}

function QrBox({ qrDataUrl, size = 120, radius = 14 }) {
  if (!qrDataUrl) return null;
  return (
    <div style={{
      width: size, height: size, background: '#fff', borderRadius: radius, padding: size * 0.08,
      boxShadow: '0 2px 12px rgba(0,0,0,0.18)', flexShrink: 0,
    }}>
      <img src={qrDataUrl} alt="Verify this credential" style={{ width: '100%', height: '100%', display: 'block' }} />
    </div>
  );
}

function Footer({ light = false }) {
  return (
    <p style={{
      fontSize: 15, fontWeight: 500, letterSpacing: '0.02em',
      color: light ? 'rgba(255,255,255,0.55)' : 'rgba(15,23,42,0.45)', margin: 0,
    }}>
      Verified with <span style={{ fontWeight: 700 }}>BlockWard</span>
    </p>
  );
}

function CoverImg({ src, style }) {
  if (!src) return null;
  return <img src={src} alt="" style={{ objectFit: 'cover', width: '100%', height: '100%', display: 'block', ...style }} />;
}

export default function ShareCard({ template = 'professional', format = 'square', data = {}, qrDataUrl, innerRef, style }) {
  const f = CARD_FORMATS.find((x) => x.id === format) || CARD_FORMATS[1];
  const { w, h } = f;
  const wide = w > h; // LinkedIn landscape
  const showName = data.showName !== false;
  const name = (data.holderName || '').trim();
  const title = data.title || 'Achievement';
  const org = data.org || '';
  const date = fmtDate(data.date || data.verifiedAt);
  const cover = data.cover || null;

  const base = {
    width: w, height: h, position: 'relative', overflow: 'hidden',
    fontFamily: "'Inter', Arial, sans-serif", boxSizing: 'border-box', flexShrink: 0, ...style,
  };

  /* ── Professional — white, blue header band, cover right/top ── */
  if (template === 'professional') {
    return (
      <div ref={innerRef} style={{ ...base, background: '#fff', display: 'flex', flexDirection: 'column' }}>
        <div style={{ height: wide ? 8 : 10, background: `linear-gradient(90deg, ${BLUE}, ${LIGHT})`, flexShrink: 0 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: wide ? 'row' : 'column', padding: w * 0.045, gap: w * 0.045, minHeight: 0 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Mark size={30} bg={BLUE} color="#fff" />
              <span style={{ fontWeight: 700, fontSize: 19, color: '#0F172A' }}>BlockWard</span>
            </div>
            <p style={{ marginTop: wide ? w * 0.035 : w * 0.03, marginBottom: 0, fontSize: 14, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: BLUE }}>
              {showName && name ? `${name} has earned` : 'Achievement earned'}
            </p>
            <h1 style={{ margin: `${w * 0.012}px 0 0`, fontSize: wide ? 46 : 54, lineHeight: 1.12, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em' }}>{title}</h1>
            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                {org && <p style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#1E293B' }}>Verified by {org}</p>}
                {date && <p style={{ margin: '4px 0 0', fontSize: 16, color: '#64748B' }}>{date}</p>}
              </div>
              <Badge />
              <Footer />
            </div>
          </div>
          <div style={{ width: wide ? '34%' : 'auto', height: wide ? 'auto' : w * 0.42, borderRadius: 20, overflow: 'hidden', flexShrink: 0, background: '#EFF4FB', display: 'flex', position: 'relative' }}>
            {cover ? <CoverImg src={cover} /> : (
              <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', background: `radial-gradient(circle at 30% 20%, rgba(37,99,235,0.12), transparent 60%), #EFF4FB` }}>
                <Mark size={64} bg={BLUE} color="#fff" />
              </div>
            )}
            <div style={{ position: 'absolute', right: 14, bottom: 14 }}><QrBox qrDataUrl={qrDataUrl} size={wide ? 92 : 110} radius={12} /></div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Celebration — premium dark, glows, centred ── */
  if (template === 'celebration') {
    return (
      <div ref={innerRef} style={{
        ...base,
        background: `radial-gradient(ellipse 70% 45% at 50% 0%, rgba(37,99,235,0.35), transparent 65%), radial-gradient(ellipse 55% 40% at 80% 90%, rgba(37,99,235,0.22), transparent 60%), linear-gradient(180deg, #0E1730 0%, ${NAVY} 70%)`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', padding: w * 0.07,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Mark size={30} bg={BLUE} color="#fff" />
          <span style={{ fontWeight: 700, fontSize: 18, color: '#E2EDFF' }}>BlockWard</span>
        </div>
        <div style={{ width: '100%', height: wide ? '38%' : w * 0.5, maxHeight: h * 0.34, borderRadius: 22, overflow: 'hidden', marginTop: w * 0.06, background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.25)', flexShrink: 0 }}>
          {cover ? <CoverImg src={cover} /> : (
            <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center' }}>
              <Mark size={80} bg={BLUE} color="#fff" />
            </div>
          )}
        </div>
        <div style={{ marginTop: wide ? w * 0.03 : w * 0.07, textAlign: 'center', maxWidth: '92%' }}>
          <Badge size="lg" dark />
          <h1 style={{ margin: `${w * 0.035}px 0 0`, fontSize: wide ? 44 : 62, lineHeight: 1.1, fontWeight: 800, color: '#F4F8FF', letterSpacing: '-0.02em' }}>{title}</h1>
          <p style={{ margin: `${w * 0.02}px 0 0`, fontSize: 20, color: 'rgba(226,237,255,0.75)' }}>
            {showName && name ? `${name} — verified by ${org || 'an independent organisation'}` : `Verified by ${org || 'an independent organisation'}`}
          </p>
        </div>
        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
          <QrBox qrDataUrl={qrDataUrl} size={104} />
          <Footer light />
        </div>
      </div>
    );
  }

  /* ── Academic — formal certificate ── */
  if (template === 'academic') {
    return (
      <div ref={innerRef} style={{ ...base, background: '#FBF8F1', padding: w * 0.035, display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, border: '2px solid rgba(30,58,95,0.35)', borderRadius: 10, padding: w * 0.05, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', position: 'relative', minHeight: 0 }}>
          <div style={{ position: 'absolute', inset: 8, border: '1px solid rgba(30,58,95,0.18)', borderRadius: 6, pointerEvents: 'none' }} />
          <Mark size={44} bg="#1E3A5F" color="#FBF8F1" />
          <p style={{ margin: `${w * 0.03}px 0 0`, fontFamily: "'Recoleta', Georgia, serif", fontSize: 26, color: '#1E3A5F', letterSpacing: '0.04em' }}>Blockward Verified Achievement</p>
          {showName && name && <p style={{ margin: `${w * 0.025}px 0 0`, fontSize: 19, color: '#5B6B80', fontStyle: 'italic' }}>This certifies that</p>}
          {showName && name && <p style={{ margin: `${w * 0.01}px 0 0`, fontFamily: "'Recoleta', Georgia, serif", fontSize: 42, fontWeight: 700, color: '#152238' }}>{name}</p>}
          <p style={{ margin: `${w * 0.02}px 0 0`, fontSize: 18, color: '#5B6B80' }}>has earned</p>
          <h1 style={{ margin: `${w * 0.015}px 0 0`, fontFamily: "'Recoleta', Georgia, serif", fontSize: wide ? 42 : 54, lineHeight: 1.15, fontWeight: 700, color: '#152238', maxWidth: '90%' }}>{title}</h1>
          {org && <p style={{ margin: `${w * 0.02}px 0 0`, fontSize: 19, color: '#1E3A5F', fontWeight: 600 }}>Verified by {org}</p>}
          {date && <p style={{ margin: '6px 0 0', fontSize: 16, color: '#5B6B80' }}>{date}</p>}
          <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 14, width: '100%', justifyContent: 'center' }}>
            <Badge />
            <Footer />
          </div>
          <div style={{ position: 'absolute', right: w * 0.04, bottom: w * 0.03 }}><QrBox qrDataUrl={qrDataUrl} size={wide ? 88 : 104} radius={10} /></div>
        </div>
      </div>
    );
  }

  /* ── Minimal — full-bleed cover, title + badge ── */
  return (
    <div ref={innerRef} style={{ ...base, background: '#0E1730' }}>
      <div style={{ position: 'absolute', inset: 0 }}>
        {cover ? <CoverImg src={cover} /> : (
          <div style={{ width: '100%', height: '100%', background: `radial-gradient(circle at 30% 25%, rgba(37,99,235,0.4), transparent 60%), linear-gradient(160deg, #14264F, ${NAVY})`, display: 'grid', placeItems: 'center' }}>
            <Mark size={90} bg={BLUE} color="#fff" />
          </div>
        )}
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(6,10,20,0.55) 0%, rgba(6,10,20,0.0) 30%, rgba(6,10,20,0.05) 45%, rgba(6,10,20,0.88) 100%)' }} />
      <div style={{ position: 'absolute', top: w * 0.045, left: w * 0.05, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Mark size={28} bg={BLUE} color="#fff" />
        <span style={{ fontWeight: 700, fontSize: 17, color: '#fff' }}>BlockWard</span>
      </div>
      <div style={{ position: 'absolute', left: w * 0.05, right: w * 0.05, bottom: w * 0.05, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: w * 0.04 }}>
        <div style={{ minWidth: 0 }}>
          <Badge dark />
          <h1 style={{ margin: `${w * 0.02}px 0 0`, fontSize: wide ? 40 : 56, lineHeight: 1.1, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>{title}</h1>
          <p style={{ margin: `${w * 0.012}px 0 0`, fontSize: 18, color: 'rgba(255,255,255,0.75)' }}>
            {[showName && name ? name : null, org ? `Verified by ${org}` : null, date].filter(Boolean).join(' · ')}
          </p>
        </div>
        <QrBox qrDataUrl={qrDataUrl} size={wide ? 96 : 112} />
      </div>
    </div>
  );
}