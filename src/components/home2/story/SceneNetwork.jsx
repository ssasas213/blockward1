import React from 'react';
import StoryCredential from './CredentialCard';

// Scene 2 — Secured by blockchain: the credential sits at the centre of an
// elegant node network while its cryptographic fingerprint is anchored.
// Only the fingerprint is anchored — never personal data.
const NODES = [
  [90, 330], [170, 110], [320, 60], [470, 130], [560, 310], [320, 350], [190, 250], [450, 250],
];
const EDGES = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [1, 6], [6, 0], [3, 7], [7, 4], [6, 7], [2, 7], [5, 6]];

export default function SceneNetwork() {
  return (
    <div className="absolute inset-0" aria-hidden="true">
      <svg viewBox="0 0 640 400" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" fill="none">
        <defs>
          <radialGradient id="sw-net-glow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#2563EB" stopOpacity="0.14" />
            <stop offset="1" stopColor="#2563EB" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="320" cy="200" r="230" fill="url(#sw-net-glow)" style={{ animation: 'sw-in 1.2s ease both', animationDelay: '3.25s' }} />
        {EDGES.map(([a, b], i) => (
          <line
            key={i}
            x1={NODES[a][0]} y1={NODES[a][1]} x2={NODES[b][0]} y2={NODES[b][1]}
            stroke="#2563EB" strokeOpacity="0.35" strokeWidth="1.5"
            style={{
              strokeDasharray: 320,
              animation: `sw-draw 0.7s ease both, sw-pulse-op 2.6s ease-in-out infinite alternate`,
              animationDelay: `${3.35 + i * 0.06}s, ${4.2 + i * 0.18}s`,
            }}
          />
        ))}
        {NODES.map(([x, y], i) => (
          <g key={i} style={{ animation: 'sw-in 0.5s ease both', animationDelay: `${3.2 + i * 0.08}s` }}>
            <circle cx={x} cy={y} r="4.5" fill="#60A5FA" />
            <circle cx={x} cy={y} r="10" stroke="#2563EB" strokeWidth="1.5" fill="none"
              style={{ animation: 'sw-pulse-op 2.4s ease-in-out infinite alternate', animationDelay: `${3.9 + i * 0.2}s` }} />
          </g>
        ))}
      </svg>

      {/* Credential held at the centre of the network */}
      <div className="absolute left-1/2 top-[44%] -translate-x-1/2 -translate-y-1/2">
        <div style={{ animation: 'sw-in 0.5s ease both, sw-out 0.45s ease both', animationDelay: '3.2s, 5.75s' }}>
          <StoryCredential />
        </div>
      </div>

      {/* Cryptographic fingerprint being anchored */}
      <div className="absolute bottom-[14%] left-1/2 -translate-x-1/2">
        <div style={{ animation: 'sw-in 0.5s ease both, sw-out 0.45s ease both', animationDelay: '4.15s, 5.75s' }}>
          <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-[#0D1424]/90 px-3.5 py-2.5">
            <span className="font-mono text-[11px] text-white/55">BW-HASH-V1 · 9f3a…c21e</span>
            <span className="flex items-center gap-1.5" style={{ animation: 'sw-pop 0.4s cubic-bezier(0.22,1,0.36,1) both', animationDelay: '4.75s' }}>
              <span className="grid h-4 w-4 place-items-center rounded-full bg-success/20">
                <svg viewBox="0 0 12 12" className="h-2.5 w-2.5"><path d="M2.5 6.5 L5 9 L9.5 3.5" stroke="#34D399" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
              <span className="text-[11px] font-medium text-success">Anchored</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}