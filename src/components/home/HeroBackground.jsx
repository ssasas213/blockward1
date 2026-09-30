import React from 'react';

/**
 * Restrained hero background — clean premium black / very dark navy.
 *
 * ONE treatment only: a barely-visible blue radial illumination centred
 * behind the credential (low-centre), plus a soft vignette for depth. No
 * purple, no waves, no curved lines, no floating icons, no particles, no
 * perspective grid floor. The black should read as the base; the blue is
 * only noticed when you look for it.
 */
export default function HeroBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Base: Blockward black / very dark navy */}
      <div className="absolute inset-0" style={{ background: '#0A0F1A' }} />

      {/* Single restrained treatment: faint blue illumination behind the credential */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 58% 55% at 50% 66%, rgba(37,99,235,0.10), transparent 68%)',
        }}
      />

      {/* Soft edge vignette — depth, not an effect */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(5,8,14,0.55) 0%, transparent 26%, transparent 70%, rgba(5,8,14,0.6) 100%)',
        }}
      />
    </div>
  );
}