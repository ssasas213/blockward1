import React from 'react';
import StoryCredential from './CredentialCard';

// Scene 1 — Achievement earned: golden trophy at centre, a blue line
// emerges, and the trophy becomes a digital credential.
export default function SceneTrophy() {
  return (
    <div className="absolute inset-0" aria-hidden="true">
      {/* Blue line emerging from the trophy */}
      <svg viewBox="0 0 640 400" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" fill="none">
        <defs>
          <linearGradient id="sw-line-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#2563EB" stopOpacity="0.15" />
            <stop offset="1" stopColor="#60A5FA" />
          </linearGradient>
        </defs>
        <path
          d="M215 218 C 275 248, 365 248, 425 218"
          stroke="url(#sw-line-grad)" strokeWidth="2.5" strokeLinecap="round"
          style={{
            strokeDasharray: 320,
            animation: 'sw-draw 0.85s ease both, sw-out 0.4s ease both',
            animationDelay: '1.9s, 2.75s',
          }}
        />
      </svg>

      {/* Trophy — outer div centers, inner div animates */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[58%]">
        <div style={{ animation: 'sw-trophy-in 0.9s cubic-bezier(0.22,1,0.36,1) both, sw-out 0.55s ease both', animationDelay: '0.15s, 2.5s' }}>
          <div style={{ animation: 'sw-float 3s ease-in-out infinite alternate' }}>
            <TrophyArt />
          </div>
        </div>
      </div>

      {/* The credential it becomes */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div style={{ animation: 'sw-in 0.55s cubic-bezier(0.22,1,0.36,1) both, sw-out 0.4s ease both', animationDelay: '2.75s, 3.05s' }}>
          <StoryCredential />
        </div>
      </div>
    </div>
  );
}

function TrophyArt() {
  return (
    <svg width="118" height="128" viewBox="0 0 120 130" fill="none" className="drop-shadow-[0_12px_44px_rgb(246_210_122/0.22)]">
      <defs>
        <linearGradient id="sw-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F8DC8F" />
          <stop offset="0.55" stopColor="#E7B94E" />
          <stop offset="1" stopColor="#B98A2B" />
        </linearGradient>
        <linearGradient id="sw-gold-dark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#D9A93F" />
          <stop offset="1" stopColor="#8F671D" />
        </linearGradient>
      </defs>
      <path d="M22 22 C 6 22, 4 48, 24 54 M98 22 C 114 22, 116 48, 96 54" stroke="url(#sw-gold-dark)" strokeWidth="7" fill="none" strokeLinecap="round" />
      <path d="M30 14 H90 V44 C90 62 78 74 60 74 C42 74 30 62 30 44 Z" fill="url(#sw-gold)" />
      <rect x="55" y="74" width="10" height="18" fill="url(#sw-gold-dark)" />
      <path d="M40 96 H80 L86 108 H34 Z" fill="url(#sw-gold)" />
      <rect x="30" y="108" width="60" height="10" rx="3" fill="url(#sw-gold-dark)" />
      <path d="M42 20 C 42 40 48 56 56 64" stroke="#FFF3C4" strokeWidth="4" strokeLinecap="round" opacity="0.5" fill="none" />
    </svg>
  );
}