import React from 'react';

/**
 * ProfileCardImage — a square 1080px share card rendered off-screen.
 * Used for the downloadable stories image and the generated OG image
 * (captured with html2canvas). Inline styles only — html2canvas can't
 * reliably render Tailwind CSS variables or backdrop filters.
 */
export default function ProfileCardImage({ data, domRef }) {
  const { name, handle, bio, avatarUrl, schoolName, count } = data;
  const initials = (name || '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div
      ref={domRef}
      style={{
        width: 1080,
        height: 1080,
        position: 'fixed',
        left: -20000,
        top: 0,
        zIndex: -1,
        background: 'linear-gradient(160deg, #131024 0%, #0B0A10 55%, #1A0F2E 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
        padding: '80px',
        fontFamily: 'Inter, system-ui, sans-serif',
        color: '#F7F5FA',
        textAlign: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Ambient glows */}
      <div style={{ position: 'absolute', top: -120, left: '50%', transform: 'translateX(-50%)', width: 900, height: 500, background: 'radial-gradient(ellipse, rgba(139,92,246,0.22), transparent 70%)' }} />
      <div style={{ position: 'absolute', bottom: -100, right: -80, width: 600, height: 500, background: 'radial-gradient(ellipse, rgba(236,72,153,0.12), transparent 70%)' }} />

      {/* Avatar */}
      {avatarUrl ? (
        <img src={avatarUrl} alt="" crossOrigin="anonymous" style={{ width: 200, height: 200, borderRadius: 56, objectFit: 'cover', border: '4px solid rgba(139,92,246,0.35)', boxShadow: '0 24px 60px rgba(0,0,0,0.45)' }} />
      ) : (
        <div style={{
          width: 200, height: 200, borderRadius: 56,
          background: 'linear-gradient(135deg, #8B5CF6, #EC4899)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 72, fontWeight: 800, color: '#fff',
          boxShadow: '0 24px 60px rgba(139,92,246,0.35)',
        }}>
          {initials}
        </div>
      )}

      {/* Name + handle */}
      <h1 style={{ fontSize: 64, fontWeight: 800, margin: '48px 0 0', letterSpacing: '-1px' }}>{name}</h1>
      <p style={{ fontSize: 34, color: '#A78BFA', margin: '10px 0 0', fontWeight: 600 }}>@{handle}</p>

      {/* Bio */}
      {bio && <p style={{ fontSize: 30, color: 'rgba(247,245,250,0.65)', margin: '28px auto 0', maxWidth: 760, lineHeight: 1.45 }}>{bio}</p>}

      {/* School */}
      {schoolName && <p style={{ fontSize: 26, color: 'rgba(247,245,250,0.5)', margin: '18px 0 0' }}>{schoolName}</p>}

      {/* Verified count */}
      <div style={{
        marginTop: 44, padding: '18px 44px', borderRadius: 999,
        border: '1px solid rgba(139,92,246,0.4)', background: 'rgba(139,92,246,0.12)',
        fontSize: 30, fontWeight: 700,
      }}>
        {count} verified achievement{count === 1 ? '' : 's'}
      </div>

      {/* Footer */}
      <p style={{ position: 'absolute', bottom: 56, left: 0, right: 0, fontSize: 26, color: 'rgba(247,245,250,0.4)', margin: 0 }}>
        blockward.app/@{handle} · Verified by BlockWard
      </p>
    </div>
  );
}